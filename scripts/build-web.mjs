#!/usr/bin/env node
// Builds the static part of the Vercel site into web/dist:
//   /             the React page (web/index.html + web/src, bundled by Vite)
//   /dashboard/   demo/dashboard/index.html (recorded run viewer), reading /run.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'web', 'dist');

await build({ configFile: path.join(root, 'web', 'vite.config.ts'), logLevel: 'warn' });

fs.mkdirSync(path.join(out, 'dashboard'), { recursive: true });
const copy = (from, to) => {
  fs.copyFileSync(path.join(root, from), path.join(out, to));
  console.log(`${from} -> web/dist/${to}`);
};
copy('demo/dashboard/index.html', 'dashboard/index.html');
copy('demo/run.json', 'run.json');

const assets = fs.readdirSync(path.join(out, 'assets'));
const size = assets.reduce((n, f) => n + fs.statSync(path.join(out, 'assets', f)).size, 0);
console.log(`web/dist: index.html + ${assets.length} assets (${(size / 1024).toFixed(0)} KiB)`);
