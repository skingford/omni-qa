import { createOmniPlaywrightConfig } from '@omni-qa/core';

/**
 * Thin root wrapper around the shared omni-qa Playwright defaults.
 *
 * Environment is controlled via OMNI_ENV:
 *   OMNI_ENV=staging bunx playwright test
 *
 * Or via CLI:
 *   omni-qa run --env staging
 */
export default createOmniPlaywrightConfig();
