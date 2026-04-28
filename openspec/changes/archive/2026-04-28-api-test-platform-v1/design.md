# Design: API 自动化测试平台 V1

## 目录结构

```
omni-qa/
├── playwright.config.ts            # Playwright 配置
├── omni-qa.config.ts               # 平台配置（环境/认证/通知）
├── package.json
├── tsconfig.json
├── .env.example                    # 环境变量模板
│
├── src/
│   ├── config/                     # 配置加载
│   │   ├── loader.ts               #   读取 omni-qa.config.ts
│   │   └── types.ts                #   配置类型定义
│   │
│   ├── openapi/                    # OpenAPI 导入与解析
│   │   ├── parser.ts               #   解析 OpenAPI 文档
│   │   ├── fetcher.ts              #   获取远程文档
│   │   └── types.ts                #   解析后的接口类型
│   │
│   ├── generator/                  # 测试用例生成
│   │   ├── index.ts                #   生成入口
│   │   └── templates/              #   Handlebars 模板
│   │       └── api-spec.hbs        #   .spec.ts 模板
│   │
│   ├── fixtures/                   # Playwright Fixtures
│   │   ├── auth.fixture.ts         #   认证处理（静态 Header / 登录获取 Token）
│   │   ├── api-client.fixture.ts   #   封装的 API 请求客户端
│   │   └── index.ts                #   聚合导出 test.extend()
│   │
│   ├── assertions/                 # 公共断言
│   │   └── api-matchers.ts         #   自定义 expect matchers
│   │
│   ├── reporters/                  # 通知 Reporter
│   │   ├── notifier.reporter.ts    #   Playwright Reporter 实现
│   │   ├── dingtalk.ts             #   钉钉 Webhook
│   │   └── email.ts                #   SMTP 邮件
│   │
│   └── cli/                        # CLI 入口
│       ├── index.ts                #   Commander.js 主入口
│       └── commands/
│           ├── import.ts           #   omni-qa import <source>
│           ├── run.ts              #   omni-qa run [options]
│           └── report.ts           #   omni-qa report
│
├── tests/                          # 生成的测试用例目录
│   └── api/                        #   接口测试
│
└── reports/                        # 报告输出目录
```

## 核心模块设计

### 1. 配置系统 (omni-qa.config.ts)

```ts
interface OmniQAConfig {
  envs: Record<string, EnvConfig>;
  defaultEnv: string;
  globalHeaders?: Record<string, string>;
  notify?: NotifyConfig[];
  testDir?: string;       // 默认 tests/api
  reportDir?: string;     // 默认 reports
}

interface EnvConfig {
  baseURL: string;
  auth?: AuthConfig;
  headers?: Record<string, string>;
}

// 认证：静态 Header 或登录获取 Token
type AuthConfig =
  | { type: 'header'; headers: Record<string, string> }
  | { type: 'bearer'; login: LoginConfig }

interface LoginConfig {
  url: string;
  method: 'POST' | 'GET';
  body?: Record<string, any>;       // 支持 ${ENV_VAR} 插值
  tokenPath: string;                // 从响应 JSON 提取 token 的路径
}

type NotifyConfig =
  | { type: 'dingtalk'; webhook: string }
  | { type: 'email'; smtp: SmtpConfig; to: string[] }
```

### 2. OpenAPI 解析器

- 使用 @apidevtools/swagger-parser 解析 OpenAPI 3.0/3.1 和 Swagger 2.0
- 支持本地文件 (.yaml/.json) 和远程 URL
- 自动解析 $ref 引用
- 输出结构化的接口清单：path, method, operationId, parameters, requestBody, responses

### 3. 测试用例生成器

- 读取解析后的接口清单
- 通过 Handlebars 模板生成 .spec.ts 文件
- 每个 tag（或 path prefix）生成一个文件
- 生成的用例包含：
  - 基础连通性测试（状态码非 5xx）
  - Schema 校验（响应匹配 OpenAPI 定义的 schema）
  - 必填参数缺失测试（预期 400）

### 4. 认证 Fixture

- auth.fixture.ts 通过 test.extend() 提供 `authHeaders` fixture
- 根据配置的 auth.type 决定行为：
  - `header`: 直接返回配置的 headers
  - `bearer`: 执行登录请求，提取 token，返回 Authorization header
- Token 在 worker 级别缓存，避免每个用例都登录
- 支持 ${VAR} 环境变量插值

### 5. API Client Fixture

- api-client.fixture.ts 提供 `apiClient` fixture
- 基于 Playwright 的 APIRequestContext
- 自动注入 baseURL + globalHeaders + authHeaders
- 提供 get/post/put/delete 等方法

### 6. 通知系统

- 实现为 Playwright 自定义 Reporter
- 测试结束后收集结果，发送通知
- 钉钉：通过 Webhook 发送 Markdown 消息卡片
- 邮件：通过 nodemailer SMTP 发送 HTML 邮件

### 7. CLI

- `omni-qa import <source>` — 导入 OpenAPI 文档并生成测试文件
  - source: 本地文件路径或 URL
  - --out: 输出目录（默认 tests/api）
  - --tag: 只生成指定 tag 的接口
- `omni-qa run` — 执行测试
  - --env: 指定环境（默认 defaultEnv）
  - --tag: 标签过滤
  - --retry: 失败重试次数
  - --trace: 开启 trace
- `omni-qa report` — 打开最近一次的 HTML 报告

## 关键设计决策

1. **不自己写 test runner** — 直接用 @playwright/test，充分利用其并行执行、fixture、retry、reporter 能力
2. **生成静态文件（方案 A）** — 生成 .spec.ts 后用户可手动编辑和扩展，版本控制友好
3. **配置集中管理** — 一个 omni-qa.config.ts 管理所有环境、认证、通知配置
4. **Fixture 注入认证** — 用例无需关心认证细节，Fixture 自动处理
5. **环境变量插值** — 敏感信息通过 ${VAR} 引用，不硬编码
