import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import {
  appendRunOutput,
  prepareRunPlaywrightCommand,
  type RunPlaywrightOptions,
} from './run-tests.js';
import { getReportPreviewState, type ReportPreviewState } from './report-paths.js';

type RunSessionStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface RunSessionSnapshot {
  id: string;
  command: string;
  status: RunSessionStatus;
  success: boolean | null;
  exitCode: number | null;
  durationMs: number;
  startedAt: string;
  completedAt: string | null;
  output: string;
  report: ReportPreviewState | null;
}

interface RunSessionInternal {
  snapshot: RunSessionSnapshot;
  child: ReturnType<typeof spawn>;
  cwd: string;
  outputLimit: number;
  startedAtMs: number;
  cancellationRequested: boolean;
  forceKillTimer?: ReturnType<typeof setTimeout>;
}

const sessions = new Map<string, RunSessionInternal>();
const MAX_SESSIONS = 20;

export async function createRunSession(
  options: RunPlaywrightOptions = {},
): Promise<RunSessionSnapshot> {
  pruneRunSessions();

  const prepared = prepareRunPlaywrightCommand(options);
  const startedAtMs = Date.now();
  const id = randomUUID();
  const child = spawn(prepared.bin, prepared.args, {
    cwd: prepared.cwd,
    env: prepared.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const snapshot: RunSessionSnapshot = {
    id,
    command: prepared.command,
    status: 'running',
    success: null,
    exitCode: null,
    durationMs: 0,
    startedAt: new Date(startedAtMs).toISOString(),
    completedAt: null,
    output: '',
    report: null,
  };

  const session: RunSessionInternal = {
    snapshot,
    child,
    cwd: prepared.cwd,
    outputLimit: prepared.outputLimit,
    startedAtMs,
    cancellationRequested: false,
  };

  sessions.set(id, session);

  const appendChunk = (chunk: string) => {
    session.snapshot.output = appendRunOutput(session.snapshot.output, chunk, session.outputLimit);
    session.snapshot.durationMs = Date.now() - session.startedAtMs;
  };

  child.stdout.on('data', (chunk) => appendChunk(String(chunk)));
  child.stderr.on('data', (chunk) => appendChunk(String(chunk)));

  child.once('error', async (error) => {
    appendChunk(`\n${error instanceof Error ? error.message : String(error)}\n`);
    await finalizeRunSession(session, 1);
  });

  child.once('close', async (code) => {
    await finalizeRunSession(session, code ?? 1);
  });

  return cloneSnapshot(session.snapshot);
}

export function getRunSession(id: string): RunSessionSnapshot | null {
  const session = sessions.get(id);
  return session ? cloneSnapshot(session.snapshot) : null;
}

export function stopRunSession(id: string): RunSessionSnapshot | null {
  const session = sessions.get(id);
  if (!session) {
    return null;
  }

  if (session.snapshot.status !== 'running') {
    return cloneSnapshot(session.snapshot);
  }

  if (session.cancellationRequested) {
    return cloneSnapshot(session.snapshot);
  }

  session.cancellationRequested = true;
  session.snapshot.output = appendRunOutput(
    session.snapshot.output,
    '\n[omni-qa] Stop requested. Terminating Playwright run...\n',
    session.outputLimit,
  );
  session.snapshot.durationMs = Date.now() - session.startedAtMs;

  session.child.kill('SIGTERM');
  session.forceKillTimer = setTimeout(() => {
    if (session.snapshot.status === 'running') {
      session.child.kill('SIGKILL');
    }
  }, 3000);

  return cloneSnapshot(session.snapshot);
}

function pruneRunSessions(): void {
  if (sessions.size < MAX_SESSIONS) {
    return;
  }

  const candidates = Array.from(sessions.values())
    .filter((session) => session.snapshot.status !== 'running')
    .sort((left, right) => left.startedAtMs - right.startedAtMs);

  while (sessions.size >= MAX_SESSIONS && candidates.length > 0) {
    const session = candidates.shift();
    if (session) {
      sessions.delete(session.snapshot.id);
    }
  }
}

async function finalizeRunSession(session: RunSessionInternal, exitCode: number): Promise<void> {
  if (session.snapshot.status !== 'running') {
    return;
  }

  if (session.forceKillTimer) {
    clearTimeout(session.forceKillTimer);
    session.forceKillTimer = undefined;
  }

  session.snapshot.exitCode = exitCode;
  session.snapshot.success = exitCode === 0;
  if (session.cancellationRequested) {
    session.snapshot.status = 'cancelled';
    session.snapshot.success = false;
    session.snapshot.exitCode = 130;
  } else {
    session.snapshot.status = exitCode === 0 ? 'completed' : 'failed';
  }
  session.snapshot.durationMs = Date.now() - session.startedAtMs;
  session.snapshot.completedAt = new Date().toISOString();
  session.snapshot.report = await getReportPreviewState(session.cwd);
}

function cloneSnapshot(snapshot: RunSessionSnapshot): RunSessionSnapshot {
  return {
    ...snapshot,
    report: snapshot.report ? { ...snapshot.report } : null,
  };
}
