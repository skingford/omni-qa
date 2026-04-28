## Why

The current platform can import OpenAPI documents and generate Playwright test files, but it does not yet provide an interactive closed loop where users import an API URL, select specific endpoints, ask AI to generate targeted test cases, and execute those cases from one workflow.

This change turns omni-qa from a CLI-oriented generator into a Node.js-backed API testing platform workflow while preserving the existing TypeScript/Bun and Playwright execution foundation.

## What Changes

- Add a Node.js service boundary for OpenAPI import jobs, endpoint catalog queries, AI test case generation jobs, and execution jobs.
- Persist imported API specs, normalized endpoints, user-selected endpoint sets, generated test cases, test runs, and per-case results.
- Extend the OpenAPI import flow to support URL-based import, version/hash tracking, endpoint listing, and selection-friendly metadata.
- Introduce an AI test case generator that produces structured test case JSON instead of arbitrary executable code.
- Adapt generated test cases into controlled Playwright execution using the existing omni-qa runner/reporting path.
- Add workflow status APIs so the UI can show import, generation, execution, and report states.
- Add safety constraints for URL import limits, prompt construction, model output validation, secret handling, and execution concurrency.

## Capabilities

### New Capabilities

- `openapi-endpoint-catalog`: Import OpenAPI/Swagger documents from URL, normalize endpoints, persist API specs, and expose selectable endpoint lists.
- `ai-test-case-generation`: Generate structured API test cases for selected endpoints using AI with validation, prompt versioning, and safe output constraints.
- `automated-test-execution`: Execute selected/generated API test cases, collect results, expose run status, and connect reports back to the selected endpoints.

### Modified Capabilities

None.

## Impact

- Affected packages:
  - `packages/core/src/openapi/*`: reuse and extend parser output for catalog persistence.
  - `packages/core/src/generator/*`: add structured test case generation/adaptation path alongside static `.spec.ts` generation.
  - `packages/cli/src/testing/*`: reuse Playwright execution helpers as the first execution adapter.
  - `apps/config-studio/*`: extend UI to import specs, select endpoints, generate cases, and view run status.
  - New Node.js backend app, proposed as `apps/server`.
- Data/storage:
  - New repositories for specs, endpoints, selections, AI-generated cases, runs, and results.
  - Initial implementation may use file-backed JSON storage for local-first development, with repository interfaces ready for SQLite/PostgreSQL.
- Dependencies:
  - Prefer existing TypeScript/Bun dependencies.
  - Backend HTTP framework can be Hono or Fastify; keep service interfaces framework-independent.
  - AI provider integration must be adapter-based and must not leak provider-specific SDK types into domain models.
