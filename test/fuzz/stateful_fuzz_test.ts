import assert from 'node:assert/strict';
import { predictVerdict, MAX_PER_TX_WEI, MAX_PER_WINDOW_WEI, GOLDEN_FINGERPRINT } from '../../demo/lib/leash-cli';

console.log('--- Stateful Fuzzing & Invariant Stress Test ---');

// SplitMix64 pseudo-random generator for determinism
let seed = 0xdeadbeefn;
function nextRand(): bigint {
  seed = (seed + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
  let z = seed;
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
  return (z ^ (z >> 31n)) & 0xffffffffffffffffn;
}

const ITERATIONS = 10_000;
console.log(`Running ${ITERATIONS.toLocaleString()} fuzz iterations...`);

let allowedCount = 0;
let deniedCount = 0;
let baseTimestamp = 1763000000;

for (let i = 0; i < ITERATIONS; i++) {
  const r = nextRand();
  const isTreasury = (r & 1n) === 0n;
  const isDelegate = (r & 2n) === 2n;

  // Generate random value (sometimes under cap, sometimes over)
  const valWei = (r % 250_000_000_000_000_000n); // 0 to 0.25 ETH

  const target = isTreasury
    ? '0x2000000000000000000000000000000000000002' as `0x${string}`
    : `0x${(r & 0xffffffffffffffffffffn).toString(16).padStart(40, '0')}` as `0x${string}`;

  const op = isDelegate ? 'delegatecall' : 'call';
  const now = baseTimestamp + Number(r % 86400n);

  let res;
  try {
    res = predictVerdict({
      to: target,
      valueWei: valWei,
      op,
      now,
    });
  } catch (e) {
    assert.fail(`Fuzzer caused unexpected throw on iteration ${i}: ${e}`);
  }

  // INVARIANT 1: Result must have valid verdict
  assert.ok(res.verdict === 'ALLOW' || res.verdict === 'DENY');

  // INVARIANT 2: If delegatecall, it MUST be denied with DelegateCallBlocked (code 3)
  if (op === 'delegatecall') {
    assert.equal(res.verdict, 'DENY');
    assert.equal(res.code, 3);
  }

  // INVARIANT 3: If unlisted target, it MUST be denied
  if (!isTreasury && op !== 'delegatecall') {
    assert.equal(res.verdict, 'DENY');
    assert.equal(res.code, 4);
  }

  // INVARIANT 4: If value > per-tx cap, it MUST be denied with PerTxCapExceeded
  if (isTreasury && op === 'call' && valWei > MAX_PER_TX_WEI) {
    assert.equal(res.verdict, 'DENY');
    assert.equal(res.code, 7);
  }

  // INVARIANT 5: Fingerprint must NEVER drift
  assert.equal(res.fingerprint, GOLDEN_FINGERPRINT);

  if (res.verdict === 'ALLOW') allowedCount++;
  else deniedCount++;
}

console.log(`  PASS Completed ${ITERATIONS.toLocaleString()} iterations with 0 crashes or invariant breaches.`);
console.log(`  PASS Invariant coverage: ${allowedCount.toLocaleString()} ALLOW verdicts, ${deniedCount.toLocaleString()} DENY verdicts.`);
