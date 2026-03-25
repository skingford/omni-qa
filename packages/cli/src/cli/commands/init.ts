import { Command, Option } from 'commander';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  type InitAuthMode,
  type InitTemplateOptions,
  getConfigTemplate,
  getEnvTemplate,
  getPlaywrightConfigTemplate,
} from '../templates/init.js';

interface InitOptions {
  force?: boolean;
  defaultEnv?: string;
  baseUrl?: string;
  auth?: InitAuthMode;
  dingtalk?: boolean;
  email?: boolean;
  skipEnv?: boolean;
}

type InitStatus = 'created' | 'skipped';
type InitSkipReason = 'exists' | 'skip-env';

interface InitFileResult {
  path: string;
  status: InitStatus;
  reason?: InitSkipReason;
}

export const initCommand = new Command('init')
  .description('Scaffold omni-qa config, env, Playwright config, and base folders')
  .option('-f, --force', 'Overwrite omni-qa.config.ts, .env.example, and playwright.config.ts')
  .option('--default-env <name>', 'Default environment name for the starter config', 'dev')
  .option('--base-url <url>', 'Base URL for the scaffolded default environment')
  .addOption(
    new Option('--auth <mode>', 'Authentication scaffold to include')
      .choices(['none', 'header', 'bearer'])
      .default('header')
  )
  .option('--no-dingtalk', 'Exclude DingTalk notification scaffold')
  .option('--no-email', 'Exclude email notification scaffold')
  .option('--skip-env', 'Do not create a local .env file')
  .action(async (options: InitOptions) => {
    try {
      const cwd = process.cwd();
      const configPath = resolve(cwd, 'omni-qa.config.ts');
      const envPath = resolve(cwd, '.env');
      const envExamplePath = resolve(cwd, '.env.example');
      const playwrightConfigPath = resolve(cwd, 'playwright.config.ts');
      const testsDir = resolve(cwd, 'tests/api');
      const reportsDir = resolve(cwd, 'reports');
      const templateOptions = getTemplateOptions(options);

      console.log('\n🧱 Initializing omni-qa project files...\n');

      const fileResults: InitFileResult[] = [];
      fileResults.push(await writeScaffoldFile(configPath, getConfigTemplate(templateOptions), options.force === true));
      fileResults.push(await writeScaffoldFile(envExamplePath, getEnvTemplate(templateOptions), options.force === true));
      fileResults.push(await writeScaffoldFile(playwrightConfigPath, getPlaywrightConfigTemplate(), options.force === true));
      if (options.skipEnv === true) {
        fileResults.push({ path: envPath, status: 'skipped', reason: 'skip-env' });
      } else {
        fileResults.push(await writeScaffoldFile(envPath, getEnvTemplate(templateOptions), false));
      }

      const dirResults = await Promise.all([
        ensureDirectory(testsDir),
        ensureDirectory(reportsDir),
      ]);

      for (const result of fileResults) {
        const icon = result.status === 'created' ? '✓' : '⏭';
        const suffix = result.reason === 'skip-env' ? ' (--skip-env)' : '';
        console.log(`  ${icon} ${result.status}: ${result.path}${suffix}`);
      }

      for (const result of dirResults) {
        const icon = result.status === 'created' ? '✓' : '⏭';
        console.log(`  ${icon} ${result.status}: ${result.path}`);
      }

      console.log('\nNext steps:');
      console.log(`  1. Review omni-qa.config.ts for the "${templateOptions.defaultEnv}" environment`);
      if (options.skipEnv === true) {
        console.log('  2. Copy .env.example to .env when you are ready to add secrets');
      } else {
        console.log('  2. Fill in secrets inside .env');
      }
      console.log('  3. Import an OpenAPI document: omni-qa import <source>');
      console.log(`  4. Run tests: omni-qa run --env ${templateOptions.defaultEnv}`);
      console.log('  5. Open the visual config studio if preferred: omni-qa config\n');

      const envResult = fileResults.find((result) => result.path === envPath);
      if (envResult?.reason === 'exists' && existsSync(envPath)) {
        console.log('ℹ️  Existing .env was kept as-is to avoid overwriting local secrets.\n');
      }
      if (envResult?.reason === 'skip-env') {
        console.log('ℹ️  Local .env creation was skipped because you passed --skip-env.\n');
      }
    } catch (error) {
      console.error(`\n❌ Init failed: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(1);
    }
  });

async function writeScaffoldFile(path: string, content: string, overwrite: boolean): Promise<InitFileResult> {
  if (existsSync(path) && !overwrite) {
    return { path, status: 'skipped', reason: 'exists' };
  }

  await writeFile(path, content, 'utf8');
  return { path, status: 'created' };
}

async function ensureDirectory(path: string): Promise<InitFileResult> {
  if (existsSync(path)) {
    return { path, status: 'skipped' };
  }

  await mkdir(path, { recursive: true });
  return { path, status: 'created' };
}

function getTemplateOptions(options: InitOptions): InitTemplateOptions {
  const defaultEnv = normalizeEnvName(options.defaultEnv);

  return {
    defaultEnv,
    baseUrl: options.baseUrl ?? getDefaultBaseUrl(defaultEnv),
    authMode: options.auth ?? 'header',
    includeDingtalk: options.dingtalk ?? true,
    includeEmail: options.email ?? true,
  };
}

function normalizeEnvName(value?: string): string {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : 'dev';
}

function getDefaultBaseUrl(envName: string): string {
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
