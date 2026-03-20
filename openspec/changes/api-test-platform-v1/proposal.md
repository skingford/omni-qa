# API 自动化测试平台 V1

## Summary

基于 Playwright + @playwright/test 搭建通用接口自动化测试平台。支持导入 OpenAPI 文档（本地文件或在线链接），自动解析接口并生成测试用例文件，配置认证和请求头，执行测试后生成报告并通知到钉钉/邮箱。

## Motivation

手动测试接口效率低、覆盖不全，需要一个标准化的自动化测试平台来：
- 快速从 OpenAPI 文档生成测试用例
- 统一管理多环境配置和认证信息
- 自动执行并产出可视化报告
- 集成 CI/CD 和通知系统

## Architecture

四层架构：

- **底层执行层**：直接用 @playwright/test，不自己写 test runner
- **业务封装层**：API Client 封装、认证 Fixture、公共断言
- **平台能力层**：环境切换、标签过滤、失败重试、截图/Trace、报告聚合、通知
- **接入层**：CLI 命令、CI/CD 集成

## Tech Stack

- TypeScript
- @playwright/test（测试执行引擎）
- Commander.js（CLI）
- swagger-parser（OpenAPI 解析）
- Handlebars（模板生成）
- nodemailer（邮件通知）

## Scope

### In Scope (V1)
- OpenAPI 导入（本地文件 .yaml/.json + 在线 URL）
- 解析接口列表，生成 .spec.ts 测试文件
- 认证配置（静态 Header + 登录获取 Token）
- 环境切换（dev/staging/prod）
- 全局/环境级 Headers
- 环境变量 + .env 文件支持
- 基础报告（Playwright HTML Reporter）
- 钉钉 Webhook + 邮箱 SMTP 通知
- CLI 命令（import / run / report）
- 失败重试 + 截图/Trace
- 标签过滤

### Out of Scope (V2+)
- Web 管理界面
- AI 辅助生成测试场景
- E2E 页面测试
- 链式业务流测试
- 报告历史对比
- 飞书/企微/Slack 通知
- 定时任务编排
- 质量门禁（覆盖率阈值）
- 多项目管理
- OAuth 2.0 认证
