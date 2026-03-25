import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadEditorState,
  saveEditorState,
  type ConfigEditorState,
} from './state.js';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const CONFIG_STUDIO_DIST_DIR = resolve(MODULE_DIR, '../../../../dist/config-studio');
const CONFIG_STUDIO_INDEX_PATH = resolve(CONFIG_STUDIO_DIST_DIR, 'index.html');

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

export interface ConfigStudioOptions {
  host?: string;
  port?: number;
  open?: boolean;
}

export function getConfigStudioAssetPaths() {
  return {
    distDir: CONFIG_STUDIO_DIST_DIR,
    indexPath: CONFIG_STUDIO_INDEX_PATH,
  };
}

export function hasConfigStudioAssets(): boolean {
  return existsSync(CONFIG_STUDIO_INDEX_PATH);
}

export async function startConfigStudio(options: ConfigStudioOptions = {}): Promise<void> {
  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? 3210;

  if (!hasConfigStudioAssets()) {
    throw new Error(
      `Config studio assets are missing at ${CONFIG_STUDIO_INDEX_PATH}. Run "bun run build:config-studio" first.`
    );
  }

  const server = createServer(async (req, res) => {
    try {
      await handleRequest(req, res);
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve());
  });

  const address = server.address() as AddressInfo;
  const url = `http://${host}:${address.port}`;

  console.log(`\n✨ Config studio is ready at ${url}`);
  console.log('   Keep this terminal open while you edit settings.');
  console.log('   Press Ctrl+C to stop the server.\n');

  if (options.open !== false) {
    openBrowser(url);
  }

  const closeServer = async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  };

  const stop = async () => {
    process.off('SIGINT', handleSignal);
    process.off('SIGTERM', handleSignal);
    await closeServer();
    process.exit(0);
  };

  const handleSignal = () => {
    void stop();
  };

  process.on('SIGINT', handleSignal);
  process.on('SIGTERM', handleSignal);
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');

  if (req.method === 'GET' && url.pathname === '/api/state') {
    const state = await loadEditorState();
    sendJson(res, 200, state);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/save') {
    const payload = await readJsonBody(req);
    const nextState = await saveEditorState(payload as ConfigEditorState);
    sendJson(res, 200, nextState);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/favicon.ico') {
    if (await tryServeStaticAsset(url.pathname, res)) {
      return;
    }

    res.writeHead(204, { 'Cache-Control': 'no-store' });
    res.end();
    return;
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    if (await tryServeStaticAsset(url.pathname, res, req.method === 'HEAD')) {
      return;
    }

    if (!url.pathname.startsWith('/api/')) {
      await serveFile(CONFIG_STUDIO_INDEX_PATH, res, {
        headOnly: req.method === 'HEAD',
        cacheControl: 'no-store',
      });
      return;
    }

    return;
  }

  sendJson(res, 404, { error: 'Not found' });
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const body = Buffer.concat(chunks).toString('utf8').trim();
  if (!body) {
    return {};
  }

  return JSON.parse(body);
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

async function tryServeStaticAsset(
  pathname: string,
  res: ServerResponse,
  headOnly = false
): Promise<boolean> {
  const relativePath = decodeURIComponent(pathname).replace(/^\/+/, '');
  if (!relativePath || relativePath.endsWith('/')) {
    return false;
  }

  const absolutePath = resolve(CONFIG_STUDIO_DIST_DIR, relativePath);
  if (!isPathInsideDirectory(CONFIG_STUDIO_DIST_DIR, absolutePath)) {
    return false;
  }

  try {
    const fileStat = await stat(absolutePath);
    if (!fileStat.isFile()) {
      return false;
    }

    const cacheControl = pathname.startsWith('/assets/')
      ? 'public, max-age=31536000, immutable'
      : 'no-store';

    await serveFile(absolutePath, res, { headOnly, cacheControl });
    return true;
  } catch {
    return false;
  }
}

async function serveFile(
  filePath: string,
  res: ServerResponse,
  options: { cacheControl?: string; headOnly?: boolean } = {}
): Promise<void> {
  const body = options.headOnly ? undefined : await readFile(filePath);

  res.writeHead(200, {
    'Content-Type': getContentType(filePath),
    'Cache-Control': options.cacheControl ?? 'no-store',
  });

  res.end(body);
}

function getContentType(filePath: string): string {
  return CONTENT_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

function isPathInsideDirectory(baseDir: string, targetPath: string): boolean {
  const normalizedBaseDir = baseDir.endsWith(sep) ? baseDir : `${baseDir}${sep}`;
  return targetPath === baseDir || targetPath.startsWith(normalizedBaseDir);
}

function openBrowser(url: string): void {
  const command = getOpenCommand(url);
  if (!command) {
    return;
  }

  const child = spawn(command.bin, command.args, {
    stdio: 'ignore',
    detached: true,
  });
  child.unref();
}

function getOpenCommand(url: string): { bin: string; args: string[] } | null {
  if (process.platform === 'darwin') {
    return { bin: 'open', args: [url] };
  }

  if (process.platform === 'win32') {
    return { bin: 'cmd', args: ['/c', 'start', '', url] };
  }

  return { bin: 'xdg-open', args: [url] };
}
