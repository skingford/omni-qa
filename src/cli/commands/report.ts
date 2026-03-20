import { Command } from 'commander';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export const reportCommand = new Command('report')
  .description('Open the latest HTML test report')
  .option('-d, --dir <dir>', 'Report directory', 'reports/html')
  .action((options: { dir: string }) => {
    const reportDir = resolve(process.cwd(), options.dir);

    if (!existsSync(reportDir)) {
      console.error(`\n❌ Report not found: ${reportDir}`);
      console.error('   Run tests first: omni-qa run\n');
      process.exit(1);
    }

    console.log(`\n📊 Opening report: ${reportDir}\n`);

    execSync(`npx playwright show-report ${reportDir}`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
  });
