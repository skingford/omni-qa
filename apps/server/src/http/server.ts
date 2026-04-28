import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { validationError } from '../domain/errors.js';
import type { EndpointFilter, HttpMethod, ServerConfig } from '../domain/types.js';
import { createJsonRepositories } from '../repositories/json-store.js';
import type { Repositories } from '../repositories/types.js';
import { TestExecutionService } from '../services/execution-service.js';
import { TestCaseGenerationService } from '../services/generation-service.js';
import { OpenApiCatalogService } from '../services/import-service.js';
import { readJsonBody, sendError, sendJson, sendNoContent } from './json.js';

export interface ServerRuntime {
  config: ServerConfig;
  repos: Repositories;
  catalog: OpenApiCatalogService;
  generation: TestCaseGenerationService;
  execution: TestExecutionService;
}

export function createRuntime(config: ServerConfig): ServerRuntime {
  const repos = createJsonRepositories(config.dataDir);
  return {
    config,
    repos,
    catalog: new OpenApiCatalogService(repos, config),
    generation: new TestCaseGenerationService(repos, config),
    execution: new TestExecutionService(repos, config),
  };
}

export function createHttpServer(runtime: ServerRuntime) {
  return createServer(async (request, response) => {
    setCorsHeaders(response);

    if (request.method === 'OPTIONS') {
      sendNoContent(response);
      return;
    }

    try {
      await routeRequest(runtime, request, response);
    } catch (error) {
      sendError(response, error);
    }
  });
}

async function routeRequest(
  runtime: ServerRuntime,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const method = request.method ?? 'GET';
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);
  const segments = url.pathname.split('/').filter(Boolean);

  if (method === 'GET' && url.pathname === '/healthz') {
    sendJson(response, 200, {
      ok: true,
      service: '@omni-qa/server',
      limits: runtime.config.limits,
    });
    return;
  }

  if (method === 'POST' && url.pathname === '/api/openapi/import') {
    const body = await readJsonBody<{ sourceUrl?: string }>(request);
    const result = await runtime.catalog.startImport(body.sourceUrl ?? '');
    sendJson(response, 202, result);
    return;
  }

  if (method === 'GET' && segments[0] === 'api' && segments[1] === 'jobs' && segments[2]) {
    const job = await runtime.catalog.getJob(segments[2]);
    sendJson(response, 200, { job });
    return;
  }

  if (method === 'GET' && url.pathname === '/api/specs') {
    const specs = await runtime.catalog.listSpecs();
    sendJson(response, 200, { specs });
    return;
  }

  if (
    method === 'GET' &&
    segments[0] === 'api' &&
    segments[1] === 'specs' &&
    segments[2] &&
    segments[3] === 'endpoints'
  ) {
    const filter = endpointFilterFromSearch(url.searchParams);
    const endpoints = await runtime.catalog.listEndpoints(segments[2], filter);
    sendJson(response, 200, { endpoints });
    return;
  }

  if (method === 'POST' && url.pathname === '/api/selections') {
    const body = await readJsonBody<{
      specId?: string;
      endpointIds?: string[];
      name?: string;
    }>(request);
    const selection = await runtime.catalog.createSelection({
      specId: body.specId ?? '',
      endpointIds: body.endpointIds ?? [],
      name: body.name,
    });
    sendJson(response, 201, { selection });
    return;
  }

  if (method === 'POST' && url.pathname === '/api/test-cases/generate') {
    const body = await readJsonBody<{
      selectionId?: string;
      specId?: string;
      endpointIds?: string[];
      useFallback?: boolean;
    }>(request);
    const result = await runtime.generation.startGeneration({
      selectionId: body.selectionId,
      specId: body.specId,
      endpointIds: body.endpointIds,
      useFallback: body.useFallback,
    });
    sendJson(response, 202, result);
    return;
  }

  if (method === 'GET' && url.pathname === '/api/test-cases') {
    const cases = await runtime.generation.listCases({
      specId: url.searchParams.get('specId') ?? undefined,
      endpointId: url.searchParams.get('endpointId') ?? undefined,
      selectionId: url.searchParams.get('selectionId') ?? undefined,
    });
    sendJson(response, 200, { cases });
    return;
  }

  if (method === 'POST' && url.pathname === '/api/test-runs') {
    const body = await readJsonBody<{
      caseIds?: string[];
      envId?: string;
      workers?: number;
    }>(request);
    const result = await runtime.execution.startRun({
      caseIds: body.caseIds ?? [],
      envId: body.envId ?? 'dev',
      workers: body.workers,
    });
    sendJson(response, 202, result);
    return;
  }

  if (method === 'GET' && segments[0] === 'api' && segments[1] === 'test-runs' && segments[2] && !segments[3]) {
    const run = await runtime.execution.getRun(segments[2]);
    sendJson(response, 200, { run });
    return;
  }

  if (
    method === 'GET' &&
    segments[0] === 'api' &&
    segments[1] === 'test-runs' &&
    segments[2] &&
    segments[3] === 'results'
  ) {
    const results = await runtime.execution.listResults(segments[2]);
    sendJson(response, 200, { results });
    return;
  }

  if (
    method === 'GET' &&
    segments[0] === 'api' &&
    segments[1] === 'test-runs' &&
    segments[2] &&
    segments[3] === 'report'
  ) {
    const report = await runtime.execution.getReport(segments[2]);
    sendJson(response, 200, { report });
    return;
  }

  if (
    method === 'POST' &&
    segments[0] === 'api' &&
    segments[1] === 'test-runs' &&
    segments[2] &&
    segments[3] === 'cancel'
  ) {
    const run = await runtime.execution.cancelRun(segments[2]);
    sendJson(response, 200, { run });
    return;
  }

  throw validationError(`No route for ${method} ${url.pathname}`);
}

function endpointFilterFromSearch(search: URLSearchParams): EndpointFilter {
  const methods = search.getAll('method').map((value) => value.toUpperCase() as HttpMethod);
  const tags = search.getAll('tag');
  const limit = parsePositiveInt(search.get('limit'));
  const offset = parsePositiveInt(search.get('offset'));

  return {
    methods: methods.length > 0 ? methods : undefined,
    tags: tags.length > 0 ? tags : undefined,
    keyword: search.get('keyword') ?? undefined,
    path: search.get('path') ?? undefined,
    operationId: search.get('operationId') ?? undefined,
    limit,
    offset,
  };
}

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function setCorsHeaders(response: ServerResponse): void {
  response.setHeader('access-control-allow-origin', '*');
  response.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  response.setHeader('access-control-allow-headers', 'content-type');
}
