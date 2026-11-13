#!/usr/bin/env node
// Assembles the static part of the Vercel site in web/dist:
//   /             web/index.html (the interactive page)
//   /dashboard/   demo/dashboard/index.html (recorded run viewer), reading /run.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'web', 'dist');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'dashboard'), { recursive: true });

const copy = (from, to) => {
  fs.copyFileSync(path.join(root, from), path.join(out, to));
  console.log(`${from} -> web/dist/${to}`);
};
copy('web/index.html', 'index.html');
copy('demo/dashboard/index.html', 'dashboard/index.html');
copy('demo/run.json', 'run.json');
