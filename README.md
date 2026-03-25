# omni-qa

Universal API automation testing platform built on Playwright.

Import OpenAPI documents, auto-generate test cases, run with environment/auth config, get reports and notifications.

The repository is managed as a Bun workspace so the CLI/backend and the visual config studio can evolve independently.

## Quick Start

```bash
# Install workspace dependencies
bun install

# Scaffold config, env, Playwright config, and base folders
bun run dev -- init

# Import OpenAPI document (file or URL)
bun run dev -- import https://petstore3.swagger.io/api/v3/openapi.json

# Or launch the visual config studio served by the CLI
bun run dev -- config

# Run tests
bun run dev -- run --env dev

# Open HTML report
bun run dev -- report
```

## CLI Commands

### `omni-qa init`

Scaffold the standard omni-qa project files in the current directory:

- `omni-qa.config.ts`
- `.env.example`
- `.env` if missing
- `playwright.config.ts`
- `tests/api`
- `reports`

The starter config is now parameterized, so you can choose the initial environment name, base URL, auth mode, and notification channels up front. By default it creates one `dev` environment with static header auth plus DingTalk and email notification examples.

```bash
# Create the scaffold without touching an existing .env
omni-qa init

# Start with a staging environment and bearer-login auth
omni-qa init --default-env staging --base-url https://staging-api.example.com --auth bearer

# Keep the scaffold lean for a local smoke-test project
omni-qa init --auth none --no-dingtalk --no-email --skip-env

# Overwrite config/example/playwright files
omni-qa init --force
```

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

### `omni-qa config`

Open a local browser-based config studio for editing:

- environments and base URLs
- auth mode (none / static headers / login to fetch token)
- notification channels (DingTalk / email)
- `.env` secrets and placeholders
- first-run bootstrap when `omni-qa.config.ts` does not exist yet

```bash
# Open the studio on the default port
omni-qa config

# Use a custom port without auto-opening the browser
omni-qa config --port 4321 --no-open
```

If the current workspace does not have `/Users/kingford/workspace/github.com/omni-qa/omni-qa.config.ts` yet, the studio now opens in a bootstrap flow so you can visually choose the default environment, base URL, auth mode, notifications, and whether to create `.env`.

For frontend-only development, the config studio now lives in `/Users/kingford/workspace/github.com/omni-qa/apps/config-studio`:

```bash
# terminal 1: start the config API/backend
bun run dev -- config --no-open

# terminal 2: run the Vite app with /api proxied to the backend
bun run dev:config-studio
```

### `omni-qa report`

Open the latest HTML test report in browser.

## Configuration

### `omni-qa.config.ts`

```ts
import type { OmniQAConfig } from '@omni-qa/core';

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

`omni-qa init` only adds the placeholders that match the auth and notification options you selected, so a minimal scaffold can keep `.env.example` intentionally small.

## Architecture

```
apps/
└── config-studio/      # Standalone Vue + Vite config studio

packages/
├── cli/
│   └── src/
│       ├── cli/        # Command entrypoints
│       └── config-ui/  # Config studio API + static asset server
└── core/
    └── src/
        ├── config/     # Config types and loader
        ├── openapi/    # OpenAPI parser and fetcher
        ├── generator/  # Test file generation
        ├── fixtures/   # Playwright fixtures
        ├── assertions/ # Custom expect matchers
        └── reporters/  # Notification reporters
```

## Workspace Scripts

- `bun run build` — build `packages/core`, `packages/cli`, and the Vue config studio
- `bun run build:core` — build the shared runtime package
- `bun run build:cli` — build the CLI package after core is ready
- `bun run dev:config-studio` — run the standalone config studio app in Vite
- `bun run preview:config-studio` — preview the built frontend bundle
- `bun run dev -- config` — build core, then run the CLI from `packages/cli/src` against the repo root

The root `/Users/kingford/workspace/github.com/omni-qa/playwright.config.ts` is now only a thin wrapper around the shared Playwright defaults exported by `@omni-qa/core`.

## Tech Stack

- **@playwright/test** — Test runner, fixtures, reporters
- **Commander.js** — CLI framework
- **@apidevtools/swagger-parser** — OpenAPI 3.0/3.1/2.0 parsing
- **Handlebars** — Test file template generation
- **nodemailer** — Email notifications
