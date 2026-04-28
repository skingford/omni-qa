import type { ApiEndpoint } from '../domain/types.js';
import { redactSensitive } from './redaction.js';

export interface PromptBuildResult {
  prompt: string;
  promptVersion: string;
  truncated: boolean;
}

const PROMPT_VERSION = 'api-case-v1';

export function buildCaseGenerationPrompt(
  endpoints: ApiEndpoint[],
  maxChars: number,
): PromptBuildResult {
  const payload = {
    instruction:
      'Generate API test cases as JSON only. Return {"cases":[...]} using the provided DSL. Do not return code.',
    dsl: {
      name: 'string',
      endpointId: 'string',
      scenarioType: 'smoke|positive|negative|boundary|auth',
      priority: 'low|medium|high',
      request: {
        method: 'GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS',
        path: 'string',
        query: 'object optional',
        headers: 'object optional',
        body: 'any optional',
        timeoutMs: 'number optional',
      },
      assertions: [
        {
          type: 'status|header|jsonPath|schema|latency',
          operator: 'eq|neq|contains|exists|lt|lte|gt|gte',
          target: 'string optional',
          expected: 'any optional',
        },
      ],
      tags: ['string'],
    },
    endpoints: redactSensitive(endpoints),
  };

  const fullPrompt = JSON.stringify(payload, null, 2);
  if (fullPrompt.length <= maxChars) {
    return { prompt: fullPrompt, promptVersion: PROMPT_VERSION, truncated: false };
  }

  const header = JSON.stringify({ ...payload, endpoints: undefined }, null, 2);
  const budget = Math.max(1_000, maxChars - header.length - 128);
  const compactEndpoints = endpoints.map((endpoint) => ({
    id: endpoint.id,
    method: endpoint.method,
    path: endpoint.path,
    operationId: endpoint.operationId,
    summary: endpoint.summary,
    tags: endpoint.tags,
  }));
  const compact = JSON.stringify({ ...payload, endpoints: compactEndpoints }, null, 2);

  if (compact.length <= maxChars) {
    return { prompt: compact, promptVersion: PROMPT_VERSION, truncated: true };
  }

  return {
    prompt: `${compact.slice(0, budget)}\n/* truncated: endpoint ids preserved in earlier context */`,
    promptVersion: PROMPT_VERSION,
    truncated: true,
  };
}
