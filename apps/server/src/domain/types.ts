import type {
  ParsedParameter,
  ParsedRequestBody,
  ParsedResponse,
} from '@omni-qa/core/openapi/types';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type JobType = 'openapi-import' | 'ai-generation' | 'test-run';

export type JobStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'canceled';

export type TestCaseStatus = 'draft' | 'validated' | 'invalid';

export type TestResultStatus = 'passed' | 'failed' | 'skipped' | 'timed-out';

export interface ApiSpec {
  id: string;
  sourceUrl: string;
  title: string;
  version: string;
  importedAt: string;
  contentHash: string;
  endpointCount: number;
  baseUrl?: string;
}

export interface ApiEndpoint {
  id: string;
  specId: string;
  method: HttpMethod;
  path: string;
  tags: string[];
  parameters: ParsedParameter[];
  responses: ParsedResponse[];
  deprecated: boolean;
  operationId?: string;
  summary?: string;
  description?: string;
  requestBody?: ParsedRequestBody;
}

export interface EndpointSelection {
  id: string;
  specId: string;
  endpointIds: string[];
  createdAt: string;
  name?: string;
}

export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  result?: Record<string, unknown>;
}

export interface TestRequestSpec {
  method: HttpMethod;
  path: string;
  query?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

export interface TestAssertion {
  type: 'status' | 'header' | 'jsonPath' | 'schema' | 'latency';
  operator: 'eq' | 'neq' | 'contains' | 'exists' | 'lt' | 'lte' | 'gt' | 'gte';
  target?: string;
  expected?: unknown;
}

export interface TestCase {
  id: string;
  endpointId: string;
  specId: string;
  name: string;
  scenarioType: 'smoke' | 'positive' | 'negative' | 'boundary' | 'auth';
  priority: 'low' | 'medium' | 'high';
  status: TestCaseStatus;
  request: TestRequestSpec;
  assertions: TestAssertion[];
  tags: string[];
  createdAt: string;
  selectionId?: string;
  model?: string;
  promptVersion?: string;
  validationError?: string;
}

export interface TestRun {
  id: string;
  status: JobStatus;
  envId: string;
  caseIds: string[];
  createdAt: string;
  updatedAt: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  startedAt?: string;
  finishedAt?: string;
  report?: ReportPreview;
  error?: string;
}

export interface ReportPreview {
  htmlReportDir?: string;
  jsonReportPath?: string;
  outputPreview?: string;
}

export interface TestResult {
  id: string;
  runId: string;
  caseId: string;
  endpointId: string;
  status: TestResultStatus;
  durationMs: number;
  createdAt: string;
  responseStatus?: number;
  error?: string;
  assertionFailures?: string[];
}

export interface EndpointFilter {
  tags?: string[];
  methods?: HttpMethod[];
  keyword?: string;
  path?: string;
  operationId?: string;
  limit?: number;
  offset?: number;
}

export interface ServerLimits {
  importMaxBytes: number;
  importTimeoutMs: number;
  parseTimeoutMs: number;
  maxEndpointsPerSpec: number;
  maxSelectionSize: number;
  maxConcurrentRuns: number;
  runTimeoutMs: number;
  maxCasesPerRun: number;
  aiPromptMaxChars: number;
}

export interface ServerConfig {
  host: string;
  port: number;
  dataDir: string;
  limits: ServerLimits;
}
