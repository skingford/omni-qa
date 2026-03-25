import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type {
  AuthConfig,
  BearerTokenAuth,
  DingTalkNotifyConfig,
  EmailNotifyConfig,
  EnvConfig,
  NotifyConfig,
  OmniQAConfig,
  StaticHeaderAuth,
} from '@omni-qa/core';

const CONFIG_FILE = 'omni-qa.config.ts';
const ENV_FILE = '.env';
const ENV_EXAMPLE_FILE = '.env.example';

export interface ConfigEditorState {
  config: OmniQAConfig;
  envText: string;
  paths: {
    configPath: string;
    envPath: string;
  };
}

export function getEditorPaths(cwd = process.cwd()) {
  return {
    configPath: resolve(cwd, CONFIG_FILE),
    envPath: resolve(cwd, ENV_FILE),
    envExamplePath: resolve(cwd, ENV_EXAMPLE_FILE),
  };
}

export async function loadEditorState(cwd = process.cwd()): Promise<ConfigEditorState> {
  const { configPath, envPath, envExamplePath } = getEditorPaths(cwd);

  if (!existsSync(configPath)) {
    throw new Error(
      `Config file not found: ${configPath}. Create it first with "omni-qa init".`
    );
  }

  const rawConfig = await importConfig(configPath);
  const envSourcePath = existsSync(envPath) ? envPath : envExamplePath;
  const envText = existsSync(envSourcePath) ? await readFile(envSourcePath, 'utf8') : '';

  return {
    config: normalizeConfig(rawConfig),
    envText,
    paths: { configPath, envPath },
  };
}

export async function saveEditorState(
  state: ConfigEditorState,
  cwd = process.cwd()
): Promise<ConfigEditorState> {
  const { configPath, envPath } = getEditorPaths(cwd);
  const config = normalizeConfig(state.config);

  validateConfig(config);

  await writeFile(configPath, serializeConfig(config), 'utf8');
  await writeFile(envPath, normalizeEnvText(state.envText), 'utf8');

  return {
    config,
    envText: normalizeEnvText(state.envText),
    paths: { configPath, envPath },
  };
}

async function importConfig(configPath: string): Promise<OmniQAConfig> {
  const url = pathToFileURL(configPath);
  url.searchParams.set('t', String(Date.now()));
  const mod = await import(url.href);
  return (mod.default ?? mod) as OmniQAConfig;
}

function normalizeConfig(raw: OmniQAConfig): OmniQAConfig {
  const envEntries = Object.entries(raw.envs ?? {}).map(([name, env]) => [
    name.trim(),
    normalizeEnvConfig(env),
  ]);

  const config: OmniQAConfig = {
    defaultEnv: String(raw.defaultEnv ?? envEntries[0]?.[0] ?? 'dev').trim(),
    envs: Object.fromEntries(envEntries.filter(([name]) => Boolean(name))),
  };

  const globalHeaders = cleanStringRecord(raw.globalHeaders);
  if (globalHeaders) {
    config.globalHeaders = globalHeaders;
  }

  const notify = normalizeNotifyList(raw.notify);
  if (notify.length > 0) {
    config.notify = notify;
  }

  if (raw.testDir && raw.testDir.trim()) {
    config.testDir = raw.testDir.trim();
  }

  if (raw.reportDir && raw.reportDir.trim()) {
    config.reportDir = raw.reportDir.trim();
  }

  return config;
}

function normalizeEnvConfig(raw: EnvConfig): EnvConfig {
  const envConfig: EnvConfig = {
    baseURL: String(raw.baseURL ?? '').trim(),
  };

  const headers = cleanStringRecord(raw.headers);
  if (headers) {
    envConfig.headers = headers;
  }

  if (raw.auth) {
    envConfig.auth = normalizeAuth(raw.auth);
  }

  return envConfig;
}

function normalizeAuth(raw: AuthConfig): AuthConfig {
  if (raw.type === 'header') {
    const headers = cleanStringRecord(raw.headers) ?? {};
    return {
      type: 'header',
      headers,
    } satisfies StaticHeaderAuth;
  }

  const body = cleanUnknownRecord(raw.login.body);

  return {
    type: 'bearer',
    login: {
      url: String(raw.login.url ?? '').trim(),
      method: raw.login.method === 'GET' ? 'GET' : 'POST',
      tokenPath: String(raw.login.tokenPath ?? '').trim(),
      ...(body ? { body } : {}),
    },
  } satisfies BearerTokenAuth;
}

function normalizeNotifyList(notify: NotifyConfig[] | undefined): NotifyConfig[] {
  return (notify ?? []).map((item) => {
    if (item.type === 'dingtalk') {
      return {
        type: 'dingtalk',
        webhook: String(item.webhook ?? '').trim(),
      } satisfies DingTalkNotifyConfig;
    }

    return {
      type: 'email',
      smtp: {
        host: String(item.smtp.host ?? '').trim(),
        port: Number(item.smtp.port ?? 465),
        secure: Boolean(item.smtp.secure),
        user: String(item.smtp.user ?? '').trim(),
        pass: String(item.smtp.pass ?? '').trim(),
      },
      to: (item.to ?? []).map((entry) => String(entry).trim()).filter(Boolean),
    } satisfies EmailNotifyConfig;
  });
}

function cleanStringRecord(
  input: Record<string, string> | Record<string, unknown> | undefined
): Record<string, string> | undefined {
  const entries = Object.entries(input ?? {})
    .map(([key, value]) => [String(key).trim(), String(value ?? '').trim()] as const)
    .filter(([key, value]) => key.length > 0 && value.length > 0);

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function cleanUnknownRecord(
  input: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  const entries = Object.entries(input ?? {}).filter(([key, value]) => {
    return key.trim().length > 0 && value !== undefined && value !== '';
  });

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function validateConfig(config: OmniQAConfig): void {
  const envNames = Object.keys(config.envs);
  if (envNames.length === 0) {
    throw new Error('At least one environment is required.');
  }

  if (!config.defaultEnv || !config.envs[config.defaultEnv]) {
    throw new Error(`defaultEnv must match one of: ${envNames.join(', ')}`);
  }

  for (const [envName, env] of Object.entries(config.envs)) {
    if (!env.baseURL) {
      throw new Error(`Environment \"${envName}\" must define baseURL.`);
    }

    if (env.auth?.type === 'header' && Object.keys(env.auth.headers).length === 0) {
      throw new Error(`Environment \"${envName}\" uses header auth but no headers were provided.`);
    }

    if (env.auth?.type === 'bearer') {
      if (!env.auth.login.url || !env.auth.login.tokenPath) {
        throw new Error(
          `Environment \"${envName}\" uses bearer auth and requires login.url and login.tokenPath.`
        );
      }
    }
  }

  for (const notify of config.notify ?? []) {
    if (notify.type === 'dingtalk' && !notify.webhook) {
      throw new Error('DingTalk notification requires a webhook URL.');
    }

    if (notify.type === 'email') {
      if (!notify.smtp.host || !notify.smtp.user || !notify.smtp.pass) {
        throw new Error('Email notification requires SMTP host, user, and pass.');
      }
      if (!Number.isFinite(notify.smtp.port) || notify.smtp.port <= 0) {
        throw new Error('Email notification requires a valid SMTP port.');
      }
      if (notify.to.length === 0) {
        throw new Error('Email notification requires at least one recipient.');
      }
    }
  }
}

function normalizeEnvText(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n').trimEnd();
  return normalized ? `${normalized}\n` : '';
}

function serializeConfig(config: OmniQAConfig): string {
  return [
    "import type { OmniQAConfig } from '@omni-qa/core';",
    '',
    `const config: OmniQAConfig = ${JSON.stringify(config, null, 2)};`,
    '',
    'export default config;',
    '',
  ].join('\n');
}
