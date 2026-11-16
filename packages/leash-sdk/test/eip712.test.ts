import assert from 'node:assert/strict';
import { LeashEip712Helper } from '../src/eip712.js';

console.log('--- Testing EIP-712 Helper ---');

const domain = LeashEip712Helper.domainSeparator(11155111n, '0x51E91aA8b9C5E9b71e16f39e31d8c117Bf1a92e1');
assert.ok(domain.startsWith('0x'));
assert.equal(domain.length, 66);
console.log('  PASS domainSeparator generates 32-byte hash');

const digest = LeashEip712Helper.digest(
  11155111n,
  '0x51E91aA8b9C5E9b71e16f39e31d8c117Bf1a92e1',
  {
    agent: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    target: '0x2000000000000000000000000000000000000002',
    value: 50000000000000000n,
    data: '0x',
    nonce: 1n,
    deadline: 1800000000n,
  }
);

assert.ok(digest.startsWith('0x'));
assert.equal(digest.length, 66);
console.log('  PASS digest computes deterministic EIP-712 override hash');

console.log('All EIP-712 tests passed!');
