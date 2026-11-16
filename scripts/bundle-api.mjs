#!/usr/bin/env node
// Bundles api/_lib/engine.ts and its npm dependencies into api/_lib/engine.bundle.cjs (one CommonJS file).
// Needed on Vercel: the @ethereumjs CommonJS builds require() @noble/* v2, which are ES modules only, and
// Vercel's Node runtime rejects require() of an ES module. esbuild converts them to CommonJS here.
// Runs as part of the Vercel install step (vercel.json installCommand); the output is not committed.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outfile = path.join(root, 'api', '_lib', 'engine.bundle.cjs');

const result = await build({
  entryPoints: [path.join(root, 'api', '_lib', 'engine.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  logLevel: 'warning',
  metafile: true,
});
const bytes = Object.values(result.metafile.outputs).reduce((n, o) => n + o.bytes, 0);
console.log(`api/_lib/engine.bundle.cjs (${(bytes / 1024).toFixed(0)} KiB)`);
