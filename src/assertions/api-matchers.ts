import { expect, type APIResponse } from '@playwright/test';

/**
 * Custom matchers for API testing.
 *
 * Usage:
 *   import '../assertions/api-matchers.js';
 *
 *   expect(response).toBeSuccessful();
 *   expect(response).toHaveStatus(201);
 *   expect(body).toMatchSchema(schema);
 */

expect.extend({
  async toBeSuccessful(response: APIResponse) {
    const status = response.status();
    const pass = status >= 200 && status < 300;

    let body = '';
    if (!pass) {
      try {
        body = await response.text();
      } catch {
        body = '(unable to read body)';
      }
    }

    return {
      pass,
      message: () =>
        pass
          ? `Expected response NOT to be successful, but got ${status}`
          : `Expected response to be successful (2xx), but got ${status}\n${body}`,
    };
  },

  async toHaveStatus(response: APIResponse, expected: number) {
    const actual = response.status();
    const pass = actual === expected;

    let body = '';
    if (!pass) {
      try {
        body = await response.text();
      } catch {
        body = '(unable to read body)';
      }
    }

    return {
      pass,
      message: () =>
        pass
          ? `Expected response NOT to have status ${expected}`
          : `Expected status ${expected}, but got ${actual}\n${body}`,
    };
  },

  toMatchSchema(received: unknown, schema: Record<string, unknown>) {
    const errors = validateSchema(received, schema);
    const pass = errors.length === 0;

    return {
      pass,
      message: () =>
        pass
          ? `Expected value NOT to match schema`
          : `Schema validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`,
    };
  },

  toHaveJsonBody(response: APIResponse) {
    const contentType = response.headers()['content-type'] ?? '';
    const pass = contentType.includes('application/json');

    return {
      pass,
      message: () =>
        pass
          ? `Expected response NOT to have JSON body`
          : `Expected Content-Type to include "application/json", got "${contentType}"`,
    };
  },
});

/**
 * Basic schema validation: checks type, required fields, and nested objects.
 */
function validateSchema(
  value: unknown,
  schema: Record<string, unknown>,
  path = ''
): string[] {
  const errors: string[] = [];
  const schemaType = schema.type as string | undefined;

  if (schemaType) {
    const actualType = getJsonType(value);
    if (schemaType !== actualType) {
      errors.push(`${path || 'root'}: expected type "${schemaType}", got "${actualType}"`);
      return errors;
    }
  }

  if (schemaType === 'object' && typeof value === 'object' && value !== null) {
    const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
    const required = (schema.required as string[]) ?? [];

    for (const field of required) {
      if (!(field in (value as Record<string, unknown>))) {
        errors.push(`${path ? path + '.' : ''}${field}: required field missing`);
      }
    }

    if (properties) {
      for (const [key, propSchema] of Object.entries(properties)) {
        if (key in (value as Record<string, unknown>)) {
          errors.push(
            ...validateSchema(
              (value as Record<string, unknown>)[key],
              propSchema,
              path ? `${path}.${key}` : key
            )
          );
        }
      }
    }
  }

  if (schemaType === 'array' && Array.isArray(value)) {
    const itemsSchema = schema.items as Record<string, unknown> | undefined;
    if (itemsSchema && value.length > 0) {
      errors.push(...validateSchema(value[0], itemsSchema, `${path}[0]`));
    }
  }

  return errors;
}

function getJsonType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'number';
  }
  return typeof value;
}

// TypeScript declaration merging
declare module '@playwright/test' {
  interface Matchers<R> {
    toBeSuccessful(): Promise<R>;
    toHaveStatus(status: number): Promise<R>;
    toMatchSchema(schema: Record<string, unknown>): R;
    toHaveJsonBody(): R;
  }
}
