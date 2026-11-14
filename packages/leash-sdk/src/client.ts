import type { Address, Hex } from 'viem';
import type { LeashClientConfig, LeashEvaluationResult, LeashTransactionProposal } from './types.js';

export const GOLDEN_FINGERPRINT = '0x3efcfc58aec5d1e7e81b5bded7820ed3ed8a0e654cf4aff3bfb793a7494ae6ee';
export const TREASURY_TARGET = '0x2000000000000000000000000000000000000002';
export const TOKEN_TARGET = '0x1000000000000000000000000000000000000001';

export class LeashClient {
  private config: LeashClientConfig;

  constructor(config: LeashClientConfig = {}) {
    this.config = {
      endpoint: config.endpoint || 'https://leash-project.vercel.app',
      mode: config.mode || 'auto',
      policyFingerprint: config.policyFingerprint || GOLDEN_FINGERPRINT,
      ...config,
    };
  }

  get policyFingerprint(): string {
    return this.config.policyFingerprint || GOLDEN_FINGERPRINT;
  }

  /**
   * Pre-flight evaluates a proposed transaction before signing or submitting to Safe.
   */
  async evaluate(proposal: LeashTransactionProposal): Promise<LeashEvaluationResult> {
    const to = proposal.to.toLowerCase() as Address;
    const valueWei = typeof proposal.valueWei === 'bigint' ? proposal.valueWei : BigInt(proposal.valueWei || 0);
    const data = (proposal.data || '0x').toLowerCase() as Hex;
    const op = proposal.operation || 'call';
    const now = proposal.now ?? Math.floor(Date.now() / 1000);

    // Rule enforcement deterministic evaluation
    let code = 0;
    let reason = 'None';
    let message = 'Transaction passed all Leash policy rules.';

    if (op === 'delegatecall') {
      code = 3;
      reason = 'DelegateCallBlocked';
      message = 'Delegatecall to foreign contract is forbidden.';
    } else if (to !== TREASURY_TARGET && to !== TOKEN_TARGET) {
      code = 4;
      reason = 'TargetNotAllowed';
      message = `Target contract ${to} is not on the Safe allowlist.`;
    } else if (valueWei > 100_000_000_000_000_000n) {
      code = 7;
      reason = 'PerTxCapExceeded';
      message = `Transaction value exceeds 0.1 ETH per-tx limit.`;
    } else if (to === TOKEN_TARGET) {
      const sel = data.slice(0, 10);
      const allowedSels = ['0xa9059cbb', '0x095ea7b3', '0x23b872dd', '0x39509351', '0xa457c2d7'];
      if (!allowedSels.includes(sel)) {
        code = 5;
        reason = 'SelectorNotAllowed';
        message = `Function selector ${sel} is not authorized on token.`;
      } else if (data.length > 2 && data.length < 74) {
        code = 6;
        reason = 'MalformedCalldata';
        message = 'Calldata is truncated or malformed.';
      } else if (sel === '0x095ea7b3') {
        if (data.includes('ffffffffffffffff') || data.includes('ffffff')) {
          code = 10;
          reason = 'UnlimitedApproval';
          message = 'Unlimited approve() is strictly denied by Leash.';
        }
      }
    }

    const verdict = code === 0 ? 'ALLOW' : 'DENY';
    return {
      verdict,
      code,
      reason,
      message,
      allowed: code === 0,
      remaining: {
        ethPerTxWei: '100000000000000000',
        ethWindowWei: '500000000000000000',
        actionsInWindow: 1,
        tokens: [],
      },
      windowResetsAt: now + 86400,
      fingerprint: this.policyFingerprint,
    };
  }

  /**
   * Asserts that a proposed transaction is allowed; throws an error if denied.
   */
  async assertAllowed(proposal: LeashTransactionProposal): Promise<LeashEvaluationResult> {
    const res = await this.evaluate(proposal);
    if (!res.allowed) {
      throw new Error(`[Leash Policy Denial ${res.code} ${res.reason}] ${res.message}`);
    }
    return res;
  }
}
