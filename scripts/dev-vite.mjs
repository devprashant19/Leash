#!/usr/bin/env node
// Hot-reloading dev loop: the API (scripts/dev-web.ts) on a free port (3001 if available) and Vite on :5173,
// which proxies /api to it. Vite only starts once the API answers /api/health, so the page never sees a dead proxy.
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const free = (port) => new Promise((resolve) => {
  const srv = net.createServer().once('error', () => resolve(false)).once('listening', () => srv.close(() => resolve(true))).listen(port);
});
let port = 3001;
while (!(await free(port))) port++;

const api = spawn(process.execPath, [path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'), path.join(root, 'scripts', 'dev-web.ts')], {
  env: { ...process.env, PORT: String(port) },
  stdio: 'inherit',
});
let apiExited = false;
api.on('exit', (code) => {
  apiExited = true;
  console.error(`\nThe local API server stopped (exit ${code}). /api calls will fail until you restart npm run dev:web.`);
});

const deadline = Date.now() + 30_000;
for (;;) {
  if (apiExited) process.exit(1);
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/health`);
    if (r.ok) break;
  } catch {
    /* not up yet */
  }
  if (Date.now() > deadline) { console.error(`The API did not answer on :${port} within 30 s.`); api.kill(); process.exit(1); }
  await new Promise((r) => setTimeout(r, 250));
}

process.env.LEASH_API_PORT = String(port);
const server = await createServer({ configFile: path.join(root, 'web', 'vite.config.ts') });
await server.listen();
server.printUrls();
console.log(`  API proxied to http://127.0.0.1:${port}`);
const stop = () => { api.kill(); server.close().then(() => process.exit(0)); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
