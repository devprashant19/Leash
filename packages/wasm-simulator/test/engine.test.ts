import assert from 'node:assert/strict';
import { LeashWasmSimulator } from '../src/policy-engine.js';

console.log('--- Testing @leash/wasm-simulator ---');

const res1 = LeashWasmSimulator.evaluate({
  to: '0x2000000000000000000000000000000000000002',
  valueWei: '50000000000000000',
  data: '0x',
});
assert.equal(res1.verdict, 'ALLOW');
assert.equal(res1.allowed, true);
console.log('  PASS evaluate() allows 0.05 ETH');

const res2 = LeashWasmSimulator.evaluate({
  to: '0x2000000000000000000000000000000000000002',
  valueWei: '200000000000000000',
  data: '0x',
});
assert.equal(res2.verdict, 'DENY');
assert.equal(res2.code, 7);
console.log('  PASS evaluate() denies 0.2 ETH');

console.log('All @leash/wasm-simulator tests passed!');
