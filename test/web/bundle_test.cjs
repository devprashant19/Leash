// Loads api/_lib/engine.bundle.cjs the way Vercel's runtime does: run with
// `node --no-experimental-require-module`, so require() of an ES module fails (ERR_REQUIRE_ESM).
// Guards against a dependency that only loads when Node allows require(esm).
const assert = require('node:assert/strict');
const path = require('node:path');

const engine = require(path.join(__dirname, '..', '..', 'api', '_lib', 'engine.bundle.cjs'));

(async () => {
  const info = engine.cliInfo();
  assert.match(info.fingerprint, /^0x[0-9a-f]{64}$/);
  const demo = await engine.runDemo();
  assert.equal(demo.allMatched, true);
  assert.equal(demo.fingerprintsMatch, true);
  const plan = await engine.runPlan(engine.parsePlan({ steps: [{ to: '0x2000000000000000000000000000000000000002', valueEth: '0.05' }] }));
  assert.equal(plan.allowedCount, 1);
  console.log(`bundle ok: ${info.source}, demo ${demo.matchedCount}/${demo.steps.length} matched, plan allowed ${plan.allowedCount}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
