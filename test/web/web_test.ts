/**
 * End-to-end test of the Vercel functions' logic (no server needed):
 *   npm run test:web                              any host (Windows uses the labelled TS mirror)
 *   LEASH_REQUIRE_NATIVE=1 npm run test:web       Linux x86-64: predictions must come from the Fe binary
 */
import assert from 'node:assert/strict';
import { parseCheckInput, runCheck, runDemo } from '../../api/_lib/leash';

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
