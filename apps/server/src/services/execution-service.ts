import { randomUUID } from 'node:crypto';
import { conflictError, limitExceededError, notFoundError, validationError } from '../domain/errors.js';
import type { Job, ServerConfig, TestRun } from '../domain/types.js';
import type { Repositories } from '../repositories/types.js';
import { type ExecutionAdapter, PlaywrightExecutionAdapter } from './playwright-adapter.js';

export interface StartRunInput {
  caseIds: string[];
  envId: string;
  workers?: number;
}

export class TestExecutionService {
  private readonly activeRuns = new Map<string, AbortController>();

  constructor(
    private readonly repos: Repositories,
    private readonly config: ServerConfig,
    private readonly adapter: ExecutionAdapter = new PlaywrightExecutionAdapter(),
  ) {}

  async startRun(input: StartRunInput): Promise<{ job: Job; run: TestRun }> {
    const caseIds = Array.from(new Set(input.caseIds));
    if (caseIds.length === 0) {
      throw validationError('caseIds must not be empty');
    }
    if (caseIds.length > this.config.limits.maxCasesPerRun) {
      throw limitExceededError(`caseIds exceeds maxCasesPerRun ${this.config.limits.maxCasesPerRun}`);
    }
    if (this.activeRuns.size >= this.config.limits.maxConcurrentRuns) {
      throw conflictError('Maximum concurrent test runs reached');
    }

    const cases = await this.repos.cases.getMany(caseIds);
    if (cases.length !== caseIds.length) {
      throw validationError('caseIds contains unknown test cases');
    }
    if (cases.some((testCase) => testCase.status !== 'validated')) {
      throw validationError('Only validated test cases can be executed');
    }

    const now = new Date().toISOString();
    const run: TestRun = {
      id: randomUUID(),
      status: 'pending',
      envId: input.envId,
      caseIds,
      createdAt: now,
      updatedAt: now,
      total: caseIds.length,
      passed: 0,
      failed: 0,
      skipped: 0,
    };

    const job: Job = {
      id: randomUUID(),
      type: 'test-run',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      result: { runId: run.id, caseCount: caseIds.length },
    };

    await this.repos.runs.save(run);
    await this.repos.jobs.save(job);

    queueMicrotask(() => {
      void this.runNow(job.id, run.id, input.workers);
    });

    return { job, run };
  }

  async getRun(runId: string): Promise<TestRun> {
    const run = await this.repos.runs.get(runId);
    if (!run) {
      throw notFoundError(`Test run ${runId} not found`);
    }
    return run;
  }

  async listResults(runId: string) {
    await this.getRun(runId);
    return this.repos.runs.listResults(runId);
  }

  async getReport(runId: string) {
    const run = await this.getRun(runId);
    return run.report ?? {};
  }

  async cancelRun(runId: string): Promise<TestRun> {
    const run = await this.getRun(runId);
    if (run.status === 'pending') {
      return this.repos.runs.update(runId, {
        status: 'canceled',
        finishedAt: new Date().toISOString(),
      });
    }

    const controller = this.activeRuns.get(runId);
    if (!controller) {
      return run;
    }

    controller.abort();
    return this.repos.runs.update(runId, {
      status: 'canceled',
      finishedAt: new Date().toISOString(),
    });
  }

  private async runNow(jobId: string, runId: string, workers?: number): Promise<void> {
    const run = await this.getRun(runId);
    if (run.status === 'canceled') {
      await this.repos.jobs.update(jobId, {
        status: 'canceled',
        finishedAt: new Date().toISOString(),
      });
      return;
    }

    const controller = new AbortController();
    this.activeRuns.set(runId, controller);
    await this.repos.runs.update(runId, { status: 'running', startedAt: new Date().toISOString() });
    await this.repos.jobs.update(jobId, { status: 'running', startedAt: new Date().toISOString() });

    const timeout = setTimeout(() => controller.abort(), this.config.limits.runTimeoutMs);
    try {
      const cases = await this.repos.cases.getMany(run.caseIds);
      const result = await this.adapter.execute({
        runId,
        cases,
        envId: run.envId,
        dataDir: this.config.dataDir,
        workers,
        timeoutMs: this.config.limits.runTimeoutMs,
        signal: controller.signal,
      });

      const passed = result.results.filter((item) => item.status === 'passed').length;
      const failed = result.results.filter((item) => item.status === 'failed').length;
      const skipped = result.results.filter((item) => item.status === 'skipped').length;
      const status = controller.signal.aborted ? 'canceled' : result.success ? 'succeeded' : 'failed';

      await this.repos.runs.saveResults(runId, result.results);
      await this.repos.runs.update(runId, {
        status,
        finishedAt: new Date().toISOString(),
        report: result.report,
        passed,
        failed,
        skipped,
        error: result.success ? undefined : result.output.slice(-2_000),
      });
      await this.repos.jobs.update(jobId, {
        status,
        finishedAt: new Date().toISOString(),
        result: { runId, passed, failed, skipped, durationMs: result.durationMs },
      });
    } catch (error) {
      const status = controller.signal.aborted ? 'canceled' : 'failed';
      await this.repos.runs.update(runId, {
        status,
        finishedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Test run failed',
      });
      await this.repos.jobs.update(jobId, {
        status,
        finishedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Test run failed',
      });
    } finally {
      clearTimeout(timeout);
      this.activeRuns.delete(runId);
    }
  }
}
