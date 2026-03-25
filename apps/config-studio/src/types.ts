export interface ConfigStudioPaths {
  configPath: string
  envPath: string
}

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

export interface ConfigStudioState {
  config: OmniQAConfigPayload
  envText: string
  paths: ConfigStudioPaths
}

export interface ConfigStudioSavePayload {
  config: OmniQAConfigPayload
  envText: string
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
  authType: 'none' | 'header' | 'bearer'
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

export type StatusType = 'success' | 'error'
