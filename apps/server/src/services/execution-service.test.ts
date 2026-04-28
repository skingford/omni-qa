import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, test } from 'bun:test';
import { loadServerConfig } from '../config.js';
import type { ServerConfig, TestCase, TestResult, TestRun } from '../domain/types.js';
import { createJsonRepositories } from '../repositories/json-store.js';
import type { Repositories } from '../repositories/types.js';
import { TestExecutionService } from './execution-service.js';
import type { ExecuteCasesInput, ExecuteCasesResult, ExecutionAdapter } from './playwright-adapter.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe('TestExecutionService', () => {
  test('records a successful run', async () => {
    const { service, repos, testCase } = await createService(new StaticAdapter('passed'));

    const { run } = await service.startRun({ caseIds: [testCase.id], envId: 'dev' });
    const finished = await waitForRun(service, run.id);

    expect(finished.status).toBe('succeeded');
    expect(finished.passed).toBe(1);
    expect(finished.failed).toBe(0);
    expect(await repos.runs.listResults(run.id)).toHaveLength(1);
  });

  test('captures failing assertion results', async () => {
    const { service, repos, testCase } = await createService(new StaticAdapter('failed'));

    const { run } = await service.startRun({ caseIds: [testCase.id], envId: 'dev' });
    const finished = await waitForRun(service, run.id);

    expect(finished.status).toBe('failed');
    expect(finished.failed).toBe(1);
    const results = await repos.runs.listResults(run.id);
    expect(results[0]?.assertionFailures?.[0]).toContain('expected 200');
  });

  test('rejects empty run', async () => {
    const { service } = await createService(new StaticAdapter('passed'));
    await expect(service.startRun({ caseIds: [], envId: 'dev' })).rejects.toThrow(
      'caseIds must not be empty',
    );
  });

  test('enforces concurrent run limit and supports cancellation', async () => {
    const blocker = new BlockingAdapter();
    const { service, testCase } = await createService(blocker, { maxConcurrentRuns: 1 });

    const { run } = await service.startRun({ caseIds: [testCase.id], envId: 'dev' });
    await waitUntilRunning(service, run.id);

    await expect(service.startRun({ caseIds: [testCase.id], envId: 'dev' })).rejects.toThrow(
      'Maximum concurrent test runs reached',
    );

    const canceled = await service.cancelRun(run.id);
    expect(canceled.status).toBe('canceled');
    blocker.release();
    await blocker.done;
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
});

class StaticAdapter implements ExecutionAdapter {
  constructor(private readonly status: 'passed' | 'failed') {}

  async execute(input: ExecuteCasesInput): Promise<ExecuteCasesResult> {
    const results = input.cases.map((testCase): TestResult => ({
      id: `result_${testCase.id}`,
      runId: input.runId,
      caseId: testCase.id,
      endpointId: testCase.endpointId,
      status: this.status,
      durationMs: 12,
      createdAt: new Date().toISOString(),
      assertionFailures: this.status === 'failed' ? ['expected 200'] : undefined,
    }));

    return {
      success: this.status === 'passed',
      durationMs: 12,
      output: this.status === 'passed' ? '' : 'expected 200',
      report: { outputPreview: '' },
      results,
    };
  }
}

class BlockingAdapter implements ExecutionAdapter {
  private resolve: (() => void) | undefined;
  readonly done: Promise<void>;
  private markDone!: () => void;

  constructor() {
    this.done = new Promise((resolve) => {
      this.markDone = resolve;
    });
  }

  async execute(input: ExecuteCasesInput): Promise<ExecuteCasesResult> {
    await new Promise<void>((resolve) => {
      this.resolve = resolve;
      input.signal?.addEventListener('abort', resolve, { once: true });
    });

    try {
      return {
        success: false,
        durationMs: 1,
        output: 'canceled',
        report: { outputPreview: 'canceled' },
        results: [],
      };
    } finally {
      this.markDone();
    }
  }

  release(): void {
    this.resolve?.();
  }
}

async function createService(
  adapter: ExecutionAdapter,
  limits: Partial<ServerConfig['limits']> = {},
): Promise<{ service: TestExecutionService; repos: Repositories; testCase: TestCase }> {
  const dataDir = await mkdtemp(join(tmpdir(), 'omni-qa-execution-'));
  tempDirs.push(dataDir);

  const repos = createJsonRepositories(dataDir);
  const config = {
    ...loadServerConfig(),
    dataDir,
    limits: {
      ...loadServerConfig().limits,
      runTimeoutMs: 5_000,
      maxCasesPerRun: 10,
      ...limits,
    },
  };

  const testCase: TestCase = {
    id: 'case_one',
    endpointId: 'ep_one',
    specId: 'spec_one',
    name: 'GET /health smoke',
    scenarioType: 'smoke',
    priority: 'medium',
    status: 'validated',
    request: { method: 'GET', path: '/health' },
    assertions: [{ type: 'status', operator: 'eq', expected: 200 }],
    tags: ['smoke'],
    createdAt: new Date().toISOString(),
  };

  await repos.cases.saveMany([testCase]);

  return {
    service: new TestExecutionService(repos, config, adapter),
    repos,
    testCase,
  };
}

async function waitForRun(service: TestExecutionService, runId: string): Promise<TestRun> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const run = await service.getRun(runId);
    if (run.status !== 'pending' && run.status !== 'running') {
      return run;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out waiting for run ${runId}`);
}

async function waitUntilRunning(service: TestExecutionService, runId: string): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const run = await service.getRun(runId);
    if (run.status === 'running') {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out waiting for run ${runId} to start`);
}
