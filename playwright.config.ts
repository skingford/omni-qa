import { defineConfig } from '@playwright/test';

/**
 * Playwright configuration for omni-qa.
 *
 * Environment is controlled via OMNI_ENV:
 *   OMNI_ENV=staging npx playwright test
 *
 * Or via CLI:
 *   omni-qa run --env staging
 */
export default defineConfig({
  testDir: './tests/api',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['json', { outputFile: 'reports/results.json' }],
  ],

  use: {
    trace: process.env.TRACE === 'on' ? 'on' : 'on-first-retry',
    screenshot: 'only-on-failure',
  },
});
