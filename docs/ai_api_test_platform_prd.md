# AI 接口自动化测试平台（产品设计文档）

> 版本：v2.0 | 更新日期：2026-04-28

---

## 一、产品概述

### 1.1 产品目标

构建一个基于 AI 的接口自动化测试平台，实现完整的测试闭环：

```
输入 OpenAPI / Swagger URL
→ 异步导入并解析接口
→ 用户筛选 & 选择接口
→ AI 生成结构化测试用例（DSL）
→ DSL 校验 + 入库
→ 一键执行（Playwright）
→ 输出测试报告 + AI 分析建议
```

---

### 1.2 核心价值

- 降低测试用例设计成本（目标 >60%）
- 结构化 DSL 保证可审计、可复现
- AI 生成 + Validator 双重约束，执行安全可控
- 本地优先（Local-first），无需外部数据库即可运行
- 现有 CLI 路径（`omni-qa import` / `omni-qa run`）保持不变

---

## 二、核心功能

### 2.1 OpenAPI 异步导入

#### 输入

- `sourceUrl`：OpenAPI 文档的 HTTP(S) URL（JSON / YAML，OpenAPI 3.x / Swagger 2.0）

#### 流程（异步 Job）

```
POST /api/openapi/import
→ 创建 Job（pending）
→ 后台：SSRF 校验 → 拉取文档（限制大小 / 超时）
→ 解析 Schema（@apidevtools/swagger-parser）
→ 提取接口入库（ApiSpec + ApiEndpoint[]）
→ Job 变为 succeeded / failed
→ 前端轮询 GET /api/jobs/:jobId
```

限制约束由 `ServerLimits` 统一配置：

| 参数 | 说明 |
|------|------|
| `importMaxBytes` | 文档最大下载字节数 |
| `importTimeoutMs` | 下载超时 |
| `parseTimeoutMs` | 解析超时 |
| `maxEndpointsPerSpec` | 单个 Spec 最大接口数 |

---

### 2.2 接口管理

支持多维度筛选（`EndpointFilter`）：

| 字段 | 说明 |
|------|------|
| `tags` | 按 Tag 过滤 |
| `methods` | 按 HTTP Method 过滤 |
| `keyword` | 按 path / operationId / summary 关键词搜索 |
| `path` | 精确/前缀匹配 path |
| `operationId` | 精确匹配 |
| `limit` / `offset` | 分页 |

接口展示示例：

```
[ ] GET    /api/users           listUsers
[ ] POST   /api/users           createUser
[ ] GET    /api/users/{id}      getUserById
[ ] DELETE /api/users/{id}      deleteUser  [deprecated]
```

---

### 2.3 接口选择（EndpointSelection）

支持：

- 单选 / 多选 / 按 Tag 批量 / 全量
- 保存为命名 Selection（`POST /api/selections`）
- 对同一 Spec 可保存多个 Selection，支持复用

限制：单次 Selection 最大接口数由 `maxSelectionSize` 控制。

---

### 2.4 AI 测试用例生成

#### 生成流程（异步 Job）

```
POST /api/test-cases/generate { selectionId, useFallback }
→ 创建 Job（pending）
→ 后台：构建 Prompt（含敏感字段脱敏）
→ 调用 AI Provider（LLM Structured Output）
→ 校验 DSL 输出（防注入 + Schema 检查）
→ 保存 TestCase[]（status: "validated"）
→ Job 变为 succeeded / failed
```

若未配置 AI Provider，且 `useFallback=true`，则自动使用**确定性兜底生成器**（基于 OpenAPI Schema 派生基础用例），避免阻塞流程。

#### Prompt 构造策略

```
{
  "instruction": "Generate API test cases as JSON only. Return {\"cases\":[...]} using the provided DSL. Do not return code.",
  "dsl": { /* DSL Schema 说明 */ },
  "endpoints": [ /* 脱敏后的接口清单 */ ]
}
```

- 超过 `aiPromptMaxChars` 时自动截断：优先保留接口 id / method / path，丢弃详细 Schema
- `promptVersion` 写入每个生成的 TestCase，便于后续对比不同版本效果

#### 完整 DSL Schema

```typescript
interface TestCase {
  id: string;                          // UUID，服务端生成
  endpointId: string;                  // 关联接口
  specId: string;
  name: string;                        // 可读名称
  scenarioType: 'smoke' | 'positive' | 'negative' | 'boundary' | 'auth';
  priority: 'low' | 'medium' | 'high';
  status: 'draft' | 'validated' | 'invalid';
  request: TestRequestSpec;
  assertions: TestAssertion[];
  tags: string[];
  createdAt: string;
  selectionId?: string;
  model?: string;                      // 生成模型名称
  promptVersion?: string;              // Prompt 版本
  validationError?: string;            // 校验失败原因
}

interface TestRequestSpec {
  method: HttpMethod;
  path: string;
  query?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

interface TestAssertion {
  type: 'status' | 'header' | 'jsonPath' | 'schema' | 'latency';
  operator: 'eq' | 'neq' | 'contains' | 'exists' | 'lt' | 'lte' | 'gt' | 'gte';
  target?: string;   // header name / jsonPath expression
  expected?: unknown;
}
```

---

### 2.5 用例管理

- 按 specId / endpointId / selectionId 查询（`GET /api/test-cases`）
- 仅 `status: "validated"` 的用例可参与执行
- 用例与 Spec 版本绑定，重新导入同一 URL 时产生新的 specId

---

### 2.6 测试执行

#### 执行流程（异步 Job）

```
POST /api/test-runs { caseIds, envId, workers }
→ 校验入参（caseIds 非空、均为 validated、不超过 maxCasesPerRun）
→ 检查并发上限（maxConcurrentRuns）
→ 创建 TestRun + Job
→ 后台：Playwright 执行适配器
   ├── 将 TestCase DSL 转换为 Playwright spec
   ├── 按 AbortController 支持取消
   └── 写入 TestResult[]（per-case 结果）
→ 更新 TestRun 统计（total / passed / failed / skipped）
→ 写入报告路径（HTML report dir + JSON report path）
```

支持取消：`POST /api/test-runs/:id/cancel`

#### 断言类型

| type | 说明 |
|------|------|
| `status` | HTTP 状态码断言 |
| `header` | 响应 Header 断言 |
| `jsonPath` | JSON 字段值断言（JSONPath 表达式） |
| `schema` | JSON Schema 结构匹配 |
| `latency` | 响应时间断言（ms） |

---

### 2.7 测试报告

`GET /api/test-runs/:id` 返回：

```typescript
interface TestRun {
  id: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'canceled';
  envId: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  startedAt?: string;
  finishedAt?: string;
  report?: {
    htmlReportDir?: string;    // Playwright HTML report
    jsonReportPath?: string;   // 结构化 JSON 报告
    outputPreview?: string;    // 前几行终端输出
  };
}
```

`GET /api/test-runs/:id/results` 返回 per-case `TestResult[]`：

```typescript
interface TestResult {
  caseId: string;
  status: 'passed' | 'failed' | 'skipped' | 'timed-out';
  durationMs: number;
  responseStatus?: number;
  error?: string;
  assertionFailures?: string[];
}
```

---

## 三、系统架构

### 3.1 工程结构

```
omni-qa/                         # Bun Workspace
 ├── apps/
 │   ├── server/                  # Node.js HTTP 后端（本文档主体）
 │   │   └── src/
 │   │       ├── domain/          # 实体类型 & 错误
 │   │       ├── http/            # HTTP 路由 & JSON 工具
 │   │       ├── repositories/    # 存储抽象接口 + JSON 实现
 │   │       └── services/        # 业务逻辑（import / generation / execution）
 │   └── config-studio/           # Vue 3 配置 UI
 ├── packages/
 │   ├── core/                    # OpenAPI 解析器、Fixtures、Reporter
 │   └── cli/                     # CLI 入口（omni-qa import / run）
 └── tests/api/                   # 生成的 Playwright 测试文件
```

### 3.2 分层架构

```
┌─────────────────────────────────┐
│       Config Studio (Vue 3)     │  ← HTTP API 消费者
└────────────┬────────────────────┘
             │ HTTP
┌────────────▼────────────────────┐
│       apps/server               │
│  ┌──────────────────────────┐   │
│  │  HTTP Router             │   │  ← 无框架，原生 node:http
│  └──────────┬───────────────┘   │
│  ┌──────────▼───────────────┐   │
│  │  Service Layer           │   │
│  │  ImportService           │   │
│  │  GenerationService       │   │
│  │  ExecutionService        │   │
│  └──────────┬───────────────┘   │
│  ┌──────────▼───────────────┐   │
│  │  Repository Interfaces   │   │  ← 存储无关
│  │  SpecRepo / EndpointRepo │   │
│  │  CaseRepo / RunRepo      │   │
│  │  JobRepo / SelectionRepo │   │
│  └──────────┬───────────────┘   │
│  ┌──────────▼───────────────┐   │
│  │  JSON File Store         │   │  ← 本地优先实现
│  └──────────────────────────┘   │
└─────────────────────────────────┘
             │
┌────────────▼────────────────────┐
│  packages/core                  │
│  OpenAPI Parser / Fixtures /    │
│  Playwright Execution           │
└─────────────────────────────────┘
```

### 3.3 异步 Job 模型

所有耗时操作（OpenAPI 导入、AI 生成、测试执行）均通过 Job 驱动：

```
Job.status: pending → running → succeeded
                              → failed
                              → canceled
```

- 提交操作返回 `202 Accepted` + `{ job, ... }`
- 前端通过 `GET /api/jobs/:jobId` 轮询状态（初期）
- 后续可升级为 Server-Sent Events

---

## 四、数据模型

### 4.1 Repository 接口

```typescript
interface SpecRepository {
  save(spec: ApiSpec): Promise<void>;
  list(): Promise<ApiSpec[]>;
  get(id: string): Promise<ApiSpec | undefined>;
}

interface EndpointRepository {
  saveMany(specId: string, endpoints: ApiEndpoint[]): Promise<void>;
  list(specId: string, filter?: EndpointFilter): Promise<ApiEndpoint[]>;
  getMany(specId: string, endpointIds: string[]): Promise<ApiEndpoint[]>;
}

interface CaseRepository {
  saveMany(cases: TestCase[]): Promise<void>;
  getMany(caseIds: string[]): Promise<TestCase[]>;
  list(filter?: { specId?: string; endpointId?: string; selectionId?: string }): Promise<TestCase[]>;
}

interface RunRepository {
  save(run: TestRun): Promise<void>;
  get(id: string): Promise<TestRun | undefined>;
  update(id: string, patch: Partial<TestRun>): Promise<TestRun>;
  saveResults(runId: string, results: TestResult[]): Promise<void>;
  listResults(runId: string): Promise<TestResult[]>;
}

interface JobRepository {
  save(job: Job): Promise<void>;
  get(id: string): Promise<Job | undefined>;
  update(id: string, patch: Partial<Job>): Promise<Job>;
}
```

> **当前实现**：JSON 文件存储（`data/` 目录）。接口隔离设计使 SQLite / PostgreSQL 替换不影响 Service 层。

### 4.2 核心实体

```typescript
interface ApiSpec {
  id: string;             // UUID
  sourceUrl: string;
  title: string;
  version: string;
  importedAt: string;
  contentHash: string;   // SHA-256，用于去重
  endpointCount: number;
  baseUrl?: string;
}

interface ApiEndpoint {
  id: string;
  specId: string;
  method: HttpMethod;
  path: string;
  tags: string[];
  operationId?: string;
  summary?: string;
  parameters: ParsedParameter[];
  requestBody?: ParsedRequestBody;
  responses: ParsedResponse[];
  deprecated: boolean;
}

interface Job {
  id: string;
  type: 'openapi-import' | 'ai-generation' | 'test-run';
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'canceled';
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  result?: Record<string, unknown>;
}
```

---

## 五、HTTP API

| Method | Path | 说明 |
|--------|------|------|
| `GET` | `/healthz` | 服务健康检查 |
| `POST` | `/api/openapi/import` | 提交 OpenAPI 导入 Job |
| `GET` | `/api/jobs/:jobId` | 查询 Job 状态 |
| `GET` | `/api/specs` | 列出所有已导入的 Spec |
| `GET` | `/api/specs/:specId/endpoints` | 查询接口列表（支持过滤） |
| `POST` | `/api/selections` | 保存接口选择集合 |
| `POST` | `/api/test-cases/generate` | 提交 AI 生成 Job |
| `GET` | `/api/test-cases` | 查询用例（按 spec/endpoint/selection） |
| `POST` | `/api/test-runs` | 提交测试执行 Job |
| `GET` | `/api/test-runs/:runId` | 查询 Run 摘要 |
| `GET` | `/api/test-runs/:runId/results` | 查询 per-case 结果 |
| `GET` | `/api/test-runs/:runId/report` | 查询报告路径 |
| `POST` | `/api/test-runs/:runId/cancel` | 取消执行中的 Run |

---

## 六、核心流程

### 6.1 用例生成流程

```
POST /api/test-cases/generate
     │
     ├─ resolveTarget(selectionId | specId + endpointIds)
     ├─ buildPrompt(endpoints)        ← 截断 + 敏感字段脱敏
     ├─ provider.generateCases(prompt)
     │     └─ 若无 Provider + useFallback → 确定性兜底生成
     ├─ normalizeAIOutput(output)     ← 拒绝可执行文本
     ├─ validateTestCases(raw)        ← 逐条校验 DSL 字段
     └─ repos.cases.saveMany(cases)
```

### 6.2 测试执行流程

```
POST /api/test-runs
     │
     ├─ 去重 caseIds
     ├─ 检查 maxCasesPerRun / maxConcurrentRuns
     ├─ cases.getMany(caseIds) → 验证均为 validated
     ├─ 创建 TestRun + Job → 入库
     └─ queueMicrotask → runNow(jobId, runId)
          │
          ├─ PlaywrightExecutionAdapter.run(cases, env, signal)
          │    ├─ 生成临时 .spec.ts（写入隔离目录）
          │    ├─ 执行 `playwright test`
          │    └─ 解析 JSON reporter 输出
          ├─ repos.runs.saveResults(results)
          └─ repos.runs.update(runId, { passed, failed, report })
```

---

## 七、安全设计

### 7.1 SSRF 防护

导入阶段对 `sourceUrl` 执行严格校验：

- 协议仅允许 `http` / `https`
- 拒绝目标：`localhost`、`127.x.x.x`、`10.x.x.x`、`172.16-31.x.x`、`192.168.x.x`
- 设置下载大小上限（`importMaxBytes`）和超时（`importTimeoutMs`）

### 7.2 AI 输出注入防护

AI 生成输出进入双重过滤管道：

```
normalizeAIOutput(output)
  └─ isExecutableText(output)  → 检测 import / eval / exec / spawn / describe / curl 等关键字
        true  → 抛出 validationError，拒绝用例

validateTestCases(rawCases)
  └─ 逐条 isExecutableText(JSON.stringify(case))
  └─ endpointId 必须属于当前 Selection
  └─ method / assertionType / operator 均从白名单校验
```

### 7.3 Prompt 敏感字段脱敏

构建 Prompt 时使用 `redactSensitive()` 对接口 Schema 进行递归脱敏：

- 匹配键名正则：`password | passwd | token | authorization | secret | cookie | api_key | access_key`
- 替换为 `[REDACTED]`
- 最大递归深度 12 层（防止畸形 Schema 导致栈溢出）

### 7.4 并发与资源限制

| 配置 | 限制目的 |
|------|--------|
| `maxConcurrentRuns` | 防止执行任务挤占系统资源 |
| `maxCasesPerRun` | 防止单次运行失控 |
| `maxSelectionSize` | 防止 AI prompt 过大 |
| `runTimeoutMs` | 防止 Playwright 进程挂起 |
| `aiPromptMaxChars` | 防止 token 超限 / 费用失控 |

### 7.5 执行隔离

- AI 生成的 Playwright spec 写入独立的运行时目录（与用户编写的测试文件隔离）
- 禁止 AI 输出中包含可执行 TypeScript / JavaScript 代码

---

## 八、MVP 范围

### 必须实现 ✅

- OpenAPI 导入（异步 Job）
- 接口目录与多维筛选
- AI 用例生成（含确定性兜底）
- DSL 校验与注入防护
- Playwright 执行适配器
- 报告路径返回
- 取消执行

### 暂不实现

- 性能测试 / 压测
- 分布式执行 / 多 Worker 调度
- AI 自动修复失败用例
- 多租户权限体系
- PostgreSQL / SQLite 持久化（接口已预留）
- Server-Sent Events（当前为轮询）

---

## 九、技术选型

| 模块 | 技术 | 说明 |
|------|------|------|
| 运行时 | Bun | 工作区管理 + 测试运行 |
| 前端 | Vue 3 + TypeScript | config-studio |
| 后端 | Node.js + TypeScript | apps/server，无框架 |
| AI | LLM Structured Output | 通过 `AITestCaseProvider` 接口接入 |
| 执行器 | Playwright APIRequest | packages/core |
| 存储（初期） | JSON 文件 | 本地优先，接口隔离 |
| 存储（后续） | SQLite / PostgreSQL | 接口已预留 |
| OpenAPI 解析 | @apidevtools/swagger-parser | 支持 3.x / 2.0 |
| CLI | Commander.js | packages/cli |

---

## 十、待决议问题

| 问题 | 现状 |
|------|------|
| 首批生产 AI Provider 接入哪家？ | 接口已设计，适配器待实现 |
| 本地存储是否升级到 SQLite？ | JSON 文件版本稳定后推进 |
| 用例生成后是否需要人工审批才能执行？ | 当前默认跳过，可配置 |
| 失败响应体保留多少字节用于调试？ | 需平衡调试需求与数据脱敏 |
| Job 推送从轮询升级到 SSE 的时机？ | 待 UI 稳定后评估 |

---

## 十一、设计原则

```
AI 负责生成 DSL
Validator 负责约束与注入防护
Executor 负责执行与资源控制
Repository 负责存储解耦

系统必须：
  可控   — 所有 AI 输出经过白名单校验
  可复现 — DSL 版本化 + promptVersion 追踪
  可追踪 — Job 状态机 + 完整 TestResult 记录
  可取消 — AbortController 贯穿执行链路
```

---

## 结论

这是一个：

```
AI + OpenAPI + 异步 Job 引擎 + Playwright 执行器
```

驱动的接口测试平台。

核心竞争力在于：

```
结构化 DSL + 强约束执行 + AI 辅助生成 + 本地优先
```

> **与 V1 的主要演进**：异步 Job 模型取代同步请求；Repository 模式解耦存储；AI 输出注入防护管道；确定性兜底生成器保证无 AI Key 也可运行。