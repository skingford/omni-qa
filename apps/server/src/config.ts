import { resolve } from 'node:path';
import type { ServerConfig } from './domain/types.js';

function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadServerConfig(cwd = process.cwd()): ServerConfig {
  return {
    host: process.env.OMNI_SERVER_HOST ?? '127.0.0.1',
    port: readInt('OMNI_SERVER_PORT', 3210),
    dataDir: resolve(cwd, process.env.OMNI_SERVER_DATA_DIR ?? '.omni-qa/server'),
    limits: {
      importMaxBytes: readInt('OMNI_IMPORT_MAX_BYTES', 5 * 1024 * 1024),
      importTimeoutMs: readInt('OMNI_IMPORT_TIMEOUT_MS', 15_000),
      parseTimeoutMs: readInt('OMNI_PARSE_TIMEOUT_MS', 20_000),
      maxEndpointsPerSpec: readInt('OMNI_MAX_ENDPOINTS_PER_SPEC', 2_000),
      maxSelectionSize: readInt('OMNI_MAX_SELECTION_SIZE', 500),
      maxConcurrentRuns: readInt('OMNI_MAX_CONCURRENT_RUNS', 2),
      runTimeoutMs: readInt('OMNI_RUN_TIMEOUT_MS', 10 * 60_000),
      maxCasesPerRun: readInt('OMNI_MAX_CASES_PER_RUN', 500),
      aiPromptMaxChars: readInt('OMNI_AI_PROMPT_MAX_CHARS', 40_000),
    },
  };
}
