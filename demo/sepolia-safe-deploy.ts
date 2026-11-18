/**
 * Deploys Leash on Sepolia behind a real Safe v1.4.1 account:
 *   1. creates a 1-of-1 Safe (owner = OWNER_PK) from the canonical Safe v1.4.1 singleton and proxy factory;
 *   2. deploys a LeashModule compiled for demo/deployments/sepolia-safe-policy.json
 *      (built with `node scripts/build-policy.mjs demo/deployments/sepolia-safe-policy.json --build --output out/sepolia_policy`);
 *   3. enables the module and registers the agent through Safe transactions signed by the owner;
 *   4. funds the Safe with test ETH and demo tokens.
 * Writes demo/deployments/sepolia-safe.json. Keys come from demo/.env (see `npm run wizard`).
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  encodeDeployData,
  encodeFunctionData,
  http,
  keccak256,
  parseAbi,
  parseEther,
  zeroAddress,
  type Abi,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import safeArtifact from '@safe-global/safe-contracts/build/artifacts/contracts/Safe.sol/Safe.json';
import factoryArtifact from '@safe-global/safe-contracts/build/artifacts/contracts/proxies/SafeProxyFactory.sol/SafeProxyFactory.json';

// Canonical Safe v1.4.1 deployments (safe-global/safe-deployments), same address on every chain.
const SAFE_SINGLETON: Address = '0x41675C099F32341bf84BFc5382aF534df5C7461a';
const SAFE_PROXY_FACTORY: Address = '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67';
const FALLBACK_HANDLER: Address = '0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99';

const ROOT = path.resolve(__dirname, '..');
const POLICY_JSON = path.join(__dirname, 'deployments', 'sepolia-safe-policy.json');
const MODULE_DIR = path.join(ROOT, 'out', 'sepolia_policy');
const OUT = path.join(__dirname, 'deployments', 'sepolia-safe.json');

function loadEnv(): Record<string, string> {
  const raw = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  return Object.fromEntries(
    raw.split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
  );
}

async function main() {
  const env = loadEnv();
  const rpc = env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
  const owner = privateKeyToAccount(env.OWNER_PK as Hex);
  const agent = privateKeyToAccount(env.AGENT_PK as Hex).address;
  const guardian = env.GUARDIAN_ADDRESS as Address;
  const policy = JSON.parse(fs.readFileSync(POLICY_JSON, 'utf8'));
  const token = policy.tokens[0].address as Address;

  const pub = createPublicClient({ chain: sepolia, transport: http(rpc) });
  const wallet = createWalletClient({ account: owner, chain: sepolia, transport: http(rpc) });
  const send = async (label: string, tx: Parameters<typeof wallet.sendTransaction>[0]) => {
    const hash = await wallet.sendTransaction(tx);
    const receipt = await pub.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error(`${label} failed: ${hash}`);
    console.log(`[safe-deploy] ${label}: ${hash}`);
    return receipt;
  };

  // 0. The canonical Safe singleton on Sepolia must be the Safe v1.4.1 code from the npm package.
  const onChain = await pub.getCode({ address: SAFE_SINGLETON });
  if (!onChain || keccak256(onChain) !== keccak256(safeArtifact.deployedBytecode as Hex)) {
    throw new Error('Safe v1.4.1 singleton on Sepolia does not match @safe-global/safe-contracts');
  }
  for (const a of [SAFE_PROXY_FACTORY, FALLBACK_HANDLER]) {
    if (!(await pub.getCode({ address: a }))) throw new Error(`no code at ${a}`);
  }

  // 1. A 1-of-1 Safe owned by the owner key.
  const initializer = encodeFunctionData({
    abi: safeArtifact.abi as Abi,
    functionName: 'setup',
    args: [[owner.address], 1n, zeroAddress, '0x', FALLBACK_HANDLER, zeroAddress, 0n, zeroAddress],
  });
  const saltNonce = BigInt(Date.now());
  const created = await send('create Safe v1.4.1', {
    to: SAFE_PROXY_FACTORY,
    data: encodeFunctionData({ abi: factoryArtifact.abi as Abi, functionName: 'createProxyWithNonce', args: [SAFE_SINGLETON, initializer, saltNonce] }),
  });
  let safe: Address | undefined;
  for (const log of created.logs) {
    try {
      const ev = decodeEventLog({ abi: factoryArtifact.abi as Abi, data: log.data, topics: log.topics });
      if (ev.eventName === 'ProxyCreation') safe = (ev.args as unknown as { proxy: Address }).proxy;
    } catch { /* other events */ }
  }
  if (!safe) throw new Error('ProxyCreation event not found');
  const [owners, threshold] = await Promise.all([
    pub.readContract({ address: safe, abi: safeArtifact.abi as Abi, functionName: 'getOwners' }) as Promise<Address[]>,
    pub.readContract({ address: safe, abi: safeArtifact.abi as Abi, functionName: 'getThreshold' }) as Promise<bigint>,
  ]);
  console.log(`[safe-deploy] Safe: ${safe} (owners ${owners.join(',')}, threshold ${threshold})`);

  // 2. LeashModule compiled for this policy.
  const moduleAbi = JSON.parse(fs.readFileSync(path.join(MODULE_DIR, 'LeashModule.abi.json'), 'utf8')) as Abi;
  const moduleBin = ('0x' + fs.readFileSync(path.join(MODULE_DIR, 'LeashModule.bin'), 'utf8').trim()) as Hex;
  const deployed = await send('deploy LeashModule', { data: encodeDeployData({ abi: moduleAbi, bytecode: moduleBin, args: [safe, guardian] }) });
  const module = deployed.contractAddress as Address;
  const fingerprint = '0x' + ((await pub.readContract({ address: module, abi: moduleAbi, functionName: 'fingerprint' })) as bigint).toString(16).padStart(64, '0');
  const expected = fs.readFileSync(path.join(MODULE_DIR, 'fingerprint.txt'), 'utf8').trim();
  if (fingerprint !== expected) throw new Error(`fingerprint mismatch: ${fingerprint} vs ${expected}`);
  console.log(`[safe-deploy] LeashModule: ${module} (fingerprint ${fingerprint})`);

  // 3. Safe transactions signed by the sole owner. With msg.sender == owner, the signature is the
  //    "approved by sender" form: r = owner address, s = 0, v = 1.
  const ownerSig = ('0x' + owner.address.slice(2).toLowerCase().padStart(64, '0') + '0'.repeat(64) + '01') as Hex;
  const execSafe = (label: string, to: Address, data: Hex) =>
    send(label, {
      to: safe!,
      data: encodeFunctionData({
        abi: safeArtifact.abi as Abi,
        functionName: 'execTransaction',
        args: [to, 0n, data, 0, 0n, 0n, 0n, zeroAddress, zeroAddress, ownerSig],
      }),
    });
  await execSafe('Safe.enableModule', safe, encodeFunctionData({ abi: safeArtifact.abi as Abi, functionName: 'enableModule', args: [module] }));
  const enabled = await pub.readContract({ address: safe, abi: safeArtifact.abi as Abi, functionName: 'isModuleEnabled', args: [module] });
  if (!enabled) throw new Error('module not enabled');
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 3600);
  await execSafe('LeashModule.setAgent (via Safe)', module, encodeFunctionData({ abi: moduleAbi, functionName: 'setAgent', args: [agent, expiry, 1n] }));

  // 4. Funds the agent can try to move.
  await send('fund Safe with 0.2 ETH', { to: safe, value: parseEther('0.2') });
  const erc20 = parseAbi(['function mint(address,uint256)', 'function balanceOf(address) view returns (uint256)']);
  await send('mint 1000 tokens to Safe', { to: token, data: encodeFunctionData({ abi: erc20, functionName: 'mint', args: [safe, 1000n * 10n ** 18n] }) });

  const record = {
    network: 'sepolia',
    chainId: 11155111,
    deployedAt: new Date().toISOString(),
    safeVersion: '1.4.1',
    safe,
    safeSingleton: SAFE_SINGLETON,
    safeProxyFactory: SAFE_PROXY_FACTORY,
    module,
    token,
    treasury: policy.targets.find((t: { allow_eth_transfer?: boolean }) => t.allow_eth_transfer).address,
    owner: owner.address,
    agent,
    guardian,
    policy: 'demo/deployments/sepolia-safe-policy.json',
    fingerprint,
  };
  fs.writeFileSync(OUT, JSON.stringify(record, null, 2) + '\n');
  console.log(`[safe-deploy] wrote ${path.relative(ROOT, OUT)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
