# AI 接口自动化测试平台（产品设计文档）

---

## 一、产品概述

### 1.1 产品目标

构建一个基于 AI 的接口自动化测试平台，实现：

```
输入 OpenAPI / Swagger URL
→ 自动解析接口
→ 用户选择接口
→ AI 自动生成测试用例
→ 一键执行测试
→ 输出测试报告 + AI 分析
```

---

### 1.2 核心价值

- 降低测试用例设计成本（>60%）
- 提高接口覆盖率
- 自动化回归测试
- 快速定位问题

---

## 二、核心功能

### 2.1 OpenAPI 导入

#### 输入

- OpenAPI URL（JSON / YAML）
- Base URL（可选）

#### 流程

```
URL 校验
→ 拉取文档
→ 解析 Schema
→ 提取接口
→ 入库
```

---

### 2.2 接口管理

支持：

- 接口列表展示
- 按 Method / Tag / Path 筛选
- 搜索接口
- 查看接口详情

示例：

```
[ ] GET  /api/users
[ ] POST /api/users
[ ] GET  /api/users/{id}
```

---

### 2.3 接口选择

支持：

- 单选
- 多选
- 按 Tag 批量
- 全量选择

---

### 2.4 AI 测试用例生成

#### 输入（结构化）

- 接口 Schema
- 参数约束
- 响应结构

#### 输出（DSL）

```json
{
  "scenario": "missing email",
  "type": "negative",
  "request": {
    "body": {
      "name": "Tom"
    }
  },
  "expect": {
    "status": 400
  }
}
```

#### 用例类型

- positive
- negative
- boundary
- auth
- contract

---

### 2.5 用例管理

支持：

- 预览
- 编辑
- 删除
- 保存

---

### 2.6 测试执行

流程：

```
读取 DSL
→ 构造 HTTP 请求
→ 发送请求
→ 断言结果
→ 保存执行结果
```

支持断言：

- 状态码
- JSON 字段
- Schema 校验
- JSONPath

---

### 2.7 测试报告

内容：

- 总数 / 成功 / 失败
- 失败详情
- 请求 / 响应

AI 分析示例：

```
email 格式错误返回 500，说明缺少输入校验
```

---

## 三、系统架构

```
Frontend
 ├── 项目管理
 ├── 接口列表
 ├── 用例管理
 ├── 报告

Backend
 ├── OpenAPI Import
 ├── Schema Parser
 ├── Test Generator (AI)
 ├── Validator
 ├── Executor
 ├── Analyzer

Storage
 ├── PostgreSQL
 ├── JSONB

Worker
 ├── 测试执行任务
```

---

## 四、数据模型

### 4.1 api_project

```sql
CREATE TABLE api_project (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(128),
  openapi_url TEXT,
  base_url TEXT
);
```

---

### 4.2 api_endpoint

```sql
CREATE TABLE api_endpoint (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT,
  method VARCHAR(16),
  path TEXT,
  request_schema JSONB,
  response_schema JSONB
);
```

---

### 4.3 api_test_case

```sql
CREATE TABLE api_test_case (
  id BIGSERIAL PRIMARY KEY,
  endpoint_id BIGINT,
  case_type VARCHAR(32),
  case_dsl JSONB
);
```

---

### 4.4 api_test_run

```sql
CREATE TABLE api_test_run (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT,
  status VARCHAR(32)
);
```

---

### 4.5 api_test_result

```sql
CREATE TABLE api_test_result (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT,
  case_id BIGINT,
  status VARCHAR(32),
  request JSONB,
  response JSONB
);
```

---

## 五、核心流程

### 5.1 用例生成

```
选择接口
→ AI 生成 DSL
→ Validator 校验
→ 保存
```

---

### 5.2 测试执行

```
执行测试
→ 请求接口
→ 校验结果
→ 记录
→ 生成报告
→ AI 分析
```

---

## 六、关键技术设计

### 6.1 AI 使用原则

- 只生成 DSL
- 不直接执行请求

---

### 6.2 Validator

保证：

- 参数合法
- 状态码合理
- 结构匹配

---

### 6.3 执行器

推荐：

- Playwright APIRequest
- 或 Pytest + httpx

---

## 七、安全设计

### 7.1 SSRF 防护

禁止：

- localhost
- 127.0.0.1
- 10.x / 192.168.x

限制：

- 协议仅 http/https

---

### 7.2 环境隔离

- 禁止调用生产环境
- 限制 QPS

---

## 八、MVP 范围

### 必须实现

- OpenAPI 导入
- 接口列表
- AI 生成用例
- 执行测试
- 报告

---

### 暂不实现

- 性能测试
- 分布式执行
- 自动修复

---

## 九、技术选型

| 模块 | 技术 |
|-----|------|
| 前端 | React + TS |
| 后端 | Node.js / Go |
| AI | LLM Structured Output |
| DB | PostgreSQL |
| 执行 | Playwright |
| 队列 | Redis |

---

## 十、设计原则

```
AI 负责生成
Validator 负责约束
Executor 负责执行

系统必须：
可控
可复现
可追踪
```

---

## 结论

这是一个：

```
AI + OpenAPI + 自动化执行引擎
```

驱动的接口测试平台。

核心竞争力在于：

```
结构化 DSL + 强约束执行 + AI 辅助生成
```