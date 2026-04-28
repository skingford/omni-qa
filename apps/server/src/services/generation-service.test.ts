import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, test } from 'bun:test';
import { loadServerConfig } from '../config.js';
import type { ApiEndpoint, ApiSpec, EndpointSelection, Job } from '../domain/types.js';
import { createJsonRepositories } from '../repositories/json-store.js';
import type { Repositories } from '../repositories/types.js';
import { type AITestCaseProvider, TestCaseGenerationService } from './generation-service.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe('TestCaseGenerationService', () => {
  test('stores valid AI output as validated DSL', async () => {
    const { service, repos, selection, endpoint } = await createService({
      model: 'test-model',
      async generateCases() {
        return {
          cases: [
            {
              endpointId: endpoint.id,
              name: 'Get user happy path',
              scenarioType: 'positive',
              priority: 'high',
              request: { method: 'GET', path: '/users/42' },
              assertions: [{ type: 'status', operator: 'eq', expected: 200 }],
              tags: ['users'],
            },
          ],
        };
      },
    });

    const { job } = await service.startGeneration({ selectionId: selection.id });
    const finished = await waitForJob(repos, job.id);

    expect(finished.status).toBe('succeeded');
    expect(finished.result?.caseCount).toBe(1);

    const cases = await service.listCases({ selectionId: selection.id });
    expect(cases).toHaveLength(1);
    expect(cases[0]?.status).toBe('validated');
    expect(cases[0]?.model).toBe('test-model');
  });

  test('marks generation failed for malformed AI output', async () => {
    const { service, repos, selection } = await createService({
      model: 'bad-model',
      async generateCases() {
        return { nope: [] };
      },
    });

    const { job } = await service.startGeneration({ selectionId: selection.id });
    const finished = await waitForJob(repos, job.id);

    expect(finished.status).toBe('failed');
    expect(finished.error).toContain('cases array');
    expect(await service.listCases({ selectionId: selection.id })).toHaveLength(0);
  });

  test('rejects executable text returned by AI', async () => {
    const { service, repos, selection } = await createService({
      model: 'unsafe-model',
      async generateCases() {
        return 'import { test } from "@playwright/test"; test("bad", () => {})';
      },
    });

    const { job } = await service.startGeneration({ selectionId: selection.id });
    const finished = await waitForJob(repos, job.id);

    expect(finished.status).toBe('failed');
    expect(finished.error).toContain('executable text');
  });

  test('generates deterministic fallback cases when no provider is configured', async () => {
    const { service, repos, selection } = await createService();

    const { job } = await service.startGeneration({ selectionId: selection.id });
    const finished = await waitForJob(repos, job.id);

    expect(finished.status).toBe('succeeded');
    const cases = await service.listCases({ selectionId: selection.id });
    expect(cases).toHaveLength(1);
    expect(cases[0]?.model).toBe('deterministic-fallback');
    expect(cases[0]?.request.path).toBe('/users/sample-id');
  });
});

async function createService(provider?: AITestCaseProvider): Promise<{
  service: TestCaseGenerationService;
  repos: Repositories;
  selection: EndpointSelection;
  endpoint: ApiEndpoint;
}> {
  const dataDir = await mkdtemp(join(tmpdir(), 'omni-qa-generation-'));
  tempDirs.push(dataDir);

  const repos = createJsonRepositories(dataDir);
  const config = {
    ...loadServerConfig(),
    dataDir,
    limits: {
      ...loadServerConfig().limits,
      aiPromptMaxChars: 4_000,
    },
  };

  const spec: ApiSpec = {
    id: 'spec_test',
    sourceUrl: 'https://example.test/openapi.json',
    title: 'Generation Test API',
    version: '1.0.0',
    importedAt: new Date().toISOString(),
    contentHash: 'hash',
    endpointCount: 1,
  };

  const endpoint: ApiEndpoint = {
    id: 'ep_get_user',
    specId: spec.id,
    method: 'GET',
    path: '/users/{id}',
    operationId: 'getUser',
    summary: 'Get user',
    tags: ['users'],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string' },
      },
    ],
    responses: [{ statusCode: '200', description: 'OK' }],
    deprecated: false,
  };

  const selection: EndpointSelection = {
    id: 'sel_users',
    specId: spec.id,
    endpointIds: [endpoint.id],
    createdAt: new Date().toISOString(),
  };

  await repos.specs.save(spec);
  await repos.endpoints.saveMany(spec.id, [endpoint]);
  await repos.selections.save(selection);

  return {
    service: new TestCaseGenerationService(repos, config, provider),
    repos,
    selection,
    endpoint,
  };
}

async function waitForJob(repos: Repositories, jobId: string): Promise<Job> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const job = await repos.jobs.get(jobId);
    if (job && job.status !== 'pending' && job.status !== 'running') {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out waiting for job ${jobId}`);
}
