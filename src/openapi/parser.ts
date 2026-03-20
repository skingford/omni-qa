import SwaggerParser from '@apidevtools/swagger-parser';
import type { OpenAPI, OpenAPIV3 } from 'openapi-types';
import type {
  ParsedAPI,
  ParsedEndpoint,
  ParsedParameter,
  ParsedRequestBody,
  ParsedResponse,
  EndpointGroup,
} from './types.js';

/**
 * Parse an OpenAPI document (file path or URL) into a structured format.
 */
export async function parseOpenAPI(source: string): Promise<ParsedAPI> {
  const api = (await SwaggerParser.dereference(source)) as OpenAPIV3.Document;

  const title = api.info?.title ?? 'Untitled API';
  const version = api.info?.version ?? '0.0.0';

  // Extract base URL from servers
  const baseURL = api.servers?.[0]?.url;

  const endpoints: ParsedEndpoint[] = [];

  for (const [path, pathItem] of Object.entries(api.paths ?? {})) {
    if (!pathItem) continue;

    const methods = [
      'get', 'post', 'put', 'patch', 'delete', 'head', 'options',
    ] as const;

    for (const method of methods) {
      const operation = pathItem[method] as OpenAPIV3.OperationObject | undefined;
      if (!operation) continue;

      endpoints.push({
        path,
        method: method.toUpperCase(),
        operationId: operation.operationId,
        summary: operation.summary,
        description: operation.description,
        tags: operation.tags ?? ['default'],
        parameters: parseParameters(operation.parameters as OpenAPIV3.ParameterObject[]),
        requestBody: parseRequestBody(operation.requestBody as OpenAPIV3.RequestBodyObject),
        responses: parseResponses(operation.responses as OpenAPIV3.ResponsesObject),
      });
    }
  }

  return { title, version, baseURL, endpoints };
}

function parseParameters(params?: OpenAPIV3.ParameterObject[]): ParsedParameter[] {
  if (!params) return [];

  return params.map((p) => ({
    name: p.name,
    in: p.in as ParsedParameter['in'],
    required: p.required ?? false,
    schema: p.schema as Record<string, unknown> | undefined,
    description: p.description,
    example: p.example,
  }));
}

function parseRequestBody(
  body?: OpenAPIV3.RequestBodyObject
): ParsedRequestBody | undefined {
  if (!body) return undefined;

  const contentTypes = Object.keys(body.content ?? {});
  const contentType = contentTypes[0] ?? 'application/json';
  const mediaType = body.content?.[contentType];

  return {
    required: body.required ?? false,
    contentType,
    schema: mediaType?.schema as Record<string, unknown> | undefined,
    example: mediaType?.example,
  };
}

function parseResponses(responses?: OpenAPIV3.ResponsesObject): ParsedResponse[] {
  if (!responses) return [];

  return Object.entries(responses).map(([statusCode, response]) => {
    const res = response as OpenAPIV3.ResponseObject;
    const contentType = Object.keys(res.content ?? {})[0];
    const mediaType = contentType ? res.content?.[contentType] : undefined;

    return {
      statusCode,
      description: res.description,
      schema: mediaType?.schema as Record<string, unknown> | undefined,
    };
  });
}

/**
 * Group endpoints by their first tag (or path prefix).
 */
export function groupEndpoints(endpoints: ParsedEndpoint[]): EndpointGroup[] {
  const groups = new Map<string, ParsedEndpoint[]>();

  for (const endpoint of endpoints) {
    const groupName = endpoint.tags[0] ?? deriveGroupFromPath(endpoint.path);
    const list = groups.get(groupName) ?? [];
    list.push(endpoint);
    groups.set(groupName, list);
  }

  return Array.from(groups.entries()).map(([name, eps]) => ({
    name,
    endpoints: eps,
  }));
}

function deriveGroupFromPath(path: string): string {
  // /api/v1/users/{id} → users
  const segments = path.split('/').filter(Boolean);
  // Skip common prefixes like 'api', 'v1', 'v2'
  const meaningful = segments.filter((s) => !s.match(/^(api|v\d+)$/i));
  return meaningful[0] ?? 'default';
}
