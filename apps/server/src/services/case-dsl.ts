import { randomUUID } from 'node:crypto';
import { validationError } from '../domain/errors.js';
import type {
  ApiEndpoint,
  HttpMethod,
  TestAssertion,
  TestCase,
  TestRequestSpec,
} from '../domain/types.js';
import { isExecutableText, redactSensitive } from './redaction.js';

const ASSERTION_TYPES = new Set(['status', 'header', 'jsonPath', 'schema', 'latency']);
const ASSERTION_OPERATORS = new Set(['eq', 'neq', 'contains', 'exists', 'lt', 'lte', 'gt', 'gte']);
const SCENARIO_TYPES = new Set(['smoke', 'positive', 'negative', 'boundary', 'auth']);
const PRIORITIES = new Set(['low', 'medium', 'high']);
const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

export interface ValidateCasesOptions {
  endpoints: ApiEndpoint[];
  specId: string;
  selectionId?: string;
  model?: string;
  promptVersion?: string;
}

export function normalizeAIOutput(output: unknown): unknown[] {
  if (isExecutableText(output)) {
    throw validationError('AI output contains executable text instead of JSON DSL');
  }

  if (Array.isArray(output)) {
    return output;
  }

  if (output && typeof output === 'object') {
    const cases = (output as { cases?: unknown }).cases;
    if (Array.isArray(cases)) {
      return cases;
    }
  }

  throw validationError('AI output must be an array or an object with cases array');
}

export function validateTestCases(output: unknown, options: ValidateCasesOptions): TestCase[] {
  const rawCases = normalizeAIOutput(output);
  if (rawCases.length === 0) {
    throw validationError('AI output contains no test cases');
  }

  const endpointsById = new Map(options.endpoints.map((endpoint) => [endpoint.id, endpoint]));
  const now = new Date().toISOString();
  const cases = new Array<TestCase>(rawCases.length);

  for (let index = 0; index < rawCases.length; index += 1) {
    const rawCase = rawCases[index];
    if (!rawCase || typeof rawCase !== 'object' || isExecutableText(JSON.stringify(rawCase))) {
      throw validationError(`AI case at index ${index} is not valid JSON DSL`);
    }

    const candidate = rawCase as Record<string, unknown>;
    const endpointId = readString(candidate.endpointId, `cases[${index}].endpointId`);
    const endpoint = endpointsById.get(endpointId);
    if (!endpoint) {
      throw validationError(`cases[${index}].endpointId does not match selected endpoints`);
    }

    const request = validateRequest(candidate.request, endpoint, index);
    const assertions = validateAssertions(candidate.assertions, index);
    const scenarioType = readEnum(candidate.scenarioType, SCENARIO_TYPES, 'smoke') as TestCase['scenarioType'];
    const priority = readEnum(candidate.priority, PRIORITIES, 'medium') as TestCase['priority'];

    cases[index] = {
      id: randomUUID(),
      endpointId,
      specId: options.specId,
      name: readOptionalString(candidate.name) ?? `${endpoint.method} ${endpoint.path} smoke`,
      scenarioType,
      priority,
      status: 'validated',
      request: redactSensitive(request) as TestRequestSpec,
      assertions,
      tags: readStringArray(candidate.tags, endpoint.tags),
      createdAt: now,
      selectionId: options.selectionId,
      model: options.model,
      promptVersion: options.promptVersion,
    };
  }

  return cases;
}

function validateRequest(value: unknown, endpoint: ApiEndpoint, index: number): TestRequestSpec {
  if (!value || typeof value !== 'object') {
    throw validationError(`cases[${index}].request is required`);
  }

  const request = value as Record<string, unknown>;
  const method = readEnum(request.method, METHODS, endpoint.method) as HttpMethod;
  const path = readOptionalString(request.path) ?? endpoint.path;
  if (method !== endpoint.method) {
    throw validationError(`cases[${index}].request.method must match endpoint method`);
  }

  return {
    method,
    path,
    query: readRecord(request.query),
    headers: readStringRecord(request.headers),
    body: request.body,
    timeoutMs: readOptionalNumber(request.timeoutMs),
  };
}

function validateAssertions(value: unknown, index: number): TestAssertion[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw validationError(`cases[${index}].assertions must not be empty`);
  }

  return value.map((assertion, assertionIndex) => {
    if (!assertion || typeof assertion !== 'object') {
      throw validationError(`cases[${index}].assertions[${assertionIndex}] is invalid`);
    }

    const raw = assertion as Record<string, unknown>;
    return {
      type: readEnum(raw.type, ASSERTION_TYPES, undefined, `cases[${index}].assertions[${assertionIndex}].type`) as TestAssertion['type'],
      operator: readEnum(
        raw.operator,
        ASSERTION_OPERATORS,
        undefined,
        `cases[${index}].assertions[${assertionIndex}].operator`,
      ) as TestAssertion['operator'],
      target: readOptionalString(raw.target),
      expected: raw.expected,
    };
  });
}

function readString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw validationError(`${field} must be a non-empty string`);
  }
  return value;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readEnum(
  value: unknown,
  allowed: Set<string>,
  fallback?: string,
  field = 'enum field',
): string {
  if (typeof value === 'string' && allowed.has(value)) {
    return value;
  }
  if (fallback !== undefined) {
    return fallback;
  }
  throw validationError(`${field} has unsupported value`);
}

function readStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function readRecord(value: unknown): Record<string, string | number | boolean> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const result: Record<string, string | number | boolean> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (
      typeof nested === 'string' ||
      typeof nested === 'number' ||
      typeof nested === 'boolean'
    ) {
      result[key] = nested;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function readStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const result: Record<string, string> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (typeof nested === 'string') {
      result[key] = nested;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}
