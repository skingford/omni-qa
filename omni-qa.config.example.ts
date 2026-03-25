import type { OmniQAConfig } from '@omni-qa/core';

const config: OmniQAConfig = {
  defaultEnv: 'dev',

  globalHeaders: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },

  envs: {
    dev: {
      baseURL: 'https://dev-api.example.com',
      auth: {
        type: 'header',
        headers: {
          'Authorization': 'Bearer ${API_KEY}',
        },
      },
    },

    staging: {
      baseURL: 'https://staging-api.example.com',
      auth: {
        type: 'bearer',
        login: {
          url: '/auth/login',
          method: 'POST',
          body: {
            username: '${USERNAME}',
            password: '${PASSWORD}',
          },
          tokenPath: 'data.access_token',
        },
      },
    },

    prod: {
      baseURL: 'https://api.example.com',
      auth: {
        type: 'header',
        headers: {
          'X-API-Key': '${API_KEY}',
        },
      },
    },
  },

  notify: [
    {
      type: 'dingtalk',
      webhook: '${DINGTALK_WEBHOOK}',
    },
    {
      type: 'email',
      smtp: {
        host: '${SMTP_HOST}',
        port: 465,
        secure: true,
        user: '${SMTP_USER}',
        pass: '${SMTP_PASS}',
      },
      to: ['${EMAIL_TO}'],
    },
  ],

  testDir: 'tests/api',
  reportDir: 'reports',
};

export default config;
