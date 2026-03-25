import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  getConfigTemplate,
  getEnvTemplate,
  getPlaywrightConfigTemplate,
  type InitAuthMode,
  type InitTemplateOptions,
} from '../cli/templates/init.js';

export interface InitProjectOptions {
  cwd?: string;
  force?: boolean;
  defaultEnv?: string;
  baseUrl?: string;
  authMode?: InitAuthMode;
  includeDingtalk?: boolean;
  includeEmail?: boolean;
  createEnvFile?: boolean;
}

export type InitStatus = 'created' | 'skipped';
export type InitSkipReason = 'exists' | 'skip-env';

export interface InitFileResult {
  path: string;
  status: InitStatus;
  reason?: InitSkipReason;
}

export interface InitProjectResult {
  cwd: string;
  templateOptions: InitTemplateOptions;
  fileResults: InitFileResult[];
  dirResults: InitFileResult[];
  paths: {
    configPath: string;
    envPath: string;
    envExamplePath: string;
    playwrightConfigPath: string;
    testsDir: string;
    reportsDir: string;
  };
}

export async function initializeProjectScaffold(
  options: InitProjectOptions = {},
): Promise<InitProjectResult> {
  const cwd = options.cwd ?? process.cwd();
  const templateOptions = buildInitTemplateOptions(options);
  const force = options.force === true;
  const createEnvFile = options.createEnvFile !== false;

  const configPath = resolve(cwd, 'omni-qa.config.ts');
  const envPath = resolve(cwd, '.env');
  const envExamplePath = resolve(cwd, '.env.example');
  const playwrightConfigPath = resolve(cwd, 'playwright.config.ts');
  const testsDir = resolve(cwd, 'tests/api');
  const reportsDir = resolve(cwd, 'reports');

  const fileResults: InitFileResult[] = [];
  fileResults.push(await writeScaffoldFile(configPath, getConfigTemplate(templateOptions), force));
  fileResults.push(await writeScaffoldFile(envExamplePath, getEnvTemplate(templateOptions), force));
  fileResults.push(await writeScaffoldFile(playwrightConfigPath, getPlaywrightConfigTemplate(), force));

  if (createEnvFile) {
    fileResults.push(await writeScaffoldFile(envPath, getEnvTemplate(templateOptions), false));
  } else {
    fileResults.push({ path: envPath, status: 'skipped', reason: 'skip-env' });
  }

  const dirResults = await Promise.all([
    ensureDirectory(testsDir),
    ensureDirectory(reportsDir),
  ]);

  return {
    cwd,
    templateOptions,
    fileResults,
    dirResults,
    paths: {
      configPath,
      envPath,
      envExamplePath,
      playwrightConfigPath,
      testsDir,
      reportsDir,
    },
  };
}

export function getDefaultInitTemplateOptions(): InitTemplateOptions {
  return {
    defaultEnv: 'dev',
    baseUrl: 'https://dev-api.example.com',
    authMode: 'header',
    includeDingtalk: true,
    includeEmail: true,
  };
}

export function buildInitTemplateOptions(
  options: Omit<InitProjectOptions, 'cwd' | 'force' | 'createEnvFile'> = {},
): InitTemplateOptions {
  const defaultEnv = normalizeEnvName(options.defaultEnv);

  return {
    defaultEnv,
    baseUrl: options.baseUrl ?? getDefaultBaseUrl(defaultEnv),
    authMode: options.authMode ?? 'header',
    includeDingtalk: options.includeDingtalk ?? true,
    includeEmail: options.includeEmail ?? true,
  };
}

export function getDefaultBaseUrl(envName: string): string {
  const envSlug = envName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (envSlug === 'prod' || envSlug === 'production') {
    return 'https://api.example.com';
  }

  if (envSlug === 'staging') {
    return 'https://staging-api.example.com';
  }

  if (envSlug.length === 0) {
    return 'https://dev-api.example.com';
  }

  return `https://${envSlug}-api.example.com`;
}

function normalizeEnvName(value?: string): string {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : 'dev';
}

async function writeScaffoldFile(
  path: string,
  content: string,
  overwrite: boolean,
): Promise<InitFileResult> {
  if (existsSync(path) && !overwrite) {
    return { path, status: 'skipped', reason: 'exists' };
  }

  await writeFile(path, content, 'utf8');
  return { path, status: 'created' };
}

async function ensureDirectory(path: string): Promise<InitFileResult> {
  if (existsSync(path)) {
    return { path, status: 'skipped', reason: 'exists' };
  }

  await mkdir(path, { recursive: true });
  return { path, status: 'created' };
}
