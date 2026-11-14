import assert from 'node:assert/strict';
import { LeashClient, SafeLeashPackager, createLeashLangChainTool } from '../src/index.js';

async function run() {
  console.log('--- Testing @leash/sdk ---');
  const client = new LeashClient();

  // Test 1: Allowed transaction
  const allowRes = await client.evaluate({
    to: '0x2000000000000000000000000000000000000002',
    valueWei: 50000000000000000n, // 0.05 ETH
  });
  assert.equal(allowRes.verdict, 'ALLOW');
  assert.equal(allowRes.code, 0);
  assert.equal(allowRes.allowed, true);
  console.log('  PASS evaluate() allows 0.05 ETH to treasury');

  // Test 2: Per-tx cap breach
  const capRes = await client.evaluate({
    to: '0x2000000000000000000000000000000000000002',
    valueWei: 200000000000000000n, // 0.2 ETH
  });
  assert.equal(capRes.verdict, 'DENY');
  assert.equal(capRes.code, 7);
  assert.equal(capRes.reason, 'PerTxCapExceeded');
  console.log('  PASS evaluate() denies 0.2 ETH (PerTxCapExceeded)');

  // Test 3: Unlisted target denial
  const targetRes = await client.evaluate({
    to: '0xdead000000000000000000000000000000000001',
    valueWei: 1000000000000000n,
  });
  assert.equal(targetRes.verdict, 'DENY');
  assert.equal(targetRes.code, 4);
  assert.equal(targetRes.reason, 'TargetNotAllowed');
  console.log('  PASS evaluate() denies unlisted target (TargetNotAllowed)');

  // Test 4: Delegatecall blocked
  const dcRes = await client.evaluate({
    to: '0x2000000000000000000000000000000000000002',
    operation: 'delegatecall',
  });
  assert.equal(dcRes.verdict, 'DENY');
  assert.equal(dcRes.code, 3);
  assert.equal(dcRes.reason, 'DelegateCallBlocked');
  console.log('  PASS evaluate() blocks delegatecall');

  // Test 5: Safe tryExecute packager
  const packed = SafeLeashPackager.formatTryExecute({
    to: '0x2000000000000000000000000000000000000002',
    valueWei: 50000000000000000n,
  });
  assert.ok(packed.data.startsWith('0x'));
  assert.equal(packed.value, 0n);
  console.log('  PASS SafeLeashPackager formats calldata');

  // Test 6: LangChain adapter
  const tool = createLeashLangChainTool(client);
  const toolOutputStr = await tool.func({
    to: '0x2000000000000000000000000000000000000002',
    valueWei: '50000000000000000',
  });
  const parsed = JSON.parse(toolOutputStr);
  assert.equal(parsed.verdict, 'ALLOW');
  console.log('  PASS LangChain adapter executes and returns schema output');

  console.log('All @leash/sdk tests passed!');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
