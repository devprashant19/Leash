/**
 * Runs the 5-transaction scenario against the real-Safe deployment in demo/deployments/sepolia-safe.json.
 * Each call is first predicted by the Fe-built `leash` CLI compiled for the same policy
 * (set LEASH_BIN to it; LEASH_REQUIRE_NATIVE=1 is enforced because the TypeScript mirror only knows the
 * default policy), then sent by the agent key through LeashModule.tryExecute.
 * Writes demo/deployments/sepolia-safe-run.json.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  encodeFunctionData,
  formatEther,
  http,
  maxUint256,
  parseAbi,
  parseEther,
  type Abi,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { predictVerdict, predictionSource } from './lib/leash-cli';

process.env.LEASH_REQUIRE_NATIVE = '1';
const ROOT = path.resolve(__dirname, '..');
const dep = JSON.parse(fs.readFileSync(path.join(__dirname, 'deployments', 'sepolia-safe.json'), 'utf8'));
const env = Object.fromEntries(
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const moduleAbi = JSON.parse(fs.readFileSync(path.join(ROOT, 'out', 'sepolia_policy', 'LeashModule.abi.json'), 'utf8')) as Abi;
const erc20 = parseAbi(['function transfer(address,uint256)', 'function approve(address,uint256)', 'function balanceOf(address) view returns (uint256)']);
const UNLISTED: Address = '0xdead000000000000000000000000000000000001';
const SPENDER: Address = '0x00000000000000000000000000000000000beef1';

const steps: Array<{ description: string; to: Address; value: bigint; data: Hex }> = [
  { description: 'Agent sends 0.05 ETH to the treasury', to: dep.treasury, value: parseEther('0.05'), data: '0x' },
  { description: 'Agent transfers 50 tokens to the treasury', to: dep.token, value: 0n, data: encodeFunctionData({ abi: erc20, functionName: 'transfer', args: [dep.treasury, 50n * 10n ** 18n] }) },
  { description: 'Agent sends 0.2 ETH (over the 0.1 ETH per-tx cap)', to: dep.treasury, value: parseEther('0.2'), data: '0x' },
  { description: 'Agent calls an unlisted contract', to: UNLISTED, value: 0n, data: '0x' },
  { description: 'Agent approves an unlimited allowance', to: dep.token, value: 0n, data: encodeFunctionData({ abi: erc20, functionName: 'approve', args: [SPENDER, maxUint256] }) },
];

async function main() {
  if (predictionSource() !== 'fe-native') throw new Error('Set LEASH_BIN to the leash CLI built for this policy');
  const rpc = env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
  const agent = privateKeyToAccount(env.AGENT_PK as Hex);
  const pub = createPublicClient({ chain: sepolia, transport: http(rpc) });
  const wallet = createWalletClient({ account: agent, chain: sepolia, transport: http(rpc) });

  const balances = async () => ({
    safeEth: formatEther(await pub.getBalance({ address: dep.safe })),
    treasuryEth: formatEther(await pub.getBalance({ address: dep.treasury })),
    safeTokens: formatEther((await pub.readContract({ address: dep.token, abi: erc20, functionName: 'balanceOf', args: [dep.safe] })) as bigint),
    treasuryTokens: formatEther((await pub.readContract({ address: dep.token, abi: erc20, functionName: 'balanceOf', args: [dep.treasury] })) as bigint),
  });
  const before = await balances();
  const cliFingerprint = predictVerdict({ to: dep.treasury, valueWei: 0n }).fingerprint;
  const results = [];

  for (const [i, s] of steps.entries()) {
    const words = (await pub.readContract({ address: dep.module, abi: moduleAbi, functionName: 'state', args: [agent.address] })) as bigint[];
    const stateHex = ('0x' + words.map((w) => w.toString(16).padStart(64, '0')).join('')) as Hex;
    const now = Number((await pub.getBlock()).timestamp);
    const p = predictVerdict({ to: s.to, valueWei: s.value, data: s.data, op: 'call', now, stateHex });

    const hash = await wallet.writeContract({ address: dep.module, abi: moduleAbi, functionName: 'tryExecute', args: [s.to, s.value, s.data, 0] });
    const receipt = await pub.waitForTransactionReceipt({ hash });
    let onchainCode = -1;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== dep.module.toLowerCase()) continue;
      try {
        const ev = decodeEventLog({ abi: moduleAbi, data: log.data, topics: log.topics });
        if (ev.eventName === 'Allowed') onchainCode = 0;
        if (ev.eventName === 'Denied') onchainCode = Number((ev.args as unknown as { code: number }).code);
      } catch { /* not a module event */ }
    }
    const match = onchainCode === p.code;
    console.log(`${i + 1}. ${s.description}: predicted ${p.verdict} ${p.code}, on-chain ${onchainCode === 0 ? 'ALLOW' : 'DENY'} ${onchainCode} ${match ? 'MATCH' : 'MISMATCH'} (${hash})`);
    results.push({ i: i + 1, description: s.description, predicted: p.verdict, predictedCode: p.code, onchainCode, matched: match, txHash: hash, gasUsed: Number(receipt.gasUsed), status: receipt.status });
  }

  const after = await balances();
  const fingerprintChain = '0x' + ((await pub.readContract({ address: dep.module, abi: moduleAbi, functionName: 'fingerprint' })) as bigint).toString(16).padStart(64, '0');
  const run = {
    network: 'sepolia',
    safeVersion: dep.safeVersion,
    safe: dep.safe,
    module: dep.module,
    predictionSource: predictionSource(),
    fingerprintCli: cliFingerprint,
    fingerprintChain,
    fingerprintsMatch: cliFingerprint === fingerprintChain,
    allStepsMatched: results.every((r) => r.matched),
    balancesBefore: before,
    balancesAfter: after,
    steps: results,
  };
  fs.writeFileSync(path.join(__dirname, 'deployments', 'sepolia-safe-run.json'), JSON.stringify(run, null, 2) + '\n');
  console.log(`fingerprints ${run.fingerprintsMatch ? 'match' : 'DIFFER'}; all matched: ${run.allStepsMatched}`);
  console.log('balances before', JSON.stringify(before));
  console.log('balances after ', JSON.stringify(after));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
