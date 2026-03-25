import { spawn } from 'node:child_process';
import { getReportPreviewState, type ReportPreviewState } from './report-paths.js';

const DEFAULT_OUTPUT_LIMIT = 40000;
const DEFAULT_RETRY = '0';

export interface RunPlaywrightOptions {
  cwd?: string;
  env?: string;
  tag?: string;
  retry?: string | number;
  trace?: boolean;
  headed?: boolean;
  workers?: string | number;
  streamOutput?: boolean;
  outputLimit?: number;
}

export interface RunPlaywrightResult {
  command: string;
  success: boolean;
  exitCode: number;
  durationMs: number;
  output: string;
  report: ReportPreviewState;
}

export interface PreparedRunPlaywrightCommand {
  bin: string;
  args: string[];
  command: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  outputLimit: number;
}

export function prepareRunPlaywrightCommand(
  options: RunPlaywrightOptions = {},
): PreparedRunPlaywrightCommand {
  const cwd = options.cwd ?? process.cwd();
  const args = ['playwright', 'test'];
  const envVars: Record<string, string> = {};
  const outputLimit = options.outputLimit ?? DEFAULT_OUTPUT_LIMIT;

  if (options.env) {
    envVars.OMNI_ENV = options.env;
  }

  if (options.tag) {
    args.push('--grep', options.tag);
  }

  if (String(options.retry ?? DEFAULT_RETRY) !== DEFAULT_RETRY) {
    args.push('--retries', String(options.retry));
  }

  if (options.trace) {
    envVars.TRACE = 'on';
  }

  if (options.headed) {
    args.push('--headed');
  }

  if (options.workers !== undefined && String(options.workers).trim().length > 0) {
    args.push('--workers', String(options.workers));
  }

  const command = `bunx ${args.join(' ')}`;

  return {
    bin: 'bunx',
    args,
    command,
    cwd,
    env: { ...process.env, ...envVars },
    outputLimit,
  };
}

export function appendRunOutput(current: string, chunk: string, limit = DEFAULT_OUTPUT_LIMIT): string {
  const next = `${current}${chunk}`;
  if (next.length <= limit) {
    return next;
  }
  return next.slice(next.length - limit);
}

export async function runPlaywrightTests(
  options: RunPlaywrightOptions = {},
): Promise<RunPlaywrightResult> {
  const prepared = prepareRunPlaywrightCommand(options);
  const startedAt = Date.now();

  const execution = await new Promise<{ exitCode: number; output: string }>((resolve, reject) => {
    const child = spawn(prepared.bin, prepared.args, {
      cwd: prepared.cwd,
      env: prepared.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let buffer = '';

    const appendChunk = (chunk: string, target?: NodeJS.WriteStream) => {
      if (options.streamOutput && target) {
        target.write(chunk);
      }

      buffer = appendRunOutput(buffer, chunk, prepared.outputLimit);
    };

    child.stdout.on('data', (chunk) => appendChunk(String(chunk), process.stdout));
    child.stderr.on('data', (chunk) => appendChunk(String(chunk), process.stderr));
    child.once('error', reject);
    child.once('close', (code) => resolve({ exitCode: code ?? 1, output: buffer.trim() }));
  });

  const report = await getReportPreviewState(prepared.cwd);
  const durationMs = Date.now() - startedAt;
  const success = execution.exitCode === 0;

  return {
    command: prepared.command,
    success,
    exitCode: execution.exitCode,
    durationMs,
    output: execution.output,
    report,
  };
}
