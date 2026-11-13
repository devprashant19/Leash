import { Chain } from 'viem';
import { sepolia, baseSepolia, arbitrumSepolia, optimismSepolia } from 'viem/chains';

export interface ChainConfig {
  chain: Chain;
  name: string;
  defaultRpc: string;
  blockExplorer: string;
}

export const SUPPORTED_CHAINS: Record<string, ChainConfig> = {
  sepolia: {
    chain: sepolia,
    name: 'Ethereum Sepolia',
    defaultRpc: 'https://ethereum-sepolia-rpc.publicnode.com',
    blockExplorer: 'https://sepolia.etherscan.io',
  },
  'base-sepolia': {
    chain: baseSepolia,
    name: 'Base Sepolia',
    defaultRpc: 'https://sepolia.base.org',
    blockExplorer: 'https://sepolia.basescan.org',
  },
  'arbitrum-sepolia': {
    chain: arbitrumSepolia,
    name: 'Arbitrum Sepolia',
    defaultRpc: 'https://sepolia-rollup.arbitrum.io/rpc',
    blockExplorer: 'https://sepolia.arbiscan.io',
  },
  'optimism-sepolia': {
    chain: optimismSepolia,
    name: 'Optimism Sepolia',
    defaultRpc: 'https://sepolia.optimism.io',
    blockExplorer: 'https://sepolia-optimism.etherscan.io',
  },
};

export function getChainConfig(network = 'sepolia'): ChainConfig {
  const cfg = SUPPORTED_CHAINS[network.toLowerCase()];
  if (!cfg) {
    throw new Error(
      `Unsupported network "${network}". Supported: ${Object.keys(SUPPORTED_CHAINS).join(', ')}`
    );
  }
  return cfg;
}

