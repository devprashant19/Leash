#!/usr/bin/env tsx
import * as readline from 'readline';
import {
  predictVerdict,
  GOLDEN_FINGERPRINT,
  MAX_PER_TX_WEI,
  MAX_PER_WINDOW_WEI,
  TOKEN_MAX_PER_TX,
  TOKEN_MAX_PER_WINDOW,
  ADDR_TOKEN,
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

// In-memory planning state: the agent's ledger in the layout `leash check --state` reads (36 words,
// ingots/policy/src/encoding.fe). Bookkeeping only, as ledger.fe records an allowed call: ETH in hourly
// packed buckets, token transfers in the token rule's 24 h period. Every verdict still comes from the policy.
const BUCKETS = 24;
const BUCKET_LEN = 3600n;
const TOKEN_PERIOD = 86400n;
const SEL_TRANSFER = 'a9059cbb';
const SEL_TRANSFER_FROM = '23b872dd';
const SEL_APPROVE = '095ea7b3';

class SimulationSession {
  private buckets: Array<[bigint, bigint]> = [];
  private tokenPeriod: [bigint, bigint] = [0n, 0n];

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.buckets = Array.from({ length: BUCKETS }, () => [0n, 0n] as [bigint, bigint]);
    this.tokenPeriod = [0n, 0n];
  }

  /** Tokens a transfer, transferFrom or approval on the demo token books (what decide_spend reports):
   *  an approval counts like a transfer, because the spender can pull it at any time. */
  private tokenAmount(to: string | undefined, data: string | undefined): bigint {
    if (!to || to.toLowerCase() !== ADDR_TOKEN) return 0n;
    const d = (data || '0x').replace(/^0x/, '').toLowerCase();
    if (d.startsWith(SEL_TRANSFER) && d.length === 136) return BigInt('0x' + d.slice(72, 136));
    if (d.startsWith(SEL_APPROVE) && d.length === 136) return BigInt('0x' + d.slice(72, 136));
    if (d.startsWith(SEL_TRANSFER_FROM) && d.length === 200) return BigInt('0x' + d.slice(136, 200));
    return 0n;
  }

  public record(valWei: bigint, nowSec: number, to?: string, data?: string) {
    const now = BigInt(nowSec);
    if (valWei > 0n) {
      const index = now / BUCKET_LEN;
      const slot = Number(index % BigInt(BUCKETS));
      const [bIndex, bAmount] = this.buckets[slot];
      this.buckets[slot] = bIndex === index ? [index, bAmount + valWei] : [index, valWei];
    }
    const tokens = this.tokenAmount(to, data);
    if (tokens > 0n) {
      const period = now / TOKEN_PERIOD;
      this.tokenPeriod = this.tokenPeriod[0] === period ? [period, this.tokenPeriod[1] + tokens] : [period, tokens];
    }
    const spent = this.spentInWindow(nowSec);
    const moved = this.tokenPeriod[0] === now / TOKEN_PERIOD ? this.tokenPeriod[1] : 0n;
    return {
      spent_in_window_wei: spent.toString(),
      remaining_window_wei: (MAX_PER_WINDOW_WEI > spent ? MAX_PER_WINDOW_WEI - spent : 0n).toString(),
      tokens_in_period: moved.toString(),
      remaining_tokens_in_period: (TOKEN_MAX_PER_WINDOW > moved ? TOKEN_MAX_PER_WINDOW - moved : 0n).toString(),
    };
  }

  private spentInWindow(nowSec: number): bigint {
    const cur = BigInt(nowSec) / BUCKET_LEN;
    let total = 0n;
    for (const [index, amount] of this.buckets) if (index <= cur && cur - index < BigInt(BUCKETS)) total += amount;
    return total;
  }

  /** paused, tripped, expiry (0 = none), 24 packed ETH buckets, last_action, 4 token periods. */
  public stateHex(): `0x${string}` {
    const mask192 = (1n << 192n) - 1n;
    const words: bigint[] = [0n, 0n, 0n];
    for (const [index, amount] of this.buckets) {
      const satAmount = amount > mask192 ? mask192 : amount;
      words.push((index << 192n) | satAmount);
    }
    words.push(0n, this.tokenPeriod[0], this.tokenPeriod[1], 0n, 0n, 0n, 0n, 0n, 0n);
    return ('0x' + words.map((w) => w.toString(16).padStart(64, '0')).join('')) as `0x${string}`;
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
  { code: 9, name: 'TokenCapExceeded', description: 'ERC-20 transfer exceeds the per-transfer cap (100 tokens)' },
  { code: 10, name: 'UnlimitedApproval', description: 'Unlimited or over-cap token approval blocked' },
  { code: 11, name: 'RecipientNotAllowed', description: 'Destination or spender not on recipient allowlist' },
  { code: 12, name: 'RateLimited', description: 'Too many actions within sliding window' },
  { code: 13, name: 'CooldownActive', description: 'Cooldown period active between transactions' },
  { code: 14, name: 'OutsideTradingHours', description: 'Transaction outside allowed execution hours' },
  { code: 15, name: 'CircuitTripped', description: 'Circuit breaker tripped after 3 refusals since the Safe last reset it' },
  { code: 16, name: 'SwapNotAllowed', description: 'Swaps are refused: the recipient lies outside the decoded calldata' },
  { code: 17, name: 'LendingNotAllowed', description: 'Unauthorized Aave pool action or collateral diversion' },
  { code: 18, name: 'PriceUnavailable', description: 'Chainlink oracle price feed stale (> 1h) or zero' },
  { code: 19, name: 'UsdCapExceeded', description: 'Spend exceeds USD-denominated transaction cap' },
  { code: 20, name: 'EscalationRequired', description: 'Value above the escalation threshold (decide_with_escalation)' },
  { code: 21, name: 'TokenWindowCapExceeded', description: 'ERC-20 transfers exceed the 24 h period cap (500 tokens)' },
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
            max_per_window_tokens: '500',
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

      // The verdict comes from the policy (the Fe binary when present), given the planned ledger.
      const checkRes = predictVerdict({
        to: params.to,
        valueWei: valWei,
        data: params.data || '0x',
        op: params.op || 'call',
        now: params.now ? Number(params.now) : Math.floor(Date.now() / 1000),
        stateHex: session.stateHex(),
      });

      return { id, result: checkRes };
    }

    case 'record': {
      const params = req.params || {};
      const valWei = params.value_wei ? BigInt(params.value_wei) : 0n;
      const now = params.now ? Number(params.now) : Math.floor(Date.now() / 1000);
      const rec = session.record(valWei, now, params.to, params.data);
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

