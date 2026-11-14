import { encodeFunctionData, type Address, type Hex } from 'viem';
import type { LeashTransactionProposal } from './types.js';

export const LEASH_MODULE_ABI = [
  {
    type: 'function',
    name: 'tryExecute',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
      { name: 'operation', type: 'uint8' },
    ],
    outputs: [
      { name: 'ok', type: 'bool' },
      { name: 'code', type: 'uint8' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'fingerprint',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

export class SafeLeashPackager {
  /**
   * Formats an agent transaction into a LeashModule.tryExecute call.
   */
  static formatTryExecute(proposal: LeashTransactionProposal): { data: Hex; value: bigint } {
    const value = typeof proposal.valueWei === 'bigint' ? proposal.valueWei : BigInt(proposal.valueWei || 0);
    const op = proposal.operation === 'delegatecall' ? 1 : 0;
    const data = proposal.data || '0x';

    const calldata = encodeFunctionData({
      abi: LEASH_MODULE_ABI,
      functionName: 'tryExecute',
      args: [proposal.to, value, data, op],
    });

    return {
      data: calldata,
      value: 0n,
    };
  }
}
