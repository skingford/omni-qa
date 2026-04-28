import { randomUUID } from 'node:crypto';
import { notFoundError, validationError } from '../domain/errors.js';
import type {
  ApiEndpoint,
  EndpointSelection,
  Job,
  ServerConfig,
  TestAssertion,
  TestCase,
  TestRequestSpec,
} from '../domain/types.js';
import type { Repositories } from '../repositories/types.js';
import { validateTestCases } from './case-dsl.js';
import { buildCaseGenerationPrompt } from './prompt-builder.js';
import { redactSensitive } from './redaction.js';

export interface AITestCaseProvider {
  readonly model: string;
  generateCases(input: { prompt: string; endpoints: ApiEndpoint[] }): Promise<unknown>;
}

export interface StartGenerationInput {
  selectionId?: string;
  specId?: string;
  endpointIds?: string[];
  useFallback?: boolean;
}

export class TestCaseGenerationService {
  constructor(
    private readonly repos: Repositories,
    private readonly config: ServerConfig,
    private readonly provider?: AITestCaseProvider,
  ) {}

  async startGeneration(input: StartGenerationInput): Promise<{ job: Job }> {
    const target = await this.resolveGenerationTarget(input);
    if (target.endpoints.length === 0) {
      throw validationError('No endpoints selected for test case generation');
    }

    const now = new Date().toISOString();
    const job: Job = {
      id: randomUUID(),
      type: 'ai-generation',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      result: {
        specId: target.specId,
        selectionId: target.selection?.id,
        endpointCount: target.endpoints.length,
      },
    };

    await this.repos.jobs.save(job);

    queueMicrotask(() => {
      void this.runGeneration(job.id, target, input.useFallback ?? true);
    });

    return { job };
  }

  async listCases(filter: { specId?: string; endpointId?: string; selectionId?: string }): Promise<TestCase[]> {
    return this.repos.cases.list(filter);
  }

  private async runGeneration(
    jobId: string,
    target: GenerationTarget,
    useFallback: boolean,
  ): Promise<void> {
    await this.repos.jobs.update(jobId, { status: 'running', startedAt: new Date().toISOString() });

    try {
      const generated = await this.generateCases(target, useFallback);
      await this.repos.cases.saveMany(generated);
      await this.repos.jobs.update(jobId, {
        status: 'succeeded',
        finishedAt: new Date().toISOString(),
        result: {
          specId: target.specId,
          selectionId: target.selection?.id,
          caseCount: generated.length,
          model: generated[0]?.model,
          promptVersion: generated[0]?.promptVersion,
        },
      });
    } catch (error) {
      await this.repos.jobs.update(jobId, {
        status: 'failed',
        finishedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'AI test case generation failed',
      });
    }
  }

  private async generateCases(target: GenerationTarget, useFallback: boolean): Promise<TestCase[]> {
    const prompt = buildCaseGenerationPrompt(target.endpoints, this.config.limits.aiPromptMaxChars);

    if (this.provider) {
      const output = await this.provider.generateCases({
        prompt: prompt.prompt,
        endpoints: target.endpoints,
      });

      return validateTestCases(output, {
        endpoints: target.endpoints,
        specId: target.specId,
        selectionId: target.selection?.id,
        model: this.provider.model,
        promptVersion: prompt.promptVersion,
      });
    }

    if (!useFallback) {
      throw validationError('AI provider is not configured and fallback generation is disabled');
    }

    return deterministicFallbackCases(target.endpoints, {
      specId: target.specId,
      selectionId: target.selection?.id,
      promptVersion: prompt.promptVersion,
    });
  }

  private async resolveGenerationTarget(input: StartGenerationInput): Promise<GenerationTarget> {
    if (input.selectionId) {
      const selection = await this.repos.selections.get(input.selectionId);
      if (!selection) {
        throw notFoundError(`Selection ${input.selectionId} not found`);
      }

      const endpoints = await this.repos.endpoints.getMany(selection.specId, selection.endpointIds);
      if (endpoints.length !== selection.endpointIds.length) {
        throw validationError('Selection contains endpoints that no longer exist');
      }

      return { specId: selection.specId, selection, endpoints };
    }

    if (!input.specId) {
      throw validationError('specId is required when selectionId is not provided');
    }

    const endpointIds = Array.from(new Set(input.endpointIds ?? []));
    if (endpointIds.length === 0) {
      throw validationError('endpointIds must not be empty');
    }

    const spec = await this.repos.specs.get(input.specId);
    if (!spec) {
      throw notFoundError(`Spec ${input.specId} not found`);
    }

    const endpoints = await this.repos.endpoints.getMany(input.specId, endpointIds);
    if (endpoints.length !== endpointIds.length) {
      throw validationError('endpointIds contains unknown endpoints for this spec');
    }

    return { specId: input.specId, endpoints };
  }
}

interface GenerationTarget {
  specId: string;
  endpoints: ApiEndpoint[];
  selection?: EndpointSelection;
}

function deterministicFallbackCases(
  endpoints: ApiEndpoint[],
  options: { specId: string; selectionId?: string; promptVersion: string },
): TestCase[] {
  const now = new Date().toISOString();
  const cases = new Array<TestCase>(endpoints.length);

  for (let index = 0; index < endpoints.length; index += 1) {
    const endpoint = endpoints[index]!;
    const request = buildFallbackRequest(endpoint);

    cases[index] = {
      id: randomUUID(),
      endpointId: endpoint.id,
      specId: options.specId,
      selectionId: options.selectionId,
      name: `${endpoint.method} ${endpoint.path} smoke`,
      scenarioType: 'smoke',
      priority: 'medium',
      status: 'validated',
      request: redactSensitive(request) as TestRequestSpec,
      assertions: [successStatusAssertion(endpoint)],
      tags: [...endpoint.tags, 'fallback', 'smoke'],
      createdAt: now,
      model: 'deterministic-fallback',
      promptVersion: options.promptVersion,
    };
  }

  return cases;
}

function buildFallbackRequest(endpoint: ApiEndpoint): TestRequestSpec {
  const query: Record<string, string | number | boolean> = {};
  let path = endpoint.path;

  for (const param of endpoint.parameters) {
    const value = exampleValue(param.example, param.schema, param.name);
    if (param.in === 'path') {
      path = path.replace(`{${param.name}}`, encodeURIComponent(String(value)));
    } else if (param.in === 'query' && param.required) {
      query[param.name] = value;
    }
  }

  return {
    method: endpoint.method,
    path,
    query: Object.keys(query).length > 0 ? query : undefined,
    body: endpoint.requestBody ? requestBodyExample(endpoint) : undefined,
    timeoutMs: 30_000,
  };
}

function requestBodyExample(endpoint: ApiEndpoint): unknown {
  if (endpoint.requestBody?.example !== undefined) {
    return endpoint.requestBody.example;
  }
  return exampleFromSchema(endpoint.requestBody?.schema);
}

function successStatusAssertion(endpoint: ApiEndpoint): TestAssertion {
  const success = endpoint.responses.find((response) => /^2\d\d$/.test(response.statusCode));
  if (success) {
    return {
      type: 'status',
      operator: 'eq',
      expected: Number(success.statusCode),
    };
  }

  return {
    type: 'status',
    operator: 'lt',
    expected: 500,
  };
}

function exampleValue(example: unknown, schema: Record<string, unknown> | undefined, name: string): string | number | boolean {
  if (
    typeof example === 'string' ||
    typeof example === 'number' ||
    typeof example === 'boolean'
  ) {
    return example;
  }

  const enumValues = schema?.enum;
  if (Array.isArray(enumValues) && enumValues.length > 0) {
    const first = enumValues[0];
    if (typeof first === 'string' || typeof first === 'number' || typeof first === 'boolean') {
      return first;
    }
  }

  switch (schema?.type) {
    case 'integer':
    case 'number':
      return 1;
    case 'boolean':
      return true;
    default:
      return `sample-${name}`;
  }
}

function exampleFromSchema(schema: Record<string, unknown> | undefined): unknown {
  if (!schema) {
    return {};
  }

  if (schema.example !== undefined) {
    return schema.example;
  }

  if (schema.type === 'array') {
    return [exampleFromSchema(schema.items as Record<string, unknown> | undefined)];
  }

  if (schema.type === 'object' || schema.properties) {
    const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
    const result: Record<string, unknown> = {};
    for (const [key, propertySchema] of Object.entries(properties)) {
      result[key] = exampleFromSchema(propertySchema);
    }
    return result;
  }

  switch (schema.type) {
    case 'integer':
    case 'number':
      return 1;
    case 'boolean':
      return true;
    case 'string':
      return 'sample';
    default:
      return {};
  }
}
