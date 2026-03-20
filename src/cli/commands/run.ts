import { Command } from 'commander';
import { execSync } from 'node:child_process';

export const runCommand = new Command('run')
  .description('Run API tests with Playwright')
  .option('-e, --env <env>', 'Target environment (dev/staging/prod)')
  .option('-t, --tag <tag>', 'Filter tests by tag (e.g. @smoke)')
  .option('-r, --retry <count>', 'Retry failed tests N times', '0')
  .option('--trace', 'Enable trace recording')
  .option('--headed', 'Run in headed mode (for debugging)')
  .option('-w, --workers <count>', 'Number of parallel workers')
  .action(
    async (options: {
      env?: string;
      tag?: string;
      retry: string;
      trace?: boolean;
      headed?: boolean;
      workers?: string;
    }) => {
      try {
        const args: string[] = ['npx', 'playwright', 'test'];

        // Environment
        const envVars: Record<string, string> = {};
        if (options.env) {
          envVars.OMNI_ENV = options.env;
        }

        // Tag filter
        if (options.tag) {
          args.push('--grep', options.tag);
        }

        // Retry
        if (options.retry !== '0') {
          args.push('--retries', options.retry);
        }

        // Trace
        if (options.trace) {
          envVars.TRACE = 'on';
        }

        // Workers
        if (options.workers) {
          args.push('--workers', options.workers);
        }

        const envStr = Object.entries(envVars)
          .map(([k, v]) => `${k}=${v}`)
          .join(' ');

        const command = envStr ? `${envStr} ${args.join(' ')}` : args.join(' ');

        console.log(`\n🚀 Running tests...\n`);
        console.log(`  Command: ${command}\n`);

        execSync(command, {
          stdio: 'inherit',
          cwd: process.cwd(),
          env: { ...process.env, ...envVars },
        });
      } catch {
        // Playwright exits with non-zero on test failures; that's expected
        process.exit(1);
      }
    }
  );
