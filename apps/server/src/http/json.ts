import type { IncomingMessage, ServerResponse } from 'node:http';
import { AppError, toAppError, validationError } from '../domain/errors.js';

const MAX_JSON_BODY_BYTES = 1024 * 1024;

export async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    total += buffer.byteLength;
    if (total > MAX_JSON_BODY_BYTES) {
      throw validationError(`JSON body exceeds ${MAX_JSON_BODY_BYTES} bytes`);
    }
    chunks.push(buffer);
  }

  if (total === 0) {
    return {} as T;
  }

  try {
    return JSON.parse(Buffer.concat(chunks, total).toString('utf-8')) as T;
  } catch (error) {
    throw validationError('Request body must be valid JSON', error);
  }
}

export function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload, null, 2);
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  response.end(body);
}

export function sendNoContent(response: ServerResponse): void {
  response.writeHead(204);
  response.end();
}

export function sendError(response: ServerResponse, error: unknown): void {
  const appError = toAppError(error);
  const exposeCause = appError instanceof AppError && appError.statusCode < 500;
  sendJson(response, appError.statusCode, {
    error: {
      code: appError.code,
      message: appError.message,
      cause: exposeCause && appError.cause instanceof Error ? appError.cause.message : undefined,
    },
  });
}
