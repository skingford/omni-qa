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

export interface ConfigStudioEditorState {
  mode: 'editor'
  config: OmniQAConfigPayload
  envText: string
  paths: ConfigStudioPaths
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
