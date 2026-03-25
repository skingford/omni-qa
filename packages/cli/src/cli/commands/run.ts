import { Command } from 'commander';
import { runPlaywrightTests } from '../../testing/run-tests.js';

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
        console.log(`\n🚀 Running tests...\n`);
        const result = await runPlaywrightTests({
          env: options.env,
          tag: options.tag,
          retry: options.retry,
          trace: options.trace,
          headed: options.headed,
          workers: options.workers,
          streamOutput: true,
        });

        console.log(`\n  Command: ${result.command}\n`);

        if (result.report.available) {
          console.log(`📊 HTML report ready at ${result.report.htmlDir}\n`);
        }

        if (!result.success) {
          process.exit(result.exitCode || 1);
        }
      } catch {
        process.exit(1);
      }
    }
  );
