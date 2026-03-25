import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import {
  getConfigStudioAssetPaths,
  hasConfigStudioAssets,
  startConfigStudio,
} from '../../config-ui/server.js';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(MODULE_DIR, '../../../../..');

export const configCommand = new Command('config')
  .description('Open a local visual configuration studio in the browser')
  .option('-p, --port <port>', 'Port for the local config studio', '3210')
  .option('--host <host>', 'Host for the local config studio', '127.0.0.1')
  .option('--no-open', 'Do not open the browser automatically')
  .action(async (options: { port: string; host: string; open: boolean }) => {
    const port = Number(options.port);
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
      console.error(`\n❌ Invalid port: ${options.port}\n`);
      process.exit(1);
    }

    try {
      ensureConfigStudioAssets();
      await startConfigStudio({
        host: options.host,
        port,
        open: options.open,
      });
    } catch (error) {
      console.error(`\n❌ ${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(1);
    }
  });

function ensureConfigStudioAssets(): void {
  if (hasConfigStudioAssets()) {
    return;
  }

  const appPackagePath = resolve(REPO_ROOT, 'apps/config-studio/package.json');
  const rootPackagePath = resolve(REPO_ROOT, 'package.json');
  const { indexPath } = getConfigStudioAssetPaths();

  if (!existsSync(appPackagePath) || !existsSync(rootPackagePath)) {
    throw new Error(
      `Config studio assets are missing at ${indexPath}. Reinstall dependencies or run "bun run build:config-studio" from the project root.`
    );
  }

  console.log('\n📦 Config studio assets are missing. Building @omni-qa/config-studio...\n');

  const buildResult = spawnSync('bun', ['--filter', '@omni-qa/config-studio', 'build'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: process.env,
  });

  if (buildResult.error) {
    throw new Error(
      `Unable to build config studio assets automatically: ${buildResult.error.message}. Run "bun install" and "bun run build:config-studio" manually.`
    );
  }

  if (buildResult.status !== 0 || !hasConfigStudioAssets()) {
    throw new Error(
      `Config studio build failed. Run "bun install" and "bun run build:config-studio" from ${REPO_ROOT}, then try again.`
    );
  }
}
