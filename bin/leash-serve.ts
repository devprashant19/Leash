#!/usr/bin/env tsx
import * as readline from 'readline';
import {
  predictVerdict,
  GOLDEN_FINGERPRINT,
  MAX_PER_TX_WEI,
  MAX_PER_WINDOW_WEI,
  TOKEN_MAX_PER_TX,
  LeashCheckResult,
} from '../demo/lib/leash-cli';

interface JsonRpcRequest {
  id?: number | string | null;
  method?: string;
  params?: any;
}

interface JsonRpcResponse {
  id: number | string | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

// In-memory simulation state for agent planning
class SimulationSession {
  private ethWindowSpent: bigint = 0n;
  private actionsInWindow: number = 0;
  private lastActionTimestamp: number = 0;

  public reset(): void {
    this.ethWindowSpent = 0n;
    this.actionsInWindow = 0;
    this.lastActionTimestamp = 0;
  }

  public record(valWei: bigint, nowSec: number): { spent_in_window_wei: string; remaining_window_wei: string } {
    this.ethWindowSpent += valWei;
    this.actionsInWindow += 1;
    this.lastActionTimestamp = nowSec;
    const remaining = MAX_PER_WINDOW_WEI > this.ethWindowSpent ? MAX_PER_WINDOW_WEI - this.ethWindowSpent : 0n;
    return {
      spent_in_window_wei: this.ethWindowSpent.toString(),
      remaining_window_wei: remaining.toString(),
    };
  }

  public getSpent(): bigint {
    return this.ethWindowSpent;
  }
}

const session = new SimulationSession();

const RULES_EXPLANATION = [
  { code: 1, name: 'Paused', description: 'Safe module is paused by guardian or safe' },
  { code: 2, name: 'SessionExpired', description: 'Agent session key expired' },
  { code: 3, name: 'DelegateCallBlocked', description: 'DelegateCall is strictly blocked to prevent storage takeover' },
  { code: 4, name: 'TargetNotAllowed', description: 'Destination address is not allowlisted in policy' },
  { code: 5, name: 'SelectorNotAllowed', description: 'Function selector is not authorized for target' },
  { code: 6, name: 'MalformedCalldata', description: 'Calldata is truncated, has dirty high word, or bad length' },
  { code: 7, name: 'PerTxCapExceeded', description: 'ETH spend exceeds per-transaction cap (0.1 ETH)' },
  { code: 8, name: 'WindowCapExceeded', description: 'ETH spend exceeds rolling 24-hour window cap (0.5 ETH)' },
  { code: 9, name: 'TokenCapExceeded', description: 'ERC-20 spend exceeds token cap (100 tokens)' },
  { code: 10, name: 'UnlimitedApproval', description: 'Unlimited or over-cap token approval blocked' },
  { code: 11, name: 'RecipientNotAllowed', description: 'Destination or spender not on recipient allowlist' },
  { code: 12, name: 'RateLimited', description: 'Too many actions within sliding window' },
  { code: 13, name: 'CooldownActive', description: 'Cooldown period active between transactions' },
  { code: 14, name: 'OutsideTradingHours', description: 'Transaction outside allowed execution hours' },
  { code: 15, name: 'CircuitTripped', description: 'Circuit breaker tripped after 3 consecutive rejections' },
  { code: 16, name: 'SwapNotAllowed', description: 'MEV zero-slippage sandwich protection or router forbidden' },
  { code: 17, name: 'LendingNotAllowed', description: 'Unauthorized Aave pool action or collateral diversion' },
  { code: 18, name: 'PriceUnavailable', description: 'Chainlink oracle price feed stale (> 1h) or zero' },
  { code: 19, name: 'UsdCapExceeded', description: 'Spend exceeds USD-denominated transaction cap' },
  { code: 20, name: 'EscalationRequired', description: 'High-value transaction queued for timelock review' },
];

function handleRequest(req: JsonRpcRequest): JsonRpcResponse {
  const id = req.id !== undefined ? req.id : null;

  if (!req.method) {
    return { id, error: { code: -32600, message: 'Invalid Request: missing method' } };
  }

  switch (req.method) {
    case 'fingerprint':
      return {
        id,
        result: {
          fingerprint: GOLDEN_FINGERPRINT,
          version: '1.0.0',
        },
      };

    case 'explain':
      return {
        id,
        result: {
          rules: RULES_EXPLANATION,
          caps: {
            max_per_tx_eth: '0.1',
            max_per_window_eth: '0.5',
            max_per_tx_tokens: '100',
          },
        },
      };

    case 'check': {
      const params = req.params || {};
      if (!params.to) {
        return { id, error: { code: -32602, message: 'Invalid params: "to" address is required' } };
      }

      let valWei = 0n;
      if (params.value_wei) {
        valWei = BigInt(params.value_wei);
      } else if (params.value_eth) {
        valWei = BigInt(Math.floor(parseFloat(params.value_eth) * 1e18));
      }

      const checkRes = predictVerdict({
        to: params.to,
        valueWei: valWei,
        data: params.data || '0x',
        op: params.op || 'call',
        now: params.now ? Number(params.now) : Math.floor(Date.now() / 1000),
      });

      // Factor in in-memory session spend
      if (checkRes.verdict === 'ALLOW') {
        const spent = session.getSpent();
        if (spent + valWei > MAX_PER_WINDOW_WEI) {
          return {
            id,
            result: {
              ...checkRes,
              verdict: 'DENY',
              code: 8,
              reason: 'WindowCapExceeded',
              message: `Simulated window spend would exceed limit (${(spent + valWei).toString()} > ${MAX_PER_WINDOW_WEI.toString()})`,
            },
          };
        }
      }

      return { id, result: checkRes };
    }

    case 'record': {
      const params = req.params || {};
      const valWei = params.value_wei ? BigInt(params.value_wei) : 0n;
      const now = params.now ? Number(params.now) : Math.floor(Date.now() / 1000);
      const rec = session.record(valWei, now);
      return { id, result: rec };
    }

    case 'reset':
      session.reset();
      return { id, result: { status: 'ok', message: 'Simulation session reset' } };

    default:
      return { id, error: { code: -32601, message: `Method "${req.method}" not found` } };
  }
}

// Start stdio line-by-line listener
export function startServer(): void {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on('line', (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const req = JSON.parse(trimmed);
      const res = handleRequest(req);
      process.stdout.write(JSON.stringify(res) + '\n');
    } catch (err: any) {
      const errRes: JsonRpcResponse = {
        id: null,
        error: {
          code: -32700,
          message: `Parse error: ${err?.message || 'malformed JSON'}`,
        },
      };
      process.stdout.write(JSON.stringify(errRes) + '\n');
    }
  });
}

if (require.main === module) {
  startServer();
}
