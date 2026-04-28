## Context

omni-qa is currently a Bun workspace with a TypeScript core package, a CLI package, and a Vue config studio. The existing path is CLI-first: `omni-qa import <source>` parses an OpenAPI document and generates Playwright `.spec.ts` files, while `omni-qa run` executes tests through Playwright and writes reports.

The requested workflow needs a user-facing closed loop: users submit an OpenAPI/Swagger URL, inspect imported endpoints, select endpoints, ask AI to generate targeted cases, and execute those cases automatically. Because the project already uses TypeScript and Playwright, the backend for this workflow should be Node.js/TypeScript rather than Go.

## Goals / Non-Goals

**Goals:**

- Add a Node.js backend service for import, catalog, AI generation, and execution orchestration.
- Preserve existing parser, generator, Playwright fixture, reporter, and CLI execution investments.
- Store normalized OpenAPI specs, endpoints, selected endpoints, generated test cases, runs, and results behind repository interfaces.
- Generate structured test case JSON first, then convert it to controlled Playwright execution artifacts.
- Make every long-running operation observable as a job with status, timing, errors, and report references.
- Keep provider-specific AI SDKs behind adapters so domain models remain stable.

**Non-Goals:**

- Replacing Playwright with a custom runner in the first implementation.
- Building a full multi-tenant permission system in this change.
- Guaranteeing semantic correctness of every AI-generated assertion without user review.
- Supporting arbitrary user-provided executable code as test cases.
- Requiring a production database in the first local-first implementation.

## Decisions

### Decision 1: Add `apps/server` as the Node.js orchestration backend

The backend should live in a new `apps/server` workspace package. It exposes HTTP APIs for the config studio and calls shared packages for parsing, generation, and execution.

Alternatives considered:

- Put HTTP server code in `packages/cli`: rejected because CLI command concerns and long-running platform API concerns would become coupled.
- Put everything in `apps/config-studio`: rejected because browser UI should not own OpenAPI fetching, AI secrets, execution processes, or persistence.

### Decision 2: Use repository interfaces with a file-backed first implementation

The service layer should depend on interfaces such as `SpecRepository`, `EndpointRepository`, `CaseRepository`, `RunRepository`, and `JobRepository`. The first implementation can write JSON files under a local data directory. A later SQLite/PostgreSQL implementation can replace it without changing services.

Alternatives considered:

- Use only in-memory storage: rejected because import/generation/run history would vanish after restart and make the UI workflow fragile.
- Require PostgreSQL immediately: rejected because this repo is currently local-first and CLI-friendly.

### Decision 3: Model AI output as a JSON test case DSL

AI must produce structured test cases, not executable TypeScript. The service validates the model output before saving or executing it.

The DSL includes:

- request method/path/query/headers/body
- preconditions or variable references
- assertions for status, headers, JSON paths, schema presence, and latency
- metadata such as endpoint id, scenario type, priority, model, and prompt version

Alternatives considered:

- Ask AI to generate `.spec.ts` directly: rejected due to code injection, inconsistent style, and brittle execution.
- Use only deterministic examples from OpenAPI schemas: rejected because it misses negative, boundary, auth, and business-rule scenarios where AI adds value.

### Decision 4: Reuse Playwright as the execution adapter

The first execution adapter converts validated test case DSL into generated Playwright specs or a temporary dynamic spec file, then calls the existing Playwright execution helper. This preserves current authentication fixtures, environment config, retries, trace, HTML report, and JSON report behavior.

Alternatives considered:

- Build a pure Node HTTP executor: useful later for fast smoke runs, but it would duplicate assertion/reporting/retry behavior in the first version.
- Build a Go runner: rejected for this project because the user confirmed backend should be Node.js when needed.

### Decision 5: Treat import, generation, and execution as jobs

Each long-running step should create a job with `pending`, `running`, `succeeded`, `failed`, or `canceled` status. The UI can poll status initially, with Server-Sent Events or WebSocket added later.

Alternatives considered:

- Run the full workflow synchronously in HTTP requests: rejected because large specs, AI latency, and Playwright execution can exceed request timeouts.

## Data Model

Core entities:

- `ApiSpec`: imported document metadata, source URL, title, version, base URL, hash, imported time.
- `ApiEndpoint`: normalized endpoint, method, path, operationId, tags, parameters, requestBody, responses, deprecated flag.
- `EndpointSelection`: a named or ad-hoc set of endpoint ids selected by a user.
- `TestCase`: structured AI-generated or deterministic case DSL associated with one endpoint.
- `TestRun`: run metadata, environment, status, totals, timings, output/report paths.
- `TestResult`: per-case outcome, status, duration, error message, response snapshot, assertion failures.
- `Job`: async task state for import, generation, and execution.

Repository implementations must write arrays with preallocated data structures where possible and avoid retaining full raw OpenAPI payloads in memory after normalization.

## API Boundary

Proposed HTTP endpoints:

- `POST /api/openapi/import`: create import job from URL.
- `GET /api/jobs/:jobId`: read async job status.
- `GET /api/specs`: list imported specs.
- `GET /api/specs/:specId/endpoints`: list/filter selectable endpoints.
- `POST /api/selections`: save selected endpoint ids.
- `POST /api/test-cases/generate`: create AI generation job for selected endpoints.
- `GET /api/test-cases`: list generated cases by spec, endpoint, or selection.
- `POST /api/test-runs`: execute selected/generated cases.
- `GET /api/test-runs/:runId`: read run summary.
- `GET /api/test-runs/:runId/results`: read per-case results.
- `GET /api/test-runs/:runId/report`: read report preview paths.

## Core Flow

1. UI submits an OpenAPI URL.
2. Server creates an import job and fetches/parses the document through the existing OpenAPI parser.
3. Server saves `ApiSpec` and `ApiEndpoint[]`.
4. UI lists endpoints and lets the user filter by tag, method, path, operation id, or keyword.
5. UI submits selected endpoint ids for AI generation.
6. Server loads selected endpoints, builds a bounded prompt, calls the configured AI adapter, validates JSON DSL, and saves test cases.
7. UI reviews or accepts generated cases.
8. UI starts a test run.
9. Server adapts test cases to Playwright, executes with configured environment/auth, captures report paths and JSON result output.
10. UI shows summary, per-case failures, report link, and optional AI repair suggestions.

## Risks / Trade-offs

- Large OpenAPI documents can cause high memory use -> enforce download size limits, parse timeouts, endpoint count limits, and avoid storing raw payloads by default.
- AI can return malformed or unsafe output -> require JSON schema validation and reject arbitrary code.
- AI-generated payloads may include secrets from examples -> redact sensitive fields before prompt construction and before persistence.
- Test execution can overload target systems -> add per-run and per-host concurrency limits, worker caps, and request timeouts.
- File-backed storage can suffer from concurrent writes -> serialize writes per repository file and keep atomic write/rename semantics.
- Generated Playwright specs can conflict with user-edited files -> write AI run artifacts to an isolated generated/runtime directory.
- Polling can become noisy -> start with polling and add SSE when job volume warrants it.

## Migration Plan

1. Add repository interfaces and file-backed storage under the new server package.
2. Add import job API and connect it to the existing OpenAPI parser.
3. Add endpoint catalog API and update config studio to list/filter/select endpoints.
4. Add AI generation service and JSON DSL validation.
5. Add Playwright execution adapter and run/result APIs.
6. Add report preview integration using existing report path helpers.
7. Add tests for service logic and adapters.

Rollback is straightforward because the change is additive. Existing CLI commands and generated tests remain untouched. If the backend workflow is disabled, users can continue using `omni-qa import` and `omni-qa run`.

## Open Questions

- Which AI provider should be the first supported adapter in production?
- Should first local storage use JSON files only, or should SQLite be introduced immediately for better concurrent access?
- Should users approve generated test cases before execution by default, or can trusted workspaces enable auto-run?
- How much response body data should be retained for failed test debugging without leaking sensitive data?
