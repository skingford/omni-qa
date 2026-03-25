import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import type { OmniQAConfig } from './types.js';

const CONFIG_FILE = 'omni-qa.config.ts';

/**
 * Interpolate ${VAR} references in a value with environment variables.
 */
export function interpolateEnvVars(value: string): string {
  return value.replace(/\$\{(\w+)\}/g, (_, key) => {
    return process.env[key] ?? '';
  });
}

/**
 * Deep-interpolate all string values in an object.
 */
export function interpolateDeep<T>(obj: T): T {
  if (typeof obj === 'string') {
    return interpolateEnvVars(obj) as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => interpolateDeep(item)) as T;
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      result[key] = interpolateDeep(val);
    }
    return result as T;
  }
  return obj;
}

/**
 * Load .env file for the specified environment.
 * Looks for .env.<env> first, then falls back to .env
 */
function loadEnvFile(env?: string): void {
  const cwd = process.cwd();

  if (env) {
    const envFile = resolve(cwd, `.env.${env}`);
    if (existsSync(envFile)) {
      loadDotenv({ path: envFile, override: true });
      return;
    }
  }

  const defaultEnvFile = resolve(cwd, '.env');
  if (existsSync(defaultEnvFile)) {
    loadDotenv({ path: defaultEnvFile, override: true });
  }
}

/**
 * Load and validate the omni-qa configuration.
 */
export async function loadConfig(env?: string): Promise<OmniQAConfig> {
  const cwd = process.cwd();
  const configPath = resolve(cwd, CONFIG_FILE);

  if (!existsSync(configPath)) {
    throw new Error(
      `Config file not found: ${configPath}\nRun "omni-qa init" to scaffold one.`
    );
  }

  // Import the user's TypeScript config through a file URL so Bun can load it reliably.
  const mod = await import(pathToFileURL(configPath).href);
  const rawConfig: OmniQAConfig = mod.default ?? mod;

  // Determine active environment
  const activeEnv = env ?? rawConfig.defaultEnv;

  // Load .env file
  loadEnvFile(activeEnv);

  // Interpolate environment variables
  const config = interpolateDeep(rawConfig);

  // Validate
  if (!config.envs[activeEnv]) {
    const available = Object.keys(config.envs).join(', ');
    throw new Error(
      `Environment "${activeEnv}" not found in config. Available: ${available}`
    );
  }

  // Apply defaults
  config.testDir ??= 'tests/api';
  config.reportDir ??= 'reports';

  return config;
}

/**
 * Get the active environment config.
 */
export function getEnvConfig(config: OmniQAConfig, env?: string) {
  const activeEnv = env ?? config.defaultEnv;
  const envConfig = config.envs[activeEnv];
  if (!envConfig) {
    throw new Error(`Environment "${activeEnv}" not found in config.`);
  }
  return { activeEnv, envConfig };
}
