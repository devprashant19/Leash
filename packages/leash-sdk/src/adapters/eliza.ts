import { LeashClient } from '../client.js';
import type { LeashTransactionProposal } from '../types.js';

export interface ElizaAction {
  name: string;
  similes: string[];
  description: string;
  validate: (runtime: unknown, message: unknown) => Promise<boolean>;
  handler: (runtime: unknown, message: unknown, state: unknown, options: unknown, callback?: (resp: unknown) => void) => Promise<boolean>;
}

/**
 * Creates an Eliza action provider that guards financial transactions through Leash.
 */
export function createLeashElizaAction(client: LeashClient = new LeashClient()): ElizaAction {
  return {
    name: 'CHECK_TRANSACTION_LIMITS',
    similes: ['VERIFY_LEASH_POLICY', 'CHECK_SPENDING_CAPS', 'EVALUATE_SAFE_TX'],
    description: 'Checks whether an autonomous agent transaction violates spending caps, unlisted targets, or forbidden operations.',
    validate: async () => true,
    handler: async (_runtime, _message, _state, options: { proposal?: LeashTransactionProposal }, callback) => {
      if (!options?.proposal) {
        callback?.({ text: 'Error: No transaction proposal provided.' });
        return false;
      }
      const evalResult = await client.evaluate(options.proposal);
      callback?.({
        text: `Leash Verdict: ${evalResult.verdict} (${evalResult.reason}). ${evalResult.message}`,
        data: evalResult,
      });
      return evalResult.allowed;
    },
  };
}
