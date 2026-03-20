import type { APIRequestContext, APIResponse } from '@playwright/test';

export interface APIClientOptions {
  params?: Record<string, string | number | boolean>;
  data?: unknown;
  headers?: Record<string, string>;
}

/**
 * A wrapper around Playwright's APIRequestContext that provides
 * a cleaner API for common HTTP methods.
 */
export class APIClient {
  constructor(private ctx: APIRequestContext) {}

  async get(path: string, options?: APIClientOptions): Promise<APIResponse> {
    return this.ctx.get(path, {
      params: options?.params,
      headers: options?.headers,
    });
  }

  async post(path: string, options?: APIClientOptions): Promise<APIResponse> {
    return this.ctx.post(path, {
      data: options?.data,
      params: options?.params,
      headers: options?.headers,
    });
  }

  async put(path: string, options?: APIClientOptions): Promise<APIResponse> {
    return this.ctx.put(path, {
      data: options?.data,
      params: options?.params,
      headers: options?.headers,
    });
  }

  async patch(path: string, options?: APIClientOptions): Promise<APIResponse> {
    return this.ctx.patch(path, {
      data: options?.data,
      params: options?.params,
      headers: options?.headers,
    });
  }

  async delete(path: string, options?: APIClientOptions): Promise<APIResponse> {
    return this.ctx.delete(path, {
      params: options?.params,
      headers: options?.headers,
    });
  }

  async head(path: string, options?: APIClientOptions): Promise<APIResponse> {
    return this.ctx.head(path, {
      params: options?.params,
      headers: options?.headers,
    });
  }
}
