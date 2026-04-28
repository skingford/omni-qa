import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { parseOpenAPI } from '@omni-qa/core/openapi/parser';
import type { ParsedEndpoint } from '@omni-qa/core/openapi/types';
import {
  internalError,
  limitExceededError,
  notFoundError,
  validationError,
} from '../domain/errors.js';
import type {
  ApiEndpoint,
  ApiSpec,
  EndpointFilter,
  EndpointSelection,
  HttpMethod,
  Job,
  ServerConfig,
} from '../domain/types.js';
import type { Repositories } from '../repositories/types.js';

export interface ImportOpenApiResult {
  job: Job;
}

export interface CreateSelectionInput {
  specId: string;
  endpointIds: string[];
  name?: string;
}

export class OpenApiCatalogService {
  constructor(
    private readonly repos: Repositories,
    private readonly config: ServerConfig,
  ) {}

  async startImport(sourceUrl: string): Promise<ImportOpenApiResult> {
    validateHttpUrl(sourceUrl);

    const now = new Date().toISOString();
    const job: Job = {
      id: randomUUID(),
      type: 'openapi-import',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    await this.repos.jobs.save(job);

    queueMicrotask(() => {
      void this.runImport(job.id, sourceUrl);
    });

    return { job };
  }

  async getJob(jobId: string): Promise<Job> {
    const job = await this.repos.jobs.get(jobId);
    if (!job) {
      throw notFoundError(`Job ${jobId} not found`);
    }
    return job;
  }

  async listSpecs(): Promise<ApiSpec[]> {
    return this.repos.specs.list();
  }

  async listEndpoints(specId: string, filter?: EndpointFilter): Promise<ApiEndpoint[]> {
    const spec = await this.repos.specs.get(specId);
    if (!spec) {
      throw notFoundError(`Spec ${specId} not found`);
    }
    return this.repos.endpoints.list(specId, filter);
  }

  async createSelection(input: CreateSelectionInput): Promise<EndpointSelection> {
    if (!input.specId) {
      throw validationError('specId is required');
    }

    const uniqueEndpointIds = Array.from(new Set(input.endpointIds));
    if (uniqueEndpointIds.length === 0) {
      throw validationError('endpointIds must not be empty');
    }
    if (uniqueEndpointIds.length > this.config.limits.maxSelectionSize) {
      throw limitExceededError(
        `endpointIds exceeds maximum selection size ${this.config.limits.maxSelectionSize}`,
      );
    }

    const spec = await this.repos.specs.get(input.specId);
    if (!spec) {
      throw notFoundError(`Spec ${input.specId} not found`);
    }

    const endpoints = await this.repos.endpoints.getMany(input.specId, uniqueEndpointIds);
    if (endpoints.length !== uniqueEndpointIds.length) {
      throw validationError('endpointIds contains unknown endpoints for this spec');
    }

    const selection: EndpointSelection = {
      id: randomUUID(),
      specId: input.specId,
      endpointIds: uniqueEndpointIds,
      createdAt: new Date().toISOString(),
      name: input.name,
    };

    await this.repos.selections.save(selection);
    return selection;
  }

  private async runImport(jobId: string, sourceUrl: string): Promise<void> {
    const startedAt = new Date().toISOString();
    await this.repos.jobs.update(jobId, { status: 'running', startedAt });

    try {
      const imported = await this.importNow(sourceUrl);
      await this.repos.jobs.update(jobId, {
        status: 'succeeded',
        finishedAt: new Date().toISOString(),
        result: {
          specId: imported.spec.id,
          endpointCount: imported.endpoints.length,
        },
      });
    } catch (error) {
      await this.repos.jobs.update(jobId, {
        status: 'failed',
        finishedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'OpenAPI import failed',
      });
    }
  }

  private async importNow(sourceUrl: string): Promise<{ spec: ApiSpec; endpoints: ApiEndpoint[] }> {
    const fetched = await fetchOpenApiDocument(sourceUrl, {
      maxBytes: this.config.limits.importMaxBytes,
      timeoutMs: this.config.limits.importTimeoutMs,
    });

    const contentHash = createHash('sha256').update(fetched.body).digest('hex');
    const specId = `spec_${contentHash.slice(0, 16)}`;
    const importDir = join(this.config.dataDir, 'imports');
    await mkdir(importDir, { recursive: true });

    const sourcePath = join(importDir, `${specId}${guessOpenApiExtension(sourceUrl, fetched.contentType)}`);
    await writeFile(sourcePath, fetched.body);

    const parsed = await withTimeout(
      parseOpenAPI(sourcePath),
      this.config.limits.parseTimeoutMs,
      `OpenAPI parse timed out after ${this.config.limits.parseTimeoutMs}ms`,
    );

    if (parsed.endpoints.length === 0) {
      throw validationError('OpenAPI document contains no supported endpoints');
    }
    if (parsed.endpoints.length > this.config.limits.maxEndpointsPerSpec) {
      throw limitExceededError(
        `OpenAPI endpoint count ${parsed.endpoints.length} exceeds limit ${this.config.limits.maxEndpointsPerSpec}`,
      );
    }

    const spec: ApiSpec = {
      id: specId,
      sourceUrl,
      title: parsed.title,
      version: parsed.version,
      baseUrl: parsed.baseURL,
      importedAt: new Date().toISOString(),
      contentHash,
      endpointCount: parsed.endpoints.length,
    };

    const endpoints = parsed.endpoints.map((endpoint) => normalizeEndpoint(spec.id, endpoint));

    await this.repos.specs.save(spec);
    await this.repos.endpoints.saveMany(spec.id, endpoints);

    return { spec, endpoints };
  }
}

interface FetchOpenApiOptions {
  maxBytes: number;
  timeoutMs: number;
}

interface FetchOpenApiResult {
  body: Buffer;
  contentType: string;
}

async function fetchOpenApiDocument(
  sourceUrl: string,
  options: FetchOpenApiOptions,
): Promise<FetchOpenApiResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(sourceUrl, { signal: controller.signal });
    if (!response.ok) {
      throw validationError(`OpenAPI URL responded with HTTP ${response.status}`);
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength && Number(contentLength) > options.maxBytes) {
      throw limitExceededError(`OpenAPI document exceeds ${options.maxBytes} bytes`);
    }

    const chunks: Buffer[] = [];
    let total = 0;

    if (!response.body) {
      throw validationError('OpenAPI URL returned an empty response body');
    }

    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const buffer = Buffer.from(value);
        total += buffer.byteLength;
        if (total > options.maxBytes) {
          throw limitExceededError(`OpenAPI document exceeds ${options.maxBytes} bytes`);
        }
        chunks.push(buffer);
      }
    } finally {
      reader.releaseLock();
    }

    return {
      body: Buffer.concat(chunks, total),
      contentType: response.headers.get('content-type') ?? '',
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw validationError(`OpenAPI URL fetch timed out after ${options.timeoutMs}ms`, error);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeEndpoint(specId: string, endpoint: ParsedEndpoint): ApiEndpoint {
  const endpointKey = [
    specId,
    endpoint.method,
    endpoint.path,
    endpoint.operationId ?? '',
  ].join(':');

  return {
    id: `ep_${createHash('sha256').update(endpointKey).digest('hex').slice(0, 20)}`,
    specId,
    method: endpoint.method as HttpMethod,
    path: endpoint.path,
    operationId: endpoint.operationId,
    summary: endpoint.summary,
    description: endpoint.description,
    tags: endpoint.tags,
    parameters: endpoint.parameters,
    requestBody: endpoint.requestBody,
    responses: endpoint.responses,
    deprecated: false,
  };
}

function validateHttpUrl(sourceUrl: string): void {
  if (!sourceUrl.trim()) {
    throw validationError('sourceUrl is required');
  }

  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch (error) {
    throw validationError('sourceUrl must be a valid URL', error);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw validationError('sourceUrl must use http or https');
  }
}

function guessOpenApiExtension(sourceUrl: string, contentType: string): '.json' | '.yaml' {
  const ext = extname(new URL(sourceUrl).pathname).toLowerCase();
  if (ext === '.json') return '.json';
  if (ext === '.yaml' || ext === '.yml') return '.yaml';
  return contentType.includes('json') ? '.json' : '.yaml';
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(internalError(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
