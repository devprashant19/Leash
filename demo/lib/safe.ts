import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  encodeFunctionData,
  decodeEventLog,
  type Address,
  type Hex,
  type Hash
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getLeashModuleArtifact, getMockSafeArtifact, getMockErc20Artifact } from './artifacts';

export interface DeployedEnvironment {
  safe: Address;
  module: Address;
  token: Address;
  owner: Address;
  agent: Address;
  guardian: Address;
}

export async function setupLocalEnvironment(
  rpcUrl: string = 'http://127.0.0.1:8545',
  ownerPk: Hex = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', // Anvil account #0
  agentPk: Hex = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', // Anvil account #1
  guardianAddress: Address = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' // Anvil account #2
): Promise<DeployedEnvironment> {
  const ownerAccount = privateKeyToAccount(ownerPk);
  const agentAccount = privateKeyToAccount(agentPk);

  const publicClient = createPublicClient({
    transport: http(rpcUrl)
  });

  const walletClient = createWalletClient({
    account: ownerAccount,
    transport: http(rpcUrl)
  });

  const agentWallet = createWalletClient({
    account: agentAccount,
    transport: http(rpcUrl)
  });

  // 1. Deploy MockSafe
  const safeArtifact = getMockSafeArtifact();
  const safeDeployHash = await walletClient.deployContract({
    abi: safeArtifact.abi,
    bytecode: safeArtifact.bytecode,
    args: []
  });
  const safeReceipt = await publicClient.waitForTransactionReceipt({ hash: safeDeployHash });
  const safeAddress = safeReceipt.contractAddress!;

  // 2. Deploy LeashModule with (safeAddress, guardianAddress)
  const moduleArtifact = getLeashModuleArtifact();
  const moduleDeployHash = await walletClient.deployContract({
    abi: moduleArtifact.abi,
    bytecode: moduleArtifact.bytecode,
    args: [safeAddress, guardianAddress]
  });
  const moduleReceipt = await publicClient.waitForTransactionReceipt({ hash: moduleDeployHash });
  const moduleAddress = moduleReceipt.contractAddress!;

  // 3. Deploy MockErc20 demo token
  const tokenArtifact = getMockErc20Artifact();
  const tokenDeployHash = await walletClient.deployContract({
    abi: tokenArtifact.abi,
    bytecode: tokenArtifact.bytecode,
    args: []
  });
  const tokenReceipt = await publicClient.waitForTransactionReceipt({ hash: tokenDeployHash });
  const tokenAddress = tokenReceipt.contractAddress!;

  // 4. Safe enables LeashModule
  const enableHash = await walletClient.writeContract({
    address: safeAddress,
    abi: safeArtifact.abi,
    functionName: 'enableModule',
    args: [moduleAddress]
  });
  await publicClient.waitForTransactionReceipt({ hash: enableHash });

  // 5. Safe registers Agent on LeashModule (expiry in 1 year = now + 31536000)
  const oneYearFromNow = BigInt(Math.floor(Date.now() / 1000) + 31536000);
  const setAgentHash = await walletClient.writeContract({
    address: safeAddress,
    abi: safeArtifact.abi,
    functionName: 'setAgentOn',
    args: [moduleAddress, agentAccount.address, oneYearFromNow, 1n]
  });
  await publicClient.waitForTransactionReceipt({ hash: setAgentHash });

  // 6. Fund Safe on Anvil
  try {
    await publicClient.request({
      method: 'anvil_setBalance' as any,
      params: [safeAddress, '0x8ac7230489e80000'] as any
    });
  } catch {
    // Ignore if not Anvil
  }

  // 7. Mint 1,000 demo tokens to Safe
  const mintHash = await walletClient.writeContract({
    address: tokenAddress,
    abi: tokenArtifact.abi,
    functionName: 'mint',
    args: [safeAddress, 1000n * 10n ** 18n]
  });
  await publicClient.waitForTransactionReceipt({ hash: mintHash });

  return {
    safe: safeAddress,
    module: moduleAddress,
    token: tokenAddress,
    owner: ownerAccount.address,
    agent: agentAccount.address,
    guardian: guardianAddress
  };
}
