# Tasks: API 自动化测试平台 V1

## 1. 项目初始化
- [x] 初始化 npm 项目，安装依赖（@playwright/test, commander, @apidevtools/swagger-parser, handlebars, nodemailer, dotenv, tsx）
- [x] 配置 tsconfig.json
- [x] 创建目录结构（src/, tests/, reports/）
- [x] 创建 .env.example 模板

## 2. 配置系统
- [x] 定义配置类型 src/config/types.ts（OmniQAConfig, EnvConfig, AuthConfig, NotifyConfig）
- [x] 实现配置加载器 src/config/loader.ts（读取 omni-qa.config.ts + .env 文件 + 环境变量插值）
- [x] 创建示例配置 omni-qa.config.example.ts

## 3. OpenAPI 解析
- [x] 实现远程文档获取 src/openapi/fetcher.ts（支持 URL 下载 + 本地文件读取）
- [x] 实现 OpenAPI 解析器 src/openapi/parser.ts（解析 paths/schemas/auth，输出结构化接口清单）
- [x] 定义解析后的接口类型 src/openapi/types.ts

## 4. 测试用例生成
- [x] 创建 .spec.ts Handlebars 模板 src/generator/templates/api-spec.hbs
- [x] 实现生成器 src/generator/index.ts（读取接口清单 → 按 tag/path 分组 → 生成 .spec.ts 文件）

## 5. Fixture 层
- [ ] 实现认证 Fixture src/fixtures/auth.fixture.ts（静态 Header 模式 + 登录获取 Token 模式）
- [ ] 实现 API Client Fixture src/fixtures/api-client.fixture.ts（封装 APIRequestContext + 自动注入 headers）
- [ ] 聚合导出 src/fixtures/index.ts（test.extend 合并所有 fixture）

## 6. 公共断言
- [ ] 实现自定义 matchers src/assertions/api-matchers.ts（toMatchSchema, toBeSuccessful 等）

## 7. Playwright 配置
- [ ] 创建 playwright.config.ts（集成环境切换、retry、trace、reporter、项目配置）

## 8. 通知系统
- [ ] 实现钉钉通知 src/reporters/dingtalk.ts（Webhook Markdown 消息卡片）
- [ ] 实现邮件通知 src/reporters/email.ts（SMTP HTML 邮件）
- [ ] 实现通知 Reporter src/reporters/notifier.reporter.ts（Playwright Reporter 接口，收集结果后触发通知）

## 9. CLI
- [ ] 搭建 CLI 框架 src/cli/index.ts（Commander.js 主入口 + bin 配置）
- [ ] 实现 import 命令 src/cli/commands/import.ts（omni-qa import <source> --out --tag）
- [ ] 实现 run 命令 src/cli/commands/run.ts（omni-qa run --env --tag --retry --trace）
- [ ] 实现 report 命令 src/cli/commands/report.ts（omni-qa report 打开 HTML 报告）

## 10. 集成测试与文档
- [ ] 用 Petstore OpenAPI 文档做端到端验证（import → run → report → notify）
- [ ] 编写 README.md 使用说明
