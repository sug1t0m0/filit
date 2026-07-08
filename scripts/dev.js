#!/usr/bin/env node
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);

let viteProcess = null;
let shuttingDown = false;

// Run the CLI from TypeScript sources via tsx; start Vite once the API server is up
const cliProcess = spawn('pnpm', ['exec', 'tsx', 'src/cli/index.ts', ...args, '--no-open'], {
  stdio: ['inherit', 'pipe', 'inherit'],
  env: { ...process.env, NODE_ENV: 'development' },
});

cliProcess.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output);

  const match = output.match(/filit server: (http:\/\/[\w.:-]+)/);
  if (match && !viteProcess) {
    console.log('🚀 Starting Vite dev server...');
    viteProcess = spawn('pnpm', ['exec', 'vite', '--open', '--clearScreen=false'], {
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
