import assert from 'node:assert/strict';
import { Chain } from '../../api/_lib/evm';
import {
  encodeDeployData,
  encodeFunctionData,
  decodeFunctionResult,
  parseEther,
  formatEther,
  type Hex,
  type Abi,
} from 'viem';
import safeArtifact from '@safe-global/safe-contracts/build/artifacts/contracts/Safe.sol/Safe.json';
import proxyArtifact from '@safe-global/safe-contracts/build/artifacts/contracts/proxies/SafeProxy.sol/SafeProxy.json';
import * as fs from 'fs';
import * as path from 'path';

const OWNER_PK: Hex = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const AGENT_PK: Hex = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const GUARDIAN_PK: Hex = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a';
const TREASURY: Hex = '0x2000000000000000000000000000000000000002';
const ADDR_TOKEN: Hex = '0x1000000000000000000000000000000000000001';
const READER: Hex = '0x00000000000000000000000000000000000000aa';

function TOK(amount: bigint): bigint {
  return amount * 10n ** 18n;
}

function word(hexWithout0x: string): string {
  return hexWithout0x.replace(/^0x/, '').toLowerCase().padStart(64, '0');
}

function prevalidatedSignature(address: Hex): Hex {
  return ('0x' + word(address) + ''.padStart(64, '0') + '01') as Hex;
}

async function run() {
  console.log('=== Integration Suite: LeashModule with Canonical Safe v1.4.1 ===\n');

  const chain = await Chain.create(BigInt(Math.floor(Date.now() / 1000)));
  const owner = await chain.signer(OWNER_PK, parseEther('100'));
  const agent = await chain.signer(AGENT_PK, parseEther('10'));
  const guardian = await chain.signer(GUARDIAN_PK, parseEther('10'));

  // 1. Deploy real Safe v1.4.1 singleton & proxy
  console.log('1. Deploying official Safe v1.4.1 singleton and proxy...');
  const safeDeploy = await chain.send(owner, undefined, safeArtifact.bytecode as Hex);
  assert.ok(safeDeploy.success, 'deploy Safe singleton failed: ' + safeDeploy.error);
  const singleton = safeDeploy.createdAddress!;

  const proxyDeploy = await chain.send(
    owner,
    undefined,
    encodeDeployData({
      abi: proxyArtifact.abi as Abi,
      bytecode: proxyArtifact.bytecode as Hex,
      args: [singleton],
    })
  );
  assert.ok(proxyDeploy.success, 'deploy SafeProxy failed: ' + proxyDeploy.error);
  const safe = proxyDeploy.createdAddress!;
  console.log('   Safe proxy deployed at:', safe);

  // 2. Initialize Safe proxy (1-of-1 owner)
  console.log('2. Initializing Safe proxy with setup()...');
  const setupData = encodeFunctionData({
    abi: safeArtifact.abi as Abi,
    functionName: 'setup',
    args: [
      [owner.address],
      1n,
      '0x0000000000000000000000000000000000000000',
      '0x',
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
      0n,
      '0x0000000000000000000000000000000000000000',
    ],
  });
  const setupRes = await chain.send(owner, safe, setupData);
  assert.ok(setupRes.success, 'Safe setup failed: ' + setupRes.error);

  // 3. Deploy LeashModule
  console.log('3. Deploying LeashModule...');
  const moduleAbi = JSON.parse(
    fs.readFileSync(path.join('api', '_assets', 'artifacts', 'LeashModule.abi.json'), 'utf8')
  ) as Abi;
  const moduleBin = ('0x' +
    fs.readFileSync(path.join('api', '_assets', 'artifacts', 'LeashModule.bin'), 'utf8').trim()) as Hex;

  const moduleDeploy = await chain.send(
    owner,
    undefined,
    encodeDeployData({
      abi: moduleAbi,
      bytecode: moduleBin,
      args: [safe, guardian.address],
    })
  );
  assert.ok(moduleDeploy.success, 'deploy LeashModule failed: ' + moduleDeploy.error);
  const module = moduleDeploy.createdAddress!;
  console.log('   LeashModule deployed at:', module);

  // 4. Enable LeashModule on Safe via Safe.execTransaction
  console.log('4. Enabling LeashModule on Safe via Safe.execTransaction...');
  const enableModuleData = encodeFunctionData({
    abi: safeArtifact.abi as Abi,
    functionName: 'enableModule',
    args: [module],
  });
  const execEnableRes = await chain.send(
    owner,
    safe,
    encodeFunctionData({
      abi: safeArtifact.abi as Abi,
      functionName: 'execTransaction',
      args: [
        safe,
        0n,
        enableModuleData,
        0,
        0n,
        0n,
        0n,
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        prevalidatedSignature(owner.address),
      ],
    })
  );
  assert.ok(execEnableRes.success, 'enableModule failed: ' + execEnableRes.error);

  const isEnabledData = await chain.call(
    READER,
    safe,
    encodeFunctionData({
      abi: safeArtifact.abi as Abi,
      functionName: 'isModuleEnabled',
      args: [module],
    })
  );
  const isEnabled = decodeFunctionResult({
    abi: safeArtifact.abi as Abi,
    functionName: 'isModuleEnabled',
    data: isEnabledData,
  });
  assert.equal(isEnabled, true, 'module must be enabled on Safe');
  console.log('   Verified LeashModule is active on Safe v1.4.1.');

  // 5. Register AI Agent on LeashModule via Safe.execTransaction
  console.log('5. Registering AI agent on LeashModule via Safe...');
  const expiry = chain.now + 86400n * 365n;
  const setAgentData = encodeFunctionData({
    abi: moduleAbi,
    functionName: 'setAgent',
    args: [agent.address, expiry, 1n],
  });
  const execSetAgent = await chain.send(
    owner,
    safe,
    encodeFunctionData({
      abi: safeArtifact.abi as Abi,
      functionName: 'execTransaction',
      args: [
        module,
        0n,
        setAgentData,
        0,
        0n,
        0n,
        0n,
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        prevalidatedSignature(owner.address),
      ],
    })
  );
  assert.ok(execSetAgent.success, 'setAgent failed: ' + execSetAgent.error);

  // 6. Deploy Mock ERC-20 token to ADDR_TOKEN
  console.log('6. Deploying Mock ERC-20 token to allowlisted address...');
  const tokenAbi = JSON.parse(
    fs.readFileSync(path.join('api', '_assets', 'artifacts', 'MockErc20.abi.json'), 'utf8')
  ) as Abi;
  const tokenBin = ('0x' +
    fs.readFileSync(path.join('api', '_assets', 'artifacts', 'MockErc20.bin'), 'utf8').trim()) as Hex;
  const tokenDeploy = await chain.send(owner, undefined, tokenBin);
  assert.ok(tokenDeploy.success, 'deploy MockErc20 failed: ' + tokenDeploy.error);
  await chain.putCode(ADDR_TOKEN, await chain.getCode(tokenDeploy.createdAddress!));

  // Mint 1000 tokens to Safe and fund Safe with 10 ETH
  await chain.send(
    owner,
    ADDR_TOKEN,
    encodeFunctionData({
      abi: tokenAbi,
      functionName: 'mint',
      args: [safe, TOK(1000n)],
    })
  );
  await chain.setBalance(safe, parseEther('10'));
  console.log('   Funded Safe with 10 ETH and 1000 tokens.');

  // Helper function for agent executing via module
  async function agentTryExecute(to: Hex, value: bigint, data: Hex = '0x') {
    const tx = await chain.send(
      agent,
      module,
      encodeFunctionData({
        abi: moduleAbi,
        functionName: 'tryExecute',
        args: [to, value, data, 0],
      })
    );
    assert.ok(tx.success, 'tryExecute transaction failed: ' + tx.error);
    const [success, denyCode] = decodeFunctionResult({
      abi: moduleAbi,
      functionName: 'tryExecute',
      data: tx.returnData,
    }) as [boolean, number];
    return { success, denyCode, gasUsed: tx.gasUsed };
  }

  // 7. Test Allowed ETH transfer (0.05 ETH)
  console.log('7. Testing allowed ETH transfer (0.05 ETH)...');
  const ethTx = await agentTryExecute(TREASURY, parseEther('0.05'));
  assert.equal(ethTx.success, true, 'ETH transfer must succeed');
  assert.equal(ethTx.denyCode, 0, 'denyCode must be 0 (Allow)');
  assert.equal(await chain.balanceOf(TREASURY), parseEther('0.05'));
  assert.equal(await chain.balanceOf(safe), parseEther('9.95'));
  console.log(`   Success! Gas used: ${ethTx.gasUsed}`);

  // 8. Test Allowed Token transfer (50 tokens)
  console.log('8. Testing allowed Token transfer (50 tokens)...');
  const transferCalldata = ('0xa9059cbb' + word(TREASURY) + word(TOK(50n).toString(16))) as Hex;
  const tokTx = await agentTryExecute(ADDR_TOKEN, 0n, transferCalldata);
  assert.equal(tokTx.success, true, 'Token transfer must succeed');
  assert.equal(tokTx.denyCode, 0, 'denyCode must be 0 (Allow)');

  const readBal = async (who: Hex): Promise<bigint> => {
    const d = await chain.call(
      READER,
      ADDR_TOKEN,
      encodeFunctionData({
        abi: tokenAbi,
        functionName: 'balanceOf',
        args: [who],
      })
    );
    return decodeFunctionResult({ abi: tokenAbi, functionName: 'balanceOf', data: d }) as bigint;
  };
  assert.equal(await readBal(TREASURY), TOK(50n), 'Treasury received 50 tokens');
  assert.equal(await readBal(safe), TOK(950n), 'Safe has 950 tokens remaining');
  console.log(`   Success! Gas used: ${tokTx.gasUsed}`);

  // 9. Test Guardian Pause & Safe Unpause Lifecycle
  console.log('9. Testing Guardian pause and Safe unpause lifecycle...');
  // Guardian pauses
  const pauseTx = await chain.send(
    guardian,
    module,
    encodeFunctionData({
      abi: moduleAbi,
      functionName: 'pause',
      args: [],
    })
  );
  assert.ok(pauseTx.success, 'guardian pause must succeed');

  // Call while paused fails with code 1 (Paused)
  const pausedCall = await agentTryExecute(TREASURY, parseEther('0.01'));
  assert.equal(pausedCall.success, false);
  assert.equal(pausedCall.denyCode, 1, 'denyCode must be 1 (Paused)');
  console.log('   Guardian pause verified (DenyCode = 1 - Paused).');

  // Safe unpauses and resets denials via Safe.execTransaction
  console.log('   Safe unpausing and resetting denials via Safe.execTransaction...');
  const unpauseData = encodeFunctionData({ abi: moduleAbi, functionName: 'unpause', args: [] });
  const resetDenialsData = encodeFunctionData({ abi: moduleAbi, functionName: 'resetBreaker', args: [agent.address] });
  await chain.send(
    owner,
    safe,
    encodeFunctionData({
      abi: safeArtifact.abi as Abi,
      functionName: 'execTransaction',
      args: [
        module,
        0n,
        unpauseData,
        0,
        0n,
        0n,
        0n,
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        prevalidatedSignature(owner.address),
      ],
    })
  );
  await chain.send(
    owner,
    safe,
    encodeFunctionData({
      abi: safeArtifact.abi as Abi,
      functionName: 'execTransaction',
      args: [
        module,
        0n,
        resetDenialsData,
        0,
        0n,
        0n,
        0n,
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        prevalidatedSignature(owner.address),
      ],
    })
  );

  // Resume operations: Agent can transfer after Safe unpause
  const unpausedTx = await agentTryExecute(TREASURY, parseEther('0.01'));
  assert.equal(unpausedTx.success, true, 'Agent resumed transfer after Safe unpause');
  assert.equal(unpausedTx.denyCode, 0);
  console.log('   Safe unpause verified!');

  // 10. Test Denied ETH transfer (0.2 ETH > 0.1 ETH per-tx cap) -> Denial 1
  console.log('10. Testing denied ETH transfer (0.2 ETH > cap) [Denial 1]...');
  const denyEth = await agentTryExecute(TREASURY, parseEther('0.2'));
  assert.equal(denyEth.success, false, 'Over-cap ETH transfer must be denied');
  assert.equal(denyEth.denyCode, 7, 'denyCode must be 7 (PerTxCapExceeded)');
  console.log('   Denied correctly with code 7 (PerTxCapExceeded).');

  // 11. Test Denied Token transfer (150 tokens > 100 token cap) -> Denial 2
  console.log('11. Testing denied Token transfer (150 tokens > cap) [Denial 2]...');
  const denyTokCalldata = ('0xa9059cbb' + word(TREASURY) + word(TOK(150n).toString(16))) as Hex;
  const denyTok = await agentTryExecute(ADDR_TOKEN, 0n, denyTokCalldata);
  assert.equal(denyTok.success, false, 'Over-cap token transfer must be denied');
  assert.equal(denyTok.denyCode, 9, 'denyCode must be 9 (TokenPerTxCapExceeded)');
  console.log('   Denied correctly with code 9 (TokenPerTxCapExceeded).');

  // 12. Test Unlimited Approval Forbidden -> Denial 3 (Trips Circuit Breaker!)
  console.log('12. Testing unlimited approve forbidden [Denial 3 -> trips breaker]...');
  const unlimitedApprove = ('0x095ea7b3' + word(TREASURY) + ''.padStart(64, 'f')) as Hex;
  const denyApprove = await agentTryExecute(ADDR_TOKEN, 0n, unlimitedApprove);
  assert.equal(denyApprove.success, false, 'Unlimited approve must be denied');
  assert.equal(denyApprove.denyCode, 10, 'denyCode must be 10 (UnlimitedApproveForbidden)');
  console.log('   Denied correctly with code 10. Consecutive denials = 3.');

  // 13. Test Circuit Breaker Tripped -> Next call fails with code 15 (CircuitTripped)
  console.log('13. Testing circuit breaker tripped state...');
  const breakerCall = await agentTryExecute(TREASURY, parseEther('0.01'));
  assert.equal(breakerCall.success, false, 'Calls while breaker is tripped must fail');
  assert.equal(breakerCall.denyCode, 15, 'denyCode must be 15 (CircuitTripped)');
  console.log('   Enforced: Breaker is active! DenyCode = 15 (CircuitTripped).');

  // Safe resets breaker via Safe.execTransaction
  console.log('   Safe resetting breaker via Safe.execTransaction...');
  const resetBreakerData = encodeFunctionData({ abi: moduleAbi, functionName: 'resetBreaker', args: [agent.address] });
  await chain.send(
    owner,
    safe,
    encodeFunctionData({
      abi: safeArtifact.abi as Abi,
      functionName: 'execTransaction',
      args: [
        module,
        0n,
        resetBreakerData,
        0,
        0n,
        0n,
        0n,
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        prevalidatedSignature(owner.address),
      ],
    })
  );

  const afterResetTx = await agentTryExecute(TREASURY, parseEther('0.01'));
  assert.equal(afterResetTx.success, true, 'Agent resumed after breaker reset');
  assert.equal(afterResetTx.denyCode, 0);
  console.log('   Breaker reset verified!');

  // 14. Test Atomic Revert on `execute` to unlisted target
  console.log('14. Testing atomic revert with execute() on unlisted target...');
  const txReverted = await chain.send(
    agent,
    module,
    encodeFunctionData({
      abi: moduleAbi,
      functionName: 'execute',
      args: ['0xdead00000000000000000000000000000000beef', parseEther('0.01'), '0x', 0],
    })
  );
  assert.equal(txReverted.success, false, 'execute to unlisted target must revert');
  console.log('   Revert verified: transaction rolled back atomically without state change.');

  console.log('\n===============================================================');
  console.log('  ALL CANONICAL SAFE v1.4.1 INTEGRATION TESTS PASSED (14/14)!');
  console.log('===============================================================\n');
}

run().catch((err) => {
  console.error('\nFAILED: Safe v1.4.1 integration test encountered error:\n', err);
  process.exit(1);
});
