import type { Hex, Address } from 'viem';

export type PolicyVerdict = 'ALLOW' | 'DENY';

export interface LeashTransactionProposal {
  to: Address;
  valueWei?: bigint | string;
  data?: Hex;
  operation?: 'call' | 'delegatecall';
  now?: number;
  metadata?: {
    intent?: string;
    agentId?: string;
    sessionId?: string;
  };
}

export interface RemainingBudget {
  ethPerTxWei: string;
  ethWindowWei: string;
  actionsInWindow: number;
  tokens: Array<{
    token: string;
    perTx: string;
    window: string;
  }>;
}

export interface LeashEvaluationResult {
  verdict: PolicyVerdict;
  code: number;
  reason: string;
  message: string;
  remaining: RemainingBudget;
  windowResetsAt: number;
  fingerprint: string;
  allowed: boolean;
}

export interface LeashClientConfig {
  endpoint?: string;
  cliBinaryPath?: string;
  mode?: 'auto' | 'cli' | 'remote' | 'embedded';
  policyFingerprint?: string;
  safeAddress?: Address;
  moduleAddress?: Address;
}
