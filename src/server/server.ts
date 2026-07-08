import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { type Server } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import express, { type Express } from 'express';

import { CommentStore, findStoreRoot } from './comment-store.js';
import { composeMarkdown } from './composer.js';
import { scanFiles } from './file-scanner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface ServerOptions {
  /** Directory the CLI was launched from; all paths are relative to this */
  rootDir: string;
  /** Raw scope inputs from the CLI (files, dirs, globs) */
  scopeInputs: string[];
  preferredPort: number;
  host: string;
  version: string;
  clearComments?: boolean;
}

export interface StartedServer {
  url: string;
  port: number;
  server: Server;
}

const MAX_PORT_ATTEMPTS = 100;

const isLine = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1;

function listenOnAvailablePort(
  app: Express,
  preferredPort: number,
  host: string,
): Promise<{ server: Server; port: number }> {
  return new Promise((resolvePromise, rejectPromise) => {
    const tryListen = (port: number, attemptsLeft: number) => {
      const server = app.listen(port, host);
      server.once('listening', () => resolvePromise({ server, port }));
      server.once('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE' && attemptsLeft > 0) {
          tryListen(port + 1, attemptsLeft - 1);
        } else {
          rejectPromise(error);
        }
      });
    };
    tryListen(preferredPort, MAX_PORT_ATTEMPTS);
  });
}

export async function startServer(options: ServerOptions): Promise<StartedServer> {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: options.version });
  });

  // Paths served by /api/file are restricted to what the latest scan produced,
  // so path traversal cannot reach outside the scope
  let knownFiles = new Set<string>();

  const rescan = async () => {
    const result = await scanFiles(options.rootDir, options.scopeInputs);
    knownFiles = new Set(result.files.map((file) => file.path));
    return result;
  };

  app.get('/api/tree', async (_req, res) => {
    try {
      const result = await rescan();
      res.json({
        tree: result.tree,
        fileCount: result.files.length,
        scope: options.scopeInputs,
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'scan failed' });
    }
  });

  const commentStore = new CommentStore(findStoreRoot(options.rootDir));
  if (options.clearComments) {
    await commentStore.clear();
  }

  app.get('/api/comments', async (_req, res) => {
    try {
      const data = await commentStore.load();
      res.json({ comments: data.comments });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'load failed' });
    }
  });

  app.post('/api/comments', async (req, res) => {
    const { file, startLine, endLine, body } = req.body as Record<string, unknown>;
    if (
      typeof file !== 'string' ||
      !isLine(startLine) ||
      !isLine(endLine) ||
      endLine < startLine ||
      typeof body !== 'string' ||
      body.trim() === ''
    ) {
      res.status(400).json({ error: 'invalid comment payload' });
      return;
    }
    try {
      if (!knownFiles.has(file)) {
        await rescan();
      }
      if (!knownFiles.has(file)) {
        res.status(400).json({ error: `file not in scope: ${file}` });
        return;
      }
      const comment = await commentStore.add({ file, startLine, endLine, body: body.trim() });
      res.status(201).json(comment);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'save failed' });
    }
  });

  app.delete('/api/comments/:id', async (req, res) => {
    try {
      const deleted = await commentStore.delete(req.params.id);
      if (deleted) {
        res.status(204).end();
      } else {
        res.status(404).json({ error: 'comment not found' });
      }
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'delete failed' });
    }
  });

  app.get(/^\/api\/file\/(.+)$/, async (req, res) => {
    const relPath = (req.params as Record<string, string>)['0'] ?? '';
    try {
      if (!knownFiles.has(relPath)) {
        await rescan();
      }
      if (!knownFiles.has(relPath)) {
        res.status(404).json({ error: `file not in scope: ${relPath}` });
        return;
      }
      const absolutePath = join(options.rootDir, relPath);
      const content = await readFile(absolutePath, 'utf8');
      res.json({ path: relPath, content, bytes: Buffer.byteLength(content, 'utf8') });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'read failed' });
    }
  });

  // Auto-shutdown: once a client has connected, exit after all clients stay disconnected
  let heartbeatClients = 0;
  let shutdownTimer: NodeJS.Timeout | null = null;
  const SHUTDOWN_GRACE_MS = 10_000;
  const HEARTBEAT_PING_MS = 30_000;

  app.get('/api/heartbeat', (req, res) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.flushHeaders();
    res.write('data: connected\n\n');

    heartbeatClients += 1;
    if (shutdownTimer) {
      clearTimeout(shutdownTimer);
      shutdownTimer = null;
    }
    const ping = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_PING_MS);

    req.on('close', () => {
      clearInterval(ping);
      heartbeatClients -= 1;
      if (heartbeatClients <= 0) {
        shutdownTimer = setTimeout(() => {
          console.log('All clients disconnected; shutting down.');
          process.exit(0);
        }, SHUTDOWN_GRACE_MS);
      }
    });
  });

  // Bundles live in memory only; they are one-shot pages handed to a browser tab
  const bundles = new Map<string, string>();
  const MAX_BUNDLES = 20;

  app.post('/api/bundles', async (req, res) => {
    const { files } = req.body as { files?: unknown };
    if (
      !Array.isArray(files) ||
      files.length === 0 ||
      !files.every((file): file is string => typeof file === 'string')
    ) {
      res.status(400).json({ error: 'files must be a non-empty array of paths' });
      return;
    }
    try {
      if (files.some((file) => !knownFiles.has(file))) {
        await rescan();
      }
      const missing = files.filter((file) => !knownFiles.has(file));
      if (missing.length > 0) {
        res.status(400).json({ error: `files not in scope: ${missing.join(', ')}` });
        return;
      }
      const contents = await Promise.all(
        files.map(async (path) => ({
          path,
          content: await readFile(join(options.rootDir, path), 'utf8'),
        })),
      );
      const { comments } = await commentStore.load();
      const { markdown, bytes } = composeMarkdown(contents, comments);

      const id = randomUUID().slice(0, 8);
      bundles.set(id, markdown);
      if (bundles.size > MAX_BUNDLES) {
        const oldest = bundles.keys().next().value;
        if (oldest !== undefined) {
          bundles.delete(oldest);
        }
      }
      res.status(201).json({ id, bytes });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'compose failed' });
    }
  });

  app.get('/bundle/:id', (req, res) => {
    const markdown = bundles.get(req.params.id);
    if (markdown === undefined) {
      res
        .status(404)
        .type('text/plain')
        .send('bundle not found (bundles do not survive a server restart)');
      return;
    }
    const escaped = markdown
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
    res
      .type('html')
      .send(
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>filit bundle ${req.params.id}</title></head><body><pre>${escaped}</pre></body></html>`,
      );
  });

  // In production the built client is served from dist/client (this file lives in dist/server)
  const clientDir = join(__dirname, '../client');
  if (process.env.NODE_ENV !== 'development' && existsSync(clientDir)) {
    app.use(express.static(clientDir));
    app.get('/{*splat}', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/bundle/')) {
        next();
        return;
      }
      res.sendFile(join(clientDir, 'index.html'));
    });
  }

  const { server, port } = await listenOnAvailablePort(app, options.preferredPort, options.host);
  const displayHost = options.host === '0.0.0.0' ? 'localhost' : options.host;
  return { url: `http://${displayHost}:${port}`, port, server };
}
