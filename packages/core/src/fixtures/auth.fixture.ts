import { request as playwrightRequest } from '@playwright/test';
import type { AuthConfig, BearerTokenAuth } from '../config/types.js';

/**
 * Resolve auth config into headers that can be injected into requests.
 * Token is cached per worker to avoid repeated login calls.
 */
let cachedToken: string | null = null;

export async function resolveAuthHeaders(
  baseURL: string,
  auth?: AuthConfig,
  globalHeaders?: Record<string, string>
): Promise<Record<string, string>> {
  if (!auth) return {};

  if (auth.type === 'header') {
    return { ...auth.headers };
  }

  if (auth.type === 'bearer') {
    const token = await getOrFetchToken(baseURL, auth, globalHeaders);
    return { Authorization: `Bearer ${token}` };
  }

  return {};
}

async function getOrFetchToken(
  baseURL: string,
  auth: BearerTokenAuth,
  globalHeaders?: Record<string, string>
): Promise<string> {
  if (cachedToken) return cachedToken;

  const ctx = await playwrightRequest.newContext({
    baseURL,
    extraHTTPHeaders: globalHeaders,
  });

  try {
    const loginURL = auth.login.url;
    let response;

    if (auth.login.method === 'POST') {
      response = await ctx.post(loginURL, {
        data: auth.login.body,
      });
    } else {
      response = await ctx.get(loginURL);
    }

    if (!response.ok()) {
      const text = await response.text();
      throw new Error(
        `Login failed: ${response.status()} ${response.statusText()}\n${text}`
      );
    }

    const json = await response.json();
    const token = extractByPath(json, auth.login.tokenPath);

    if (!token || typeof token !== 'string') {
      throw new Error(
        `Failed to extract token from path "${auth.login.tokenPath}". Response: ${JSON.stringify(json).slice(0, 200)}`
      );
    }

    cachedToken = token;
    return token;
  } finally {
    await ctx.dispose();
  }
}

/**
 * Extract a value from a nested object using dot-path notation.
 * e.g. "data.access_token" from { data: { access_token: "xxx" } }
 */
function extractByPath(obj: unknown, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * Clear cached token (useful for test isolation).
 */
export function clearTokenCache(): void {
  cachedToken = null;
}
