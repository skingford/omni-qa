export interface ParsedEndpoint {
  path: string;
  method: string;
  operationId?: string;
  summary?: string;
  description?: string;
  tags: string[];
  parameters: ParsedParameter[];
  requestBody?: ParsedRequestBody;
  responses: ParsedResponse[];
}

export interface ParsedParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  required: boolean;
  schema?: Record<string, unknown>;
  description?: string;
  example?: unknown;
}

export interface ParsedRequestBody {
  required: boolean;
  contentType: string;
  schema?: Record<string, unknown>;
  example?: unknown;
}

export interface ParsedResponse {
  statusCode: string;
  description?: string;
  schema?: Record<string, unknown>;
}

export interface ParsedAPI {
  title: string;
  version: string;
  baseURL?: string;
  endpoints: ParsedEndpoint[];
}

export interface EndpointGroup {
  name: string;
  endpoints: ParsedEndpoint[];
}
