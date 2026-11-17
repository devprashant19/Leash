/**
 * End-to-end test of the Vercel functions' logic (no server needed):
 *   npm run test:web                              any host (Windows uses the labelled TS mirror)
 *   LEASH_REQUIRE_NATIVE=1 npm run test:web       Linux x86-64: predictions must come from the Fe binary
 */
import assert from 'node:assert/strict';
import { parseCheckInput, runCheck, runDemo } from '../../api/_lib/leash';
import { predictVerdict } from '../../demo/lib/leash-cli';
import { runTour } from '../../api/_lib/tour';
import { parsePlan, runPlan } from '../../api/_lib/plan';

const TREASURY = '0x2000000000000000000000000000000000000002';
const TOKEN = '0x1000000000000000000000000000000000000001';
const pad = (hex: string) => hex.replace(/^0x/, '').padStart(64, '0');

let passed = 0;
async function step(name: string, fn: () => Promise<void> | void) {
  await fn();
  passed++;
  console.log(`  PASS ${name}`);
}

async function main() {
  console.log('--- Leash web functions test ---');
  const demo = await runDemo();
  console.log(`  prediction source: ${demo.predictionSource} (${demo.cliVersion}); ${demo.elapsedMs} ms`);

  if (process.env.LEASH_REQUIRE_NATIVE === '1') {
    await step('predictions come from the Fe-built leash binary', () => assert.equal(demo.predictionSource, 'fe-native'));
  }
  await step('demo: 5 steps, all matched', () => {
    assert.equal(demo.steps.length, 5);
    assert.equal(demo.matchedCount, 5);
    assert.ok(demo.allMatched);
  });
  await step('demo: expected verdicts ALLOW, ALLOW, DENY 7, DENY 4, DENY 10', () => {
    assert.deepEqual(
      demo.steps.map((s) => [s.onchain.verdict, s.onchain.code]),
      [['ALLOW', 0], ['ALLOW', 0], ['DENY', 7], ['DENY', 4], ['DENY', 10]]
    );
    for (const s of demo.steps) assert.ok(s.onchain.eventEmitted, `step ${s.i} emitted its event`);
  });
  await step('demo: CLI and on-chain fingerprints are identical', () => {
    assert.ok(demo.fingerprintsMatch);
    assert.equal(demo.fingerprintChain, '0x3efcfc58aec5d1e7e81b5bded7820ed3ed8a0e654cf4aff3bfb793a7494ae6ee');
  });
  await step('demo: allowed calls really moved funds (0.05 ETH and 50 tokens to the treasury)', () => {
    assert.equal(demo.balancesBefore.treasuryEth, '0');
    assert.equal(demo.balancesAfter.treasuryEth, '0.05');
    assert.equal(demo.balancesAfter.safeEth, '9.95');
    assert.equal(demo.balancesAfter.treasuryTokens, '50');
    assert.equal(demo.balancesAfter.safeTokens, '950');
  });

  const allowed = await runCheck(parseCheckInput({ to: TREASURY, valueEth: '0.1', data: '0x', operation: 'call' }));
  await step('check: 0.1 ETH to the treasury is allowed on both sides', () => {
    assert.equal(allowed.step.predicted.verdict, 'ALLOW');
    assert.equal(allowed.step.onchain.verdict, 'ALLOW');
    assert.ok(allowed.step.matched);
  });
  const over = await runCheck(parseCheckInput({ to: TREASURY, valueEth: '0.100000000000000001', data: '0x' }));
  await step('check: cap + 1 wei is denied with PerTxCapExceeded on both sides', () => {
    assert.equal(over.step.onchain.reason, 'PerTxCapExceeded');
    assert.ok(over.step.matched);
  });
  const dc = await runCheck(parseCheckInput({ to: TREASURY, valueEth: '0', data: '0x', operation: 'delegatecall' }));
  await step('check: delegatecall is denied with DelegateCallBlocked', () => {
    assert.equal(dc.step.onchain.reason, 'DelegateCallBlocked');
    assert.ok(dc.step.matched);
  });
  const transfer = await runCheck(
    parseCheckInput({ to: TOKEN, valueEth: '0', data: '0xa9059cbb' + pad(TREASURY) + pad((101n * 10n ** 18n).toString(16)) })
  );
  await step('check: a 101-token transfer is denied with TokenCapExceeded', () => {
    assert.equal(transfer.step.onchain.reason, 'TokenCapExceeded');
    assert.ok(transfer.step.matched);
  });

  const fpMismatch = predictVerdict({
    to: TREASURY as `0x${string}`,
    valueWei: 10000000000000000n,
    now: 1000000,
    expectedFingerprint: '0x1111222233334444555566667777888899990000111122223333444455556666',
  });
  await step('check: mismatched expected fingerprint returns FingerprintMismatch (code 22)', () => {
    assert.equal(fpMismatch.verdict, 'DENY');
    assert.equal(fpMismatch.code, 22);
    assert.equal(fpMismatch.reason, 'FingerprintMismatch');
  });

  const tour = await runTour();
  const tourTx = tour.chapters.flatMap((c) => c.items).filter((x) => x.kind === 'tx');
  await step('tour: 18 agent transactions, every prediction matched the on-chain decision', () => {
    assert.equal(tour.txCount, 18);
    assert.equal(tour.matchedCount, 18, tourTx.filter((t) => !t.matched).map((t) => `#${t.i} ${t.description}: predicted ${t.predicted.code}, chain ${t.onchain.code}`).join('; '));
  });
  await step('tour: every step got the verdict the policy demands (codes 0-10 and 15)', () => {
    assert.equal(tour.expectedCount, 18);
    assert.deepEqual(tour.codesCovered, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15]);
    assert.ok(tour.fingerprintsMatch);
  });
  await step('tour: only allowed calls moved money (0.05 + 4 x 0.1 ETH, 50 tokens)', () => {
    assert.equal(tour.balancesAfter.treasuryEth, '0.45');
    assert.equal(tour.balancesAfter.treasuryTokens, '50');
  });

  const drain = await runPlan(parsePlan({ steps: Array.from({ length: 6 }, () => ({ to: TREASURY, valueEth: '0.09' })) }));
  await step('plan: six 0.09 ETH payments, the sixth is refused by the 24 h window, every prediction matched', () => {
    assert.deepEqual(drain.steps.map((s) => s.onchain.code), [0, 0, 0, 0, 0, 8]);
    assert.equal(drain.firstDenied, 6);
    assert.ok(drain.allMatched);
  });
  const trip = await runPlan(parsePlan({ steps: [
    { to: '0xdead000000000000000000000000000000000001', valueEth: '0' },
    { to: TREASURY, valueEth: '0.2' },
    { to: TREASURY, valueEth: '0', operation: 'delegatecall' },
    { to: TREASURY, valueEth: '0.01' },
  ] }));
  await step('plan: three refusals trip the breaker, the fourth (harmless) step gets code 15, every prediction matched', () => {
    assert.deepEqual(trip.steps.map((s) => s.onchain.code), [4, 7, 3, 15]);
    assert.ok(trip.allMatched);
  });
  const hundredTokens = '0xa9059cbb' + TREASURY.slice(2).padStart(64, '0') + (100n * 10n ** 18n).toString(16).padStart(64, '0');
  const drip = await runPlan(parsePlan({ steps: Array.from({ length: 6 }, () => ({ to: TOKEN, data: hundredTokens })) }));
  await step('plan: six 100-token transfers, the sixth is refused by the 24 h token cap (21), every prediction matched', () => {
    assert.deepEqual(drip.steps.map((s) => s.onchain.code), [0, 0, 0, 0, 0, 21]);
    assert.equal(drip.firstDenied, 6);
    assert.ok(drip.allMatched);
  });
  await step('plan: input validation', () => {
    assert.throws(() => parsePlan({ steps: [] }), /steps/);
    assert.throws(() => parsePlan({ steps: Array.from({ length: 13 }, () => ({ to: TREASURY })) }), /at most 12/);
    assert.throws(() => parsePlan({ steps: [{ to: '0x12' }] }), /Step 1/);
  });

  await step('input validation rejects bad addresses, values and calldata', () => {
    assert.throws(() => parseCheckInput({ to: '0x123' }), /20-byte hex address/);
    assert.throws(() => parseCheckInput({ to: TREASURY, valueEth: '-1' }), /ETH amount/);
    assert.throws(() => parseCheckInput({ to: TREASURY, valueEth: '10' }), /at most 9 ETH/);
    assert.throws(() => parseCheckInput({ to: TREASURY, data: '0xabc' }), /even number/);
    assert.throws(() => parseCheckInput({ to: TREASURY, operation: 'staticcall' }), /"operation"/);
  });

  console.log(`All ${passed} web checks passed.`);
}

main().catch((e) => {
  console.error('FAIL', e);
  process.exit(1);
});
