export interface OmniQAConfig {
  envs: Record<string, EnvConfig>;
  defaultEnv: string;
  globalHeaders?: Record<string, string>;
  notify?: NotifyConfig[];
  testDir?: string;
  reportDir?: string;
}

export interface EnvConfig {
  baseURL: string;
  auth?: AuthConfig;
  headers?: Record<string, string>;
}

export type AuthConfig = StaticHeaderAuth | BearerTokenAuth;

export interface StaticHeaderAuth {
  type: 'header';
  headers: Record<string, string>;
}

export interface BearerTokenAuth {
  type: 'bearer';
  login: LoginConfig;
}

export interface LoginConfig {
  url: string;
  method: 'POST' | 'GET';
  body?: Record<string, unknown>;
  tokenPath: string;
}

export type NotifyConfig = DingTalkNotifyConfig | EmailNotifyConfig;

export interface DingTalkNotifyConfig {
  type: 'dingtalk';
  webhook: string;
}

export interface EmailNotifyConfig {
  type: 'email';
  smtp: SmtpConfig;
  to: string[];
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure?: boolean;
  user: string;
  pass: string;
}

export interface TestReport {
  env: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  failures: FailureDetail[];
  timestamp: string;
}

export interface FailureDetail {
  title: string;
  endpoint: string;
  error: string;
}
