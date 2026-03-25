import { Command, Option } from 'commander';
import { existsSync } from 'node:fs';
import type { InitAuthMode } from '../templates/init.js';
import {
  initializeProjectScaffold,
  type InitFileResult,
} from '../../scaffold/init-project.js';

interface InitOptions {
  force?: boolean;
  defaultEnv?: string;
  baseUrl?: string;
  auth?: InitAuthMode;
  dingtalk?: boolean;
  email?: boolean;
  skipEnv?: boolean;
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
      console.log('\n🧱 Initializing omni-qa project files...\n');

      const result = await initializeProjectScaffold({
        force: options.force === true,
        defaultEnv: options.defaultEnv,
        baseUrl: options.baseUrl,
        authMode: options.auth,
        includeDingtalk: options.dingtalk,
        includeEmail: options.email,
        createEnvFile: options.skipEnv !== true,
      });

      for (const item of result.fileResults) {
        const icon = item.status === 'created' ? '✓' : '⏭';
        const suffix = item.reason === 'skip-env' ? ' (--skip-env)' : '';
        console.log(`  ${icon} ${item.status}: ${item.path}${suffix}`);
      }

      for (const item of result.dirResults) {
        const icon = item.status === 'created' ? '✓' : '⏭';
        console.log(`  ${icon} ${item.status}: ${item.path}`);
      }

      console.log('\nNext steps:');
      console.log(`  1. Review omni-qa.config.ts for the "${result.templateOptions.defaultEnv}" environment`);
      if (options.skipEnv === true) {
        console.log('  2. Copy .env.example to .env when you are ready to add secrets');
      } else {
        console.log('  2. Fill in secrets inside .env');
      }
      console.log('  3. Import an OpenAPI document: omni-qa import <source>');
      console.log(`  4. Run tests: omni-qa run --env ${result.templateOptions.defaultEnv}`);
      console.log('  5. Open the visual config studio if preferred: omni-qa config\n');

      const envPath = result.paths.envPath;
      const envResult = result.fileResults.find((item) => item.path === envPath);
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
