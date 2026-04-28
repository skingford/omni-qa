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
- importing an OpenAPI document and generating test files from the page
- running Playwright tests and opening the latest HTML report from the page
- live run output while Playwright is still executing
- stopping an in-flight Playwright run from the page
- first-run bootstrap when `omni-qa.config.ts` does not exist yet

```bash
# Open the studio on the default port
omni-qa config

# Use a custom port without auto-opening the browser
omni-qa config --port 4321 --no-open
```

If the current workspace does not have `/Users/kingford/workspace/github.com/omni-qa/omni-qa.config.ts` yet, the studio now opens in a bootstrap flow so you can visually choose the default environment, base URL, auth mode, notifications, and whether to create `.env`.
Once a config exists, the right-side tools also let you paste an OpenAPI URL or local file path, optionally filter tags, generate test files, run Playwright against a selected environment, and open the latest HTML report without leaving the page.

For frontend-only development, the config studio now lives in `/Users/kingford/workspace/github.com/omni-qa/apps/config-studio`:

```bash
# terminal 1: start the config API/backend
bun run dev -- config --no-open

# terminal 2: run the Vite app with /api proxied to the backend
bun run dev:config-studio
```

### AI OpenAPI Closed Loop

The Node.js orchestration backend powers the newer closed-loop workflow:

```bash
# terminal 1: start the Node backend on 127.0.0.1:3210
bun run dev:server

# terminal 2: run the Vite config studio; /api proxies to the backend
bun run dev:config-studio
```

In the `AI Loop` panel you can:

- import an OpenAPI/Swagger URL as an async job
- filter and select endpoints from the imported catalog
- generate structured test-case DSL with the deterministic fallback generator
- run generated cases through Playwright using the configured environment
- inspect run counts, case results, and report artifact paths

The backend stores local workflow state under `.omni-qa/server` by default.

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

### Node Backend Settings

The closed-loop backend is configured with environment variables:

```bash
OMNI_SERVER_HOST=127.0.0.1
OMNI_SERVER_PORT=3210
OMNI_SERVER_DATA_DIR=.omni-qa/server
OMNI_IMPORT_MAX_BYTES=5242880
OMNI_IMPORT_TIMEOUT_MS=15000
OMNI_PARSE_TIMEOUT_MS=20000
OMNI_MAX_ENDPOINTS_PER_SPEC=2000
OMNI_MAX_SELECTION_SIZE=500
OMNI_MAX_CONCURRENT_RUNS=2
OMNI_MAX_CASES_PER_RUN=500
OMNI_RUN_TIMEOUT_MS=600000
OMNI_AI_PROMPT_MAX_CHARS=40000
```

AI provider integration is adapter-based. Until a provider is configured, the backend uses deterministic fallback cases derived from OpenAPI parameters, request examples, and 2xx response metadata.

## Architecture

```
apps/
├── config-studio/      # Standalone Vue + Vite config studio
└── server/             # Node.js closed-loop orchestration backend

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

- `bun run build` — build `packages/core`, `packages/cli`, the Node backend, and the Vue config studio
- `bun run build:core` — build the shared runtime package
- `bun run build:cli` — build the CLI package after core is ready
- `bun run build:server` — build the server after core and CLI helpers are ready
- `bun run dev:server` — run the Node closed-loop backend
- `bun run dev:config-studio` — run the standalone config studio app in Vite
- `bun run preview:config-studio` — preview the built frontend bundle
- `bun run dev -- config` — build core, then run the CLI from `packages/cli/src` against the repo root
- `bun run test:server` — run backend service tests
- `bun run test:closed-loop` — run backend service tests and build the config studio
- `bun run smoke:petstore` — import Petstore, generate fallback cases, execute one generated run, and read the report
- `bun run openspec:status` — show implementation progress for the closed-loop OpenSpec change

The root `/Users/kingford/workspace/github.com/omni-qa/playwright.config.ts` is now only a thin wrapper around the shared Playwright defaults exported by `@omni-qa/core`.

## Tech Stack

- **@playwright/test** — Test runner, fixtures, reporters
- **Commander.js** — CLI framework
- **@apidevtools/swagger-parser** — OpenAPI 3.0/3.1/2.0 parsing
- **Handlebars** — Test file template generation
- **nodemailer** — Email notifications
