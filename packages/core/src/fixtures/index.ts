import { test as base, expect } from '@playwright/test';
import { loadConfig, getEnvConfig } from '../config/loader.js';
import { resolveAuthHeaders } from './auth.fixture.js';
import { APIClient } from './api-client.fixture.js';
import type { OmniQAConfig, EnvConfig } from '../config/types.js';

type OmniQAFixtures = {
  omniConfig: OmniQAConfig;
  envConfig: EnvConfig;
  activeEnv: string;
  apiClient: APIClient;
};

/**
 * Extended Playwright test with omni-qa fixtures.
 *
 * Usage in test files:
 *   import { test, expect } from '@omni-qa/core/testing';
 *
 *   test('GET /users', async ({ apiClient }) => {
 *     const res = await apiClient.get('/users');
 *     expect(res.ok()).toBeTruthy();
 *   });
 */
export const test = base.extend<{}, OmniQAFixtures>({
  // Worker-scoped: loaded once per worker
  omniConfig: [async ({}, use) => {
    const env = process.env.OMNI_ENV;
    const config = await loadConfig(env);
    await use(config);
  }, { scope: 'worker' }],

  activeEnv: [async ({ omniConfig }, use) => {
    const env = process.env.OMNI_ENV ?? omniConfig.defaultEnv;
    await use(env);
  }, { scope: 'worker' }],

  envConfig: [async ({ omniConfig, activeEnv }, use) => {
    const { envConfig } = getEnvConfig(omniConfig, activeEnv);
    await use(envConfig);
  }, { scope: 'worker' }],

  // Worker-scoped API client with auth injected
  apiClient: [async ({ omniConfig, envConfig, playwright }, use) => {
    const authHeaders = await resolveAuthHeaders(
      envConfig.baseURL,
      envConfig.auth,
      omniConfig.globalHeaders
    );

    const allHeaders = {
      ...omniConfig.globalHeaders,
      ...envConfig.headers,
      ...authHeaders,
    };

    const ctx = await playwright.request.newContext({
      baseURL: envConfig.baseURL,
      extraHTTPHeaders: allHeaders,
    });

    const client = new APIClient(ctx);

    await use(client);
    await ctx.dispose();
  }, { scope: 'worker' }],
});

export { expect };
