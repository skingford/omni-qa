# omni-qa

Universal API automation testing platform built on Playwright.

Import OpenAPI documents, auto-generate test cases, run with environment/auth config, get reports and notifications.

## Quick Start

```bash
# Install dependencies
npm install

# Import OpenAPI document (file or URL)
npx tsx src/cli/index.ts import https://petstore3.swagger.io/api/v3/openapi.json

# Configure environment and auth
cp omni-qa.config.example.ts omni-qa.config.ts
cp .env.example .env
# Edit both files with your settings

# Run tests
npx tsx src/cli/index.ts run --env dev

# Open HTML report
npx tsx src/cli/index.ts report
```

## CLI Commands

### `omni-qa import <source>`

Import an OpenAPI document and generate `.spec.ts` test files.

```bash
# From URL
omni-qa import https://api.example.com/openapi.json

# From local file
omni-qa import ./docs/api.yaml

# Filter by tag
omni-qa import ./api.yaml --tag users --tag orders

# Custom output directory
omni-qa import ./api.yaml --out tests/my-api
```

### `omni-qa run`

Run tests using Playwright.

```bash
# Run all tests
omni-qa run

# Specify environment
omni-qa run --env staging

# Filter by tag
omni-qa run --tag @smoke

# Retry failed tests
omni-qa run --retry 2

# Enable trace
omni-qa run --trace
```

### `omni-qa report`

Open the latest HTML test report in browser.

## Configuration

### `omni-qa.config.ts`

```ts
import type { OmniQAConfig } from './src/config/types.js';

const config: OmniQAConfig = {
  defaultEnv: 'dev',

  globalHeaders: {
    'Content-Type': 'application/json',
  },

  envs: {
    dev: {
      baseURL: 'https://dev-api.example.com',
      // Static header auth
      auth: {
        type: 'header',
        headers: { 'Authorization': 'Bearer ${API_KEY}' },
      },
    },
    staging: {
      baseURL: 'https://staging-api.example.com',
      // Login to get token
      auth: {
        type: 'bearer',
        login: {
          url: '/auth/login',
          method: 'POST',
          body: { username: '${USERNAME}', password: '${PASSWORD}' },
          tokenPath: 'data.access_token',
        },
      },
    },
  },

  notify: [
    { type: 'dingtalk', webhook: '${DINGTALK_WEBHOOK}' },
    {
      type: 'email',
      smtp: { host: '${SMTP_HOST}', port: 465, user: '${SMTP_USER}', pass: '${SMTP_PASS}' },
      to: ['${EMAIL_TO}'],
    },
  ],
};

export default config;
```

### Environment Variables

Sensitive values use `${VAR}` interpolation. Set them in `.env` files:

```
.env          # Default
.env.dev      # Dev environment (takes priority)
.env.staging  # Staging environment
```

## Architecture

```
src/
├── config/       # Config types and loader
├── openapi/      # OpenAPI parser and fetcher
├── generator/    # Test file generator (Handlebars templates)
├── fixtures/     # Playwright fixtures (auth, API client)
├── assertions/   # Custom expect matchers
├── reporters/    # DingTalk and email notification reporters
└── cli/          # CLI commands (import, run, report)
```

## Tech Stack

- **@playwright/test** — Test runner, fixtures, reporters
- **Commander.js** — CLI framework
- **@apidevtools/swagger-parser** — OpenAPI 3.0/3.1/2.0 parsing
- **Handlebars** — Test file template generation
- **nodemailer** — Email notifications
