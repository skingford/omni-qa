import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Fetch an OpenAPI document from a local file path or remote URL.
 * Returns the raw content as a string.
 */
export async function fetchOpenAPIDocument(source: string): Promise<string> {
  if (isURL(source)) {
    return fetchRemote(source);
  }
  return fetchLocal(source);
}

function isURL(source: string): boolean {
  return source.startsWith('http://') || source.startsWith('https://');
}

async function fetchRemote(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch OpenAPI document from ${url}: ${response.status} ${response.statusText}`
    );
  }
  return response.text();
}

async function fetchLocal(filePath: string): Promise<string> {
  const absPath = resolve(process.cwd(), filePath);
  if (!existsSync(absPath)) {
    throw new Error(`OpenAPI document not found: ${absPath}`);
  }
  return readFile(absPath, 'utf-8');
}
