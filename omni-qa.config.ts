import type { OmniQAConfig } from '@omni-qa/core';

const config: OmniQAConfig = {
  defaultEnv: 'dev',

  globalHeaders: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },

  envs: {
    dev: {
      baseURL: 'https://petstore3.swagger.io/api/v3',
    },
  },

  testDir: 'tests/api',
  reportDir: 'reports',
};

export default config;
