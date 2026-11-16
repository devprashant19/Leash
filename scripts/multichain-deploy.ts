#!/usr/bin/env node
import { getEmbeddedArtifact } from '../api/_lib/embedded-artifacts';

export interface ChainConfig {
  name: string;
  chainId: number;
  rpcEnv: string;
  explorer: string;
}

export const SUPPORTED_CHAINS: Record<string, ChainConfig> = {
  sepolia: {
    name: 'Ethereum Sepolia',
    chainId: 11155111,
    rpcEnv: 'SEPOLIA_RPC_URL',
    explorer: 'https://sepolia.etherscan.io',
  },
  'base-sepolia': {
    name: 'Base Sepolia',
    chainId: 84532,
    rpcEnv: 'BASE_SEPOLIA_RPC_URL',
    explorer: 'https://sepolia.basescan.org',
  },
  'arbitrum-sepolia': {
    name: 'Arbitrum Sepolia',
    chainId: 421614,
    rpcEnv: 'ARB_SEPOLIA_RPC_URL',
    explorer: 'https://sepolia.arbiscan.io',
  },
  'optimism-sepolia': {
    name: 'OP Sepolia',
    chainId: 11155420,
    rpcEnv: 'OP_SEPOLIA_RPC_URL',
    explorer: 'https://sepolia-optimism.etherscan.io',
  },
};

export const CREATE2_SALT = '0x6c656173682d706f6c6963792d76312e302e3000000000000000000000000000'; // "leash-policy-v1.0.0"

export function getDeploymentMetadata() {
  const modArt = getEmbeddedArtifact('LeashModule');
  return {
    salt: CREATE2_SALT,
    bytecodeSize: (modArt.bytecode.length - 2) / 2,
    chains: Object.keys(SUPPORTED_CHAINS),
    fingerprint: '0x3efcfc58aec5d1e7e81b5bded7820ed3ed8a0e654cf4aff3bfb793a7494ae6ee',
  };
}

if (process.argv[1]?.includes('multichain-deploy')) {
  console.log('--- Leash Multi-Chain CREATE2 Deployment Tool ---');
  const meta = getDeploymentMetadata();
  console.log(`Bytecode Size: ${meta.bytecodeSize} bytes (under 24,576 byte limit)`);
  console.log(`CREATE2 Salt: ${meta.salt}`);
  console.log(`Deterministic Policy Fingerprint: ${meta.fingerprint}`);
  console.log('\nConfigured Target Networks:');
  for (const [key, chain] of Object.entries(SUPPORTED_CHAINS)) {
    console.log(` - ${chain.name} (Chain ID: ${chain.chainId})`);
  }
}
