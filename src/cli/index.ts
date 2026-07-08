#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, sep } from 'node:path';

import { Command } from 'commander';
import open from 'open';

import { startServer } from '../server/server.js';

const pkg = createRequire(import.meta.url)('../../package.json') as { version: string };

interface CliOptions {
  port: string;
  host: string;
  open: boolean;
  clearComments: boolean;
}

const program = new Command();

program
  .name('filit')
  .description(
    'Bundle selected files into a single browser page so tab-aware LLMs can ingest them at once',
  )
  .version(pkg.version)
  .argument('[paths...]', 'files, directories, or globs to scope (default: current directory)')
  .option('--port <port>', 'preferred port (default: 4967)', '4967')
  .option('--host <host>', 'host to bind', '127.0.0.1')
  .option('--no-open', 'do not open browser automatically')
  .option('--clear-comments', 'clear saved comments on startup', false)
  .action(async (paths: string[], options: CliOptions) => {
    try {
      const rootDir = process.cwd();
      const scopeInputs = paths.length > 0 ? paths : ['.'];
      // Globs are expanded by the scanner later; only verify non-glob paths exist here
      for (const input of scopeInputs) {
        const resolved = resolve(rootDir, input);
        if (!input.includes('*') && !existsSync(resolved)) {
          console.error(`Error: path not found: ${input}`);
          process.exit(1);
        }
        if (resolved !== rootDir && !resolved.startsWith(rootDir + sep)) {
          console.error(`Error: path is outside the current directory: ${input}`);
          process.exit(1);
        }
      }

      const preferredPort = Number.parseInt(options.port, 10);
      if (Number.isNaN(preferredPort) || preferredPort < 1 || preferredPort > 65535) {
        console.error(`Error: invalid port: ${options.port}`);
        process.exit(1);
      }

      const { url } = await startServer({
        rootDir,
        scopeInputs,
        preferredPort,
        host: options.host,
        version: pkg.version,
        clearComments: options.clearComments,
      });

      console.log(`filit server: ${url}`);

      if (options.open && process.env.NODE_ENV !== 'development') {
        await open(url);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
