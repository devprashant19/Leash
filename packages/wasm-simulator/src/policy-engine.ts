export const LEASH_POLICY_FINGERPRINT = '0x3efcfc58aec5d1e7e81b5bded7820ed3ed8a0e654cf4aff3bfb793a7494ae6ee';

export interface EvaluatorTxInput {
  to: string;
  valueWei: string | bigint;
  data: string;
  operation?: 'call' | 'delegatecall';
}

export interface EvaluatorTxOutput {
  verdict: 'ALLOW' | 'DENY';
  code: number;
  reason: string;
  message: string;
  allowed: boolean;
  fingerprint: string;
}

export class LeashWasmSimulator {
  static evaluate(tx: EvaluatorTxInput): EvaluatorTxOutput {
    const to = (tx.to || '').toLowerCase().trim();
    const val = typeof tx.valueWei === 'bigint' ? tx.valueWei : BigInt(tx.valueWei || 0);
    const data = (tx.data || '0x').toLowerCase().trim();
    const op = tx.operation || 'call';

    let code = 0;
    let reason = 'None';
    let message = 'All policy invariants satisfied.';

    if (op === 'delegatecall') {
      code = 3;
      reason = 'DelegateCallBlocked';
      message = 'Delegatecall to untrusted contract is forbidden.';
    } else if (to !== '0x2000000000000000000000000000000000000002' && to !== '0x1000000000000000000000000000000000000001') {
      code = 4;
      reason = 'TargetNotAllowed';
      message = 'Target contract is not allowlisted.';
    } else if (val > 100_000_000_000_000_000n) {
      code = 7;
      reason = 'PerTxCapExceeded';
      message = 'Value exceeds 0.1 ETH per-transaction cap.';
    } else if (to === '0x1000000000000000000000000000000000000001') {
      const sel = data.slice(0, 10);
      if (sel === '0x095ea7b3' && (data.includes('ffffffff') || data.includes('ffffff'))) {
        code = 10;
        reason = 'UnlimitedApproval';
        message = 'Unlimited approve() is strictly denied.';
      }
    }

    return {
      verdict: code === 0 ? 'ALLOW' : 'DENY',
      code,
      reason,
      message,
      allowed: code === 0,
      fingerprint: LEASH_POLICY_FINGERPRINT,
    };
  }
}
