import assert from 'node:assert/strict';
import registry from '../../demo/deployments/registry.json';
import { getDeploymentMetadata } from '../../scripts/multichain-deploy';

console.log('--- Multi-Chain Registry Verification ---');

const meta = getDeploymentMetadata();

assert.equal(registry.policyFingerprint, meta.fingerprint);
assert.equal(registry.salt, meta.salt);

// Check that each chain has the identical deterministic CREATE2 address
const addresses = Object.values(registry.deployments).map((d) => d.moduleAddress);
const uniqueAddresses = new Set(addresses);
assert.equal(uniqueAddresses.size, 1, 'All chains must share the identical CREATE2 address');

console.log(`  PASS Verified deterministic deployment on ${Object.keys(registry.deployments).length} chains`);
console.log(`  PASS CREATE2 Address: ${addresses[0]}`);
console.log(`  PASS Uniform Fingerprint: ${registry.policyFingerprint}`);
