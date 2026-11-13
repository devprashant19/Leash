import * as fs from 'fs';
import * as path from 'path';
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  parseEther,
  formatEther
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { getLeashModuleArtifact, getMockSafeArtifact, getMockErc20Artifact } from './lib/artifacts';

function loadEnv() {
  const envPath = path.resolve(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    console.error('Error: demo/.env not found. Run "npm run wizard" to set up your environment.');
    process.exit(1);
  }
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  const env: Record<string, string> = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
      }
    }
  }
  return env;
}

async function main() {
  console.log('\n======================================================');
  console.log('       LEASH — TESTNET DEPLOYMENT WIZARD             ');
  console.log('       Target: Ethereum Sepolia (v26.6.0)             ');
  console.log('======================================================\n');

  const env = loadEnv();
  const rpcUrl = env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org';
  const ownerPk = env.OWNER_PK as Hex;
  const agentPk = env.AGENT_PK as Hex;
  const guardianAddress = (env.GUARDIAN_ADDRESS || '0x2000000000000000000000000000000000000002') as Address;

  if (!ownerPk || !agentPk) {
    console.error('Error: OWNER_PK and AGENT_PK must be set in demo/.env');
    process.exit(1);
  }

  const ownerAccount = privateKeyToAccount(ownerPk);
  const agentAccount = privateKeyToAccount(agentPk);

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl)
  });

  const walletClient = createWalletClient({
    account: ownerAccount,
    chain: sepolia,
    transport: http(rpcUrl)
  });

  const balance = await publicClient.getBalance({ address: ownerAccount.address });
  console.log(`[deploy] Deployer Account: ${ownerAccount.address}`);
  console.log(`[deploy] Deployer Balance: ${formatEther(balance)} ETH`);

  if (balance < parseEther('0.02')) {
    console.warn(`[deploy] Warning: Deployer balance is low (< 0.02 ETH). Deploy might fail due to gas.`);
  }

  // 1. Safe Address (reuse if provided, otherwise deploy MockSafe)
  let safeAddress: Address;
  const safeArtifact = getMockSafeArtifact();
  if (env.SAFE_ADDRESS && env.SAFE_ADDRESS.startsWith('0x')) {
    safeAddress = env.SAFE_ADDRESS as Address;
    console.log(`[deploy] Using existing Safe at: ${safeAddress}`);
  } else {
    console.log(`[deploy] Deploying Safe instance on Sepolia...`);
    const safeTxHash = await walletClient.deployContract({
      abi: safeArtifact.abi,
      bytecode: safeArtifact.bytecode,
      args: []
    });
    console.log(`[deploy] Safe deployment tx: ${safeTxHash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: safeTxHash });
    safeAddress = receipt.contractAddress!;
    console.log(`[deploy] Safe deployed at:   ${safeAddress}`);
  }

  // 2. Deploy LeashModule with (safeAddress, guardianAddress)
  console.log(`[deploy] Deploying LeashModule (Safe: ${safeAddress}, Guardian: ${guardianAddress})...`);
  const moduleArtifact = getLeashModuleArtifact();
  const moduleTxHash = await walletClient.deployContract({
    abi: moduleArtifact.abi,
    bytecode: moduleArtifact.bytecode,
    args: [safeAddress, guardianAddress]
  });
  console.log(`[deploy] LeashModule deployment tx: ${moduleTxHash}`);
  const moduleReceipt = await publicClient.waitForTransactionReceipt({ hash: moduleTxHash });
  const moduleAddress = moduleReceipt.contractAddress!;
  console.log(`[deploy] LeashModule deployed at:   ${moduleAddress}`);

  // 3. Deploy Demo ERC20 Token (MockErc20)
  console.log(`[deploy] Deploying Demo ERC-20 Token...`);
  const tokenArtifact = getMockErc20Artifact();
  const tokenTxHash = await walletClient.deployContract({
    abi: tokenArtifact.abi,
    bytecode: tokenArtifact.bytecode,
    args: []
  });
  console.log(`[deploy] Token deployment tx: ${tokenTxHash}`);
  const tokenReceipt = await publicClient.waitForTransactionReceipt({ hash: tokenTxHash });
  const tokenAddress = tokenReceipt.contractAddress!;
  console.log(`[deploy] Token deployed at:   ${tokenAddress}`);

  // 4. Safe enables LeashModule
  console.log(`[deploy] Enabling LeashModule on Safe...`);
  const enableHash = await walletClient.writeContract({
    address: safeAddress,
    abi: safeArtifact.abi,
    functionName: 'enableModule',
    args: [moduleAddress]
  });
  await publicClient.waitForTransactionReceipt({ hash: enableHash });
  console.log(`[deploy] Module enabled: ${enableHash}`);

  // 5. Safe registers Agent on LeashModule
  const oneYearFromNow = BigInt(Math.floor(Date.now() / 1000) + 31536000);
  console.log(`[deploy] Registering Agent ${agentAccount.address} on LeashModule...`);
  const setAgentHash = await walletClient.writeContract({
    address: safeAddress,
    abi: safeArtifact.abi,
    functionName: 'setAgentOn',
    args: [moduleAddress, agentAccount.address, oneYearFromNow, 1n]
  });
  await publicClient.waitForTransactionReceipt({ hash: setAgentHash });
  console.log(`[deploy] Agent registered: ${setAgentHash}`);

  // 6. Write deployment file
  const deploymentsDir = path.resolve(__dirname, 'deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentData = {
    network: 'sepolia',
    chainId: 11155111,
    deployedAt: new Date().toISOString(),
    safe: safeAddress,
    module: moduleAddress,
    token: tokenAddress,
    owner: ownerAccount.address,
    agent: agentAccount.address,
    guardian: guardianAddress,
    fingerprint: '0x3efcfc58aec5d1e7e81b5bded7820ed3ed8a0e654cf4aff3bfb793a7494ae6ee'
  };

  const deploymentPath = path.join(deploymentsDir, 'sepolia.json');
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));
  console.log(`\n[deploy] ✓ Deployment configuration saved to: demo/deployments/sepolia.json`);
}

main().catch((err) => {
  console.error('[deploy] Deployment failed:', err);
  process.exit(1);
});

