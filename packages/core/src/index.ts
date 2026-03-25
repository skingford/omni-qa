export type {
  AuthConfig,
  BearerTokenAuth,
  DingTalkNotifyConfig,
  EmailNotifyConfig,
  EnvConfig,
  FailureDetail,
  LoginConfig,
  NotifyConfig,
  OmniQAConfig,
  SmtpConfig,
  StaticHeaderAuth,
  TestReport,
} from './config/types.js';

export { getEnvConfig, loadConfig } from './config/loader.js';
export { createOmniPlaywrightConfig } from './playwright.js';
export type { OmniPlaywrightConfigOptions } from './playwright.js';
