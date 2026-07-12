#!/usr/bin/env node
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);

// --host is forwarded to Vite too, so the UI itself is reachable over the network
// (the CLI receives it via `args` as-is)
const hostIndex = args.indexOf('--host');
const host = hostIndex !== -1 ? args[hostIndex + 1] : null;

let viteProcess = null;
let shuttingDown = false;

// Run the CLI from TypeScript sources via tsx; start Vite once the API server is up.
// Spawn the .bin shims directly (they exec into node) so killing the child kills the
// actual server — a `pnpm exec` wrapper would orphan the grandchild on shutdown.
const cliProcess = spawn('./node_modules/.bin/tsx', ['src/cli/index.ts', ...args, '--no-open'], {
  stdio: ['inherit', 'pipe', 'inherit'],
  env: { ...process.env, NODE_ENV: 'development' },
});

cliProcess.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output);

  const match = output.match(/filit server: (http:\/\/[\w.:-]+)/);
  if (match && !viteProcess) {
    console.log('🚀 Starting Vite dev server...');
    const viteArgs = ['--open', '--clearScreen=false'];
    if (host) {
      viteArgs.push('--host', host);
    }
    viteProcess = spawn('./node_modules/.bin/vite', viteArgs, {
      stdio: 'inherit',
      env: { ...process.env, VITE_FILIT_API_URL: match[1] },
    });
    viteProcess.on('close', () => shutdown());
  }
});

cliProcess.on('close', (code) => {
  if (code !== 0 && code !== null && !shuttingDown) {
    console.error(`CLI server exited with code ${code}`);
  }
  shutdown();
});

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  if (viteProcess && !viteProcess.killed) viteProcess.kill('SIGINT');
  if (cliProcess && !cliProcess.killed) cliProcess.kill('SIGINT');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
