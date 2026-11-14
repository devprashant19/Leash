import { LeashClient } from '../client.js';
import type { LeashTransactionProposal } from '../types.js';

export interface LangChainToolContext {
  client?: LeashClient;
}

/**
 * Creates a schema-compliant LangChain tool definition for Leash pre-flight verification.
 */
export function createLeashLangChainTool(client: LeashClient = new LeashClient()) {
  return {
    name: 'leash_validate_transaction',
    description: 'Validates a proposed Ethereum transaction against the autonomous Safe spending policy rules before execution.',
    schema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: '20-byte Ethereum destination address (0x...)' },
        valueWei: { type: 'string', description: 'Value in wei as a string' },
        data: { type: 'string', description: 'Hex calldata starting with 0x (or 0x if empty)' },
        operation: { type: 'string', enum: ['call', 'delegatecall'], description: 'Call type' },
      },
      required: ['to'],
    },
    func: async (args: LeashTransactionProposal) => {
      const evaluation = await client.evaluate(args);
      return JSON.stringify({
        allowed: evaluation.allowed,
        verdict: evaluation.verdict,
        code: evaluation.code,
        reason: evaluation.reason,
        message: evaluation.message,
        remainingBudget: evaluation.remaining,
      });
    },
  };
}
