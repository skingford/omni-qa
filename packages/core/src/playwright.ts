import { defineConfig, type PlaywrightTestConfig } from '@playwright/test';

export interface OmniPlaywrightConfigOptions {
  reportDir?: string;
  testDir?: string;
}

export function createOmniPlaywrightConfig(
  options: OmniPlaywrightConfigOptions = {}
): PlaywrightTestConfig {
  const reportDir = options.reportDir ?? 'reports';
  const testDir = options.testDir ?? './tests/api';

  return defineConfig({
    testDir,
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,

    reporter: [
      ['list'],
      ['html', { outputFolder: `${reportDir}/html`, open: 'never' }],
      ['json', { outputFile: `${reportDir}/results.json` }],
    ],

    use: {
      trace: process.env.TRACE === 'on' ? 'on' : 'on-first-retry',
      screenshot: 'only-on-failure',
    },
  });
}
