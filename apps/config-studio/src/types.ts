export interface ConfigStudioPaths {
  configPath: string
  envPath: string
}

export type InitAuthMode = 'none' | 'header' | 'bearer'

export interface OmniQAConfigPayload {
  defaultEnv: string
  envs: Record<string, EnvConfigPayload>
  globalHeaders?: Record<string, string>
  notify?: NotifyConfigPayload[]
  testDir?: string
  reportDir?: string
}

export interface EnvConfigPayload {
  baseURL: string
  auth?: AuthPayload
  headers?: Record<string, string>
}

export type AuthPayload = HeaderAuthPayload | BearerAuthPayload

export interface HeaderAuthPayload {
  type: 'header'
  headers: Record<string, string>
}

export interface BearerAuthPayload {
  type: 'bearer'
  login: {
    url: string
    method: 'POST' | 'GET'
    tokenPath: string
    body?: Record<string, unknown>
  }
}

export type NotifyConfigPayload = DingTalkNotifyPayload | EmailNotifyPayload

export interface DingTalkNotifyPayload {
  type: 'dingtalk'
  webhook: string
}

export interface EmailNotifyPayload {
  type: 'email'
  smtp: {
    host: string
    port: number
    secure: boolean
    user: string
    pass: string
  }
  to: string[]
}

export interface BootstrapFormState {
  defaultEnv: string
  baseUrl: string
  authMode: InitAuthMode
  includeDingtalk: boolean
  includeEmail: boolean
  createEnvFile: boolean
}

export interface ReportPreviewState {
  rootDir: string
  htmlDir: string
  htmlIndexPath: string
  jsonPath: string
  available: boolean
  jsonExists: boolean
  reportUrl: string
}

export interface ConfigStudioEditorState {
  mode: 'editor'
  config: OmniQAConfigPayload
  envText: string
  paths: ConfigStudioPaths
  report: ReportPreviewState
}

export interface ConfigStudioBootstrapState {
  mode: 'bootstrap'
  bootstrap: BootstrapFormState
  paths: ConfigStudioPaths
}

export type ConfigStudioState = ConfigStudioEditorState | ConfigStudioBootstrapState

export interface ConfigStudioSavePayload {
  config: OmniQAConfigPayload
  envText: string
}

export interface ConfigStudioBootstrapPayload extends BootstrapFormState {}

export interface ConfigStudioImportPayload {
  source: string
  outDir: string
  tags: string[]
  force: boolean
}

export interface ConfigStudioImportResult {
  source: string
  apiTitle: string
  apiVersion: string
  endpointCount: number
  outDir: string
  tags: string[]
  groups: Array<{
    name: string
    endpoints: number
  }>
  generatedFiles: string[]
}

export interface ConfigStudioRunPayload {
  env?: string
  tag?: string
  retry: string
  trace: boolean
  headed: boolean
  workers?: string
}

export interface ConfigStudioRunResult {
  command: string
  success: boolean
  exitCode: number
  durationMs: number
  output: string
  report: ReportPreviewState
}

export interface ConfigStudioRunSession {
  id: string
  command: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  success: boolean | null
  exitCode: number | null
  durationMs: number
  startedAt: string
  completedAt: string | null
  output: string
  report: ReportPreviewState | null
}

export interface StudioFormState {
  defaultEnv: string
  testDir: string
  reportDir: string
  globalHeadersText: string
  envs: EnvFormItem[]
  notifications: NotificationFormItem[]
  envText: string
}

export interface EnvFormItem {
  id: string
  name: string
  baseURL: string
  headersText: string
  authType: InitAuthMode
  authHeadersText: string
  loginUrl: string
  loginMethod: 'POST' | 'GET'
  tokenPath: string
  loginBodyText: string
}

export interface NotificationFormItem {
  id: string
  type: 'dingtalk' | 'email'
  webhook: string
  recipientsText: string
  smtpHost: string
  smtpPort: string
  smtpSecure: 'true' | 'false'
  smtpUser: string
  smtpPass: string
}

export type StatusType = 'success' | 'error' | 'info'

export type ClosedLoopJobStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'canceled'

export interface ClosedLoopJob {
  id: string
  type: 'openapi-import' | 'ai-generation' | 'test-run'
  status: ClosedLoopJobStatus
  createdAt: string
  updatedAt: string
  startedAt?: string
  finishedAt?: string
  error?: string
  result?: Record<string, unknown>
}

export interface ClosedLoopSpec {
  id: string
  sourceUrl: string
  title: string
  version: string
  importedAt: string
  contentHash: string
  endpointCount: number
  baseUrl?: string
}

export interface ClosedLoopEndpoint {
  id: string
  specId: string
  method: string
  path: string
  tags: string[]
  parameters: unknown[]
  responses: unknown[]
  deprecated: boolean
  operationId?: string
  summary?: string
  description?: string
  requestBody?: unknown
}

export interface ClosedLoopSelection {
  id: string
  specId: string
  endpointIds: string[]
  createdAt: string
  name?: string
}

export interface ClosedLoopTestCase {
  id: string
  endpointId: string
  specId: string
  name: string
  scenarioType: string
  priority: string
  status: string
  request: {
    method: string
    path: string
    query?: Record<string, string | number | boolean>
    headers?: Record<string, string>
    body?: unknown
    timeoutMs?: number
  }
  assertions: unknown[]
  tags: string[]
  createdAt: string
  selectionId?: string
  model?: string
  promptVersion?: string
}

export interface ClosedLoopRun {
  id: string
  status: ClosedLoopJobStatus
  envId: string
  caseIds: string[]
  createdAt: string
  updatedAt: string
  total: number
  passed: number
  failed: number
  skipped: number
  startedAt?: string
  finishedAt?: string
  report?: {
    htmlReportDir?: string
    jsonReportPath?: string
    outputPreview?: string
  }
  error?: string
}

export interface ClosedLoopResult {
  id: string
  runId: string
  caseId: string
  endpointId: string
  status: string
  durationMs: number
  createdAt: string
  responseStatus?: number
  error?: string
  assertionFailures?: string[]
}
