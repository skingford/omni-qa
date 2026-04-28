## 1. Server Workspace Setup

- [x] 1.1 Create `apps/server` workspace package with TypeScript config, package scripts, and shared workspace imports.
- [x] 1.2 Add HTTP server bootstrap with health check and configurable host, port, data directory, and execution limits.
- [x] 1.3 Define domain models for specs, endpoints, selections, jobs, test cases, test runs, and test results.
- [x] 1.4 Define repository interfaces and file-backed JSON repository implementations with atomic writes.
- [x] 1.5 Add service-level error types and HTTP error mapping for validation, not found, conflict, and internal failures.

## 2. OpenAPI Endpoint Catalog

- [x] 2.1 Implement import job service that validates URL scheme, creates a job, and runs import asynchronously.
- [x] 2.2 Reuse `parseOpenAPI` to normalize imported specs and endpoint records.
- [x] 2.3 Add import limits for download size, parse duration, and maximum endpoint count.
- [x] 2.4 Persist `ApiSpec` metadata and `ApiEndpoint` records with stable identifiers.
- [x] 2.5 Implement `POST /api/openapi/import`, `GET /api/jobs/:jobId`, and `GET /api/specs`.
- [x] 2.6 Implement `GET /api/specs/:specId/endpoints` with tag, method, keyword, path, and operationId filters.
- [x] 2.7 Implement `POST /api/selections` with validation that endpoint ids belong to the requested spec.
- [x] 2.8 Add unit tests for successful import, invalid URL rejection, empty document failure, and endpoint filtering.

## 3. AI Test Case Generation

- [x] 3.1 Define the structured test case DSL and runtime validation schema.
- [x] 3.2 Implement prompt builder using endpoint metadata, schemas, examples, generation policy, and prompt size limits.
- [x] 3.3 Implement sensitive field redaction for prompt input and persisted generated data.
- [x] 3.4 Add AI provider adapter interface and a deterministic fallback generator.
- [x] 3.5 Implement generation job service for saved selections and direct endpoint id lists.
- [x] 3.6 Persist generated test cases with endpoint id, model, prompt version, scenario type, and validation status.
- [x] 3.7 Implement `POST /api/test-cases/generate` and `GET /api/test-cases`.
- [x] 3.8 Add unit tests for valid AI output, malformed output rejection, executable code rejection, and fallback generation.

## 4. Automated Test Execution

- [x] 4.1 Implement Playwright execution adapter that converts validated DSL to isolated runtime spec artifacts.
- [x] 4.2 Reuse existing environment/auth configuration and `runPlaywrightTests` execution helper.
- [x] 4.3 Implement run job service with queued, running, succeeded, failed, and canceled states.
- [x] 4.4 Enforce concurrent run, worker count, timeout, and per-run case count limits.
- [x] 4.5 Parse Playwright JSON results into persisted per-case `TestResult` records.
- [x] 4.6 Implement `POST /api/test-runs`, `GET /api/test-runs/:runId`, `GET /api/test-runs/:runId/results`, and `GET /api/test-runs/:runId/report`.
- [x] 4.7 Add cancellation support for queued jobs and best-effort cancellation for running Playwright processes.
- [x] 4.8 Add tests for successful run, failing assertion capture, empty case rejection, and concurrency limit behavior.

## 5. Config Studio UI

- [x] 5.1 Add API client methods for import jobs, specs, endpoint listing, selections, generation jobs, cases, runs, and results.
- [x] 5.2 Add OpenAPI URL import view with job status feedback.
- [x] 5.3 Add endpoint catalog view with filtering, grouping by tag, and multi-select.
- [x] 5.4 Add AI generation view showing selected endpoints, generated cases, validation status, and fallback status.
- [x] 5.5 Add execution view for environment selection, run progress, summary counts, failed case details, and report links.
- [x] 5.6 Add empty, loading, error, canceled, and retry states for each workflow step.

## 6. Integration And Documentation

- [x] 6.1 Add an end-to-end smoke flow using the Petstore OpenAPI URL: import, select endpoints, generate fallback cases, execute, and read report.
- [x] 6.2 Document backend configuration, AI provider configuration, data directory layout, and execution limits.
- [x] 6.3 Update README with the new closed-loop workflow and commands to run `apps/server` plus `apps/config-studio`.
- [x] 6.4 Add OpenSpec validation and package test scripts to the verification checklist.
- [x] 6.5 Verify existing CLI import/run commands still work after the new backend additions.
