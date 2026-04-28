import { createServer, type Server } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, test } from 'bun:test';
import { loadServerConfig } from '../config.js';
import type { Job } from '../domain/types.js';
import { createJsonRepositories } from '../repositories/json-store.js';
import { OpenApiCatalogService } from './import-service.js';

const tempDirs: string[] = [];
const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );

  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe('OpenApiCatalogService', () => {
  test('imports a valid OpenAPI URL and filters endpoints', async () => {
    const service = await createService();
    const sourceUrl = await serveJson(petstoreLikeDocument());

    const { job } = await service.startImport(sourceUrl);
    const finished = await waitForJob(service, job.id);

    expect(finished.status).toBe('succeeded');
    expect(finished.result?.endpointCount).toBe(2);

    const specs = await service.listSpecs();
    expect(specs).toHaveLength(1);
    expect(specs[0]?.title).toBe('Catalog Test API');

    const users = await service.listEndpoints(specs[0]!.id, { tags: ['users'] });
    expect(users).toHaveLength(1);
    expect(users[0]?.method).toBe('GET');

    const byKeyword = await service.listEndpoints(specs[0]!.id, { keyword: 'create' });
    expect(byKeyword).toHaveLength(1);
    expect(byKeyword[0]?.method).toBe('POST');
  });

  test('rejects invalid source URL without creating a job', async () => {
    const service = await createService();
    await expect(service.startImport('file:///tmp/openapi.json')).rejects.toThrow(
      'sourceUrl must use http or https',
    );
  });

  test('marks import job failed when document has no endpoints', async () => {
    const service = await createService();
    const sourceUrl = await serveJson({
      openapi: '3.0.3',
      info: { title: 'Empty API', version: '1.0.0' },
      paths: {},
    });

    const { job } = await service.startImport(sourceUrl);
    const finished = await waitForJob(service, job.id);

    expect(finished.status).toBe('failed');
    expect(finished.error).toContain('no supported endpoints');
  });
});

async function createService(): Promise<OpenApiCatalogService> {
  const dataDir = await mkdtemp(join(tmpdir(), 'omni-qa-server-'));
  tempDirs.push(dataDir);

  const config = {
    ...loadServerConfig(),
    dataDir,
    limits: {
      ...loadServerConfig().limits,
      importTimeoutMs: 5_000,
      parseTimeoutMs: 5_000,
      maxEndpointsPerSpec: 20,
    },
  };

  return new OpenApiCatalogService(createJsonRepositories(dataDir), config);
}

async function serveJson(payload: unknown): Promise<string> {
  const server = createServer((_, response) => {
    const body = JSON.stringify(payload);
    response.writeHead(200, {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body),
    });
    response.end(body);
  });

  servers.push(server);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to allocate test server port');
  }

  return `http://127.0.0.1:${address.port}/openapi.json`;
}

async function waitForJob(service: OpenApiCatalogService, jobId: string): Promise<Job> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const job = await service.getJob(jobId);
    if (job.status !== 'pending' && job.status !== 'running') {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out waiting for job ${jobId}`);
}

function petstoreLikeDocument(): unknown {
  return {
    openapi: '3.0.3',
    info: { title: 'Catalog Test API', version: '1.0.0' },
    servers: [{ url: 'https://api.example.test' }],
    paths: {
      '/users/{id}': {
        get: {
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
          responses: {
            '200': {
              description: 'OK',
              content: {
                'application/json': {
                  schema: { type: 'object' },
                },
              },
            },
          },
        },
      },
      '/orders': {
        post: {
          operationId: 'createOrder',
          summary: 'Create order',
          tags: ['orders'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { type: 'object' },
                example: { sku: 'A-1', quantity: 1 },
              },
            },
          },
          responses: {
            '201': { description: 'Created' },
          },
        },
      },
    },
  };
}
