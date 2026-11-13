#!/usr/bin/env node
// Copies the Fe build outputs the Vercel functions need into api/_assets/artifacts.
//
//   node scripts/sync-web-assets.mjs           copy (run `fe build` first)
//   node scripts/sync-web-assets.mjs --check   fail if api/_assets/artifacts differs from a fresh `fe build`
//
// The native CLI (api/_assets/leash-linux-x86_64) comes from the cli-v* GitHub release built by
// .github/workflows/release.yml; refresh it with:
//   gh release download <tag> -p leash-linux-x86_64 -D api/_assets --clobber
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dest = path.join(root, 'api', '_assets', 'artifacts');
const wanted = [
  ['module', 'LeashModule'],
  ['testkit', 'MockSafe'],
  ['testkit', 'MockErc20'],
];
const check = process.argv.includes('--check');

function source(ingot, name, ext) {
  for (const dir of [path.join(root, 'ingots', ingot, 'out'), path.join(root, 'out')]) {
    const f = path.join(dir, `${name}${ext}`);
    if (fs.existsSync(f)) return f;
  }
  throw new Error(`${name}${ext} not found: run \`fe build\` first`);
}

const norm = (s) => s.replace(/\r\n/g, '\n').trim();
let stale = 0;
fs.mkdirSync(dest, { recursive: true });
for (const [ingot, name] of wanted) {
  for (const ext of ['.bin', '.abi.json']) {
    const src = source(ingot, name, ext);
    const dst = path.join(dest, `${name}${ext}`);
    const fresh = norm(fs.readFileSync(src, 'utf8'));
    if (check) {
      const have = fs.existsSync(dst) ? norm(fs.readFileSync(dst, 'utf8')) : '';
      if (have !== fresh) {
        console.error(`STALE: api/_assets/artifacts/${name}${ext} differs from the fresh build (${path.relative(root, src)})`);
        stale++;
      }
    } else {
      fs.writeFileSync(dst, fresh + '\n');
      console.log(`copied ${path.relative(root, src)} -> api/_assets/artifacts/${name}${ext}`);
    }
  }
}
if (check) {
  if (stale) {
    console.error(`${stale} web artifact(s) are stale: run \`fe build && npm run sync:web\` and commit.`);
    process.exit(1);
  }
  console.log('web artifacts match the fresh Fe build');
}
