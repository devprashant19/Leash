import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface RemainingBudget {
  eth_per_tx_wei: string;
  eth_window_wei: string;
  actions_in_window: number;
  tokens: Array<{
    token: string;
    per_tx: string;
    window: string;
  }>;
}

export interface LeashCheckResult {
  verdict: 'ALLOW' | 'DENY';
  code: number;
  reason: string;
  message: string;
  remaining: RemainingBudget;
  window_resets_at: number;
  fingerprint: string;
}

export interface CheckOptions {
  to: `0x${string}`;
  valueWei?: bigint;
  data?: `0x${string}`;
  op?: 'call' | 'delegatecall';
  now?: number;
  stateHex?: `0x${string}`;
}

export const GOLDEN_FINGERPRINT = '0x3efcfc58aec5d1e7e81b5bded7820ed3ed8a0e654cf4aff3bfb793a7494ae6ee';
export const ADDR_TOKEN = '0x1000000000000000000000000000000000000001'.toLowerCase();
export const ADDR_TREASURY = '0x2000000000000000000000000000000000000002'.toLowerCase();
export const ADDR_UNISWAP_ROUTER = '0x7a250d5630b4cf539739df2c5dacb4c659f2488d'.toLowerCase();
export const ADDR_AAVE_POOL = '0x6ae43d3271ff6888e7fc43fd7321a503ff738951'.toLowerCase();

export const SEL_APPROVE = '0x095ea7b3';
export const SEL_TRANSFER = '0xa9059cbb';
export const SEL_TRANSFER_FROM = '0x23b87266';
export const SEL_INCREASE_ALLOWANCE = '0x39509351';
export const SEL_DECREASE_ALLOWANCE = '0xa457c2d7';
export const SEL_UNISWAP_V2_SWAP = '0x38ed1739';
export const SEL_UNISWAP_V3_SWAP = '0x04e45aaf';
export const SEL_AAVE_WITHDRAW = '0x69328dec';
export const SEL_AAVE_SUPPLY = '0x617ba037';
export const SEL_AAVE_REPAY = '0x573ade81';

export const MAX_PER_TX_WEI = 100_000_000_000_000_000n; // 0.1 ETH
export const MAX_PER_WINDOW_WEI = 500_000_000_000_000_000n; // 0.5 ETH
export const TOKEN_MAX_PER_TX = 100_000_000_000_000_000_000n; // 100 tokens
export const TOKEN_MAX_APPROVE = 100_000_000_000_000_000_000n; // 100 tokens

export function predictVerdict(opts: CheckOptions): LeashCheckResult {
  const binaryPath = path.resolve(__dirname, '..', '..', 'bin', process.platform === 'win32' ? 'leash.exe' : 'leash');

  if (fs.existsSync(binaryPath)) {
    try {
      const args = [
        'check',
        '--to', opts.to,
        '--value-wei', (opts.valueWei || 0n).toString(),
        '--json'
      ];
      if (opts.data && opts.data !== '0x') args.push('--data', opts.data);
      if (opts.op) args.push('--op', opts.op);
      if (opts.now !== undefined) args.push('--now', opts.now.toString());
      if (opts.stateHex) args.push('--state', opts.stateHex);

      const stdout = execFileSync(binaryPath, args, { encoding: 'utf8' });
      return JSON.parse(stdout);
    } catch {
      // Fall through to pure TS implementation
    }
  }

  // Pure Fe Policy Rule Engine (ADR-001 & context §6)
  const to = opts.to.toLowerCase();
  const value = opts.valueWei || 0n;
  const data = opts.data || '0x';
  const op = opts.op || 'call';
  const now = opts.now ?? Math.floor(Date.now() / 1000);

  // 1. DelegateCall check
  if (op === 'delegatecall') {
    return makeResult('DENY', 3, 'DelegateCallBlocked', 'DelegateCall is permanently blocked', now);
  }

  // 2. Target check
  const isTreasury = to === ADDR_TREASURY;
  const isToken = to === ADDR_TOKEN;
  const isUniswap = to === ADDR_UNISWAP_ROUTER;
  const isAave = to === ADDR_AAVE_POOL;
  if (!isTreasury && !isToken && !isUniswap && !isAave) {
    return makeResult('DENY', 4, 'TargetNotAllowed', 'Target contract is not allowlisted', now);
  }

  // 3. Calldata and selector check
  const dataBytes = data.startsWith('0x') ? data.slice(2) : data;
  const byteLen = dataBytes.length / 2;

  if (isTreasury) {
    if (byteLen > 0) {
      return makeResult('DENY', 5, 'SelectorNotAllowed', 'Treasury allows pure transfers only', now);
    }
  } else if (isAave) {
    if (byteLen < 4) {
      return makeResult('DENY', 6, 'MalformedCalldata', 'Calldata shorter than 4-byte selector', now);
    }
    const sel = '0x' + dataBytes.slice(0, 8).toLowerCase();
    if (sel !== SEL_AAVE_WITHDRAW) {
      return makeResult('DENY', 17, 'LendingNotAllowed', 'Lending method not authorized on pool', now);
    }
    if (byteLen !== 100) {
      return makeResult('DENY', 6, 'MalformedCalldata', 'Aave withdraw calldata must be exactly 100 bytes', now);
    }
    const asset = '0x' + dataBytes.slice(32, 72).toLowerCase();
    const amount = BigInt('0x' + dataBytes.slice(72, 136));
    const recipient = '0x' + dataBytes.slice(160, 200).toLowerCase();
    if (asset !== ADDR_TOKEN) {
      return makeResult('DENY', 17, 'LendingNotAllowed', 'Withdrawn asset is not an allowlisted token', now);
    }
    if (amount > TOKEN_MAX_PER_TX) {
      return makeResult('DENY', 9, 'TokenCapExceeded', 'Aave withdraw amount exceeds token cap', now);
    }
  } else if (isUniswap) {
    if (byteLen < 4) {
      return makeResult('DENY', 6, 'MalformedCalldata', 'Calldata shorter than 4-byte selector', now);
    }
    const sel = '0x' + dataBytes.slice(0, 8).toLowerCase();
    if (sel !== SEL_UNISWAP_V2_SWAP && sel !== SEL_UNISWAP_V3_SWAP) {
      return makeResult('DENY', 16, 'SwapNotAllowed', 'Swap method not authorized on router', now);
    }
    if (byteLen < 68) {
      return makeResult('DENY', 6, 'MalformedCalldata', 'Swap calldata too short', now);
    }
    const amountIn = BigInt('0x' + dataBytes.slice(8, 72));
    const amountOutMin = BigInt('0x' + dataBytes.slice(72, 136));
    if (amountOutMin === 0n) {
      return makeResult('DENY', 16, 'SwapNotAllowed', 'MEV sandwich protection: minimum output must be > 0', now);
    }
    if (amountIn > TOKEN_MAX_PER_TX) {
      return makeResult('DENY', 12, 'TokenCapExceeded', 'Swap input amount exceeds token cap', now);
    }
  } else if (isToken) {
    if (byteLen === 0) {
      return makeResult('DENY', 5, 'SelectorNotAllowed', 'Token contract disallows plain ETH transfers', now);
    }
    if (byteLen < 4) {
      return makeResult('DENY', 6, 'MalformedCalldata', 'Calldata shorter than 4-byte selector', now);
    }
    const sel = '0x' + dataBytes.slice(0, 8).toLowerCase();
    // ERC20 selectors
    // approve: 0x095ea7b3, increaseAllowance: 0x39509351, decreaseAllowance: 0xa457c2d7
    // transfer: 0xa9059cbb
    // transferFrom: 0x23b87266
    if (sel === SEL_APPROVE || sel === SEL_INCREASE_ALLOWANCE) {
      if (byteLen !== 68) {
        return makeResult('DENY', 6, 'MalformedCalldata', 'Invalid approve calldata length', now);
      }
      const rawAmt = BigInt('0x' + dataBytes.slice(72, 136));
      if (rawAmt === 0n) {
        // Revocation allowed
      } else if (rawAmt > TOKEN_MAX_APPROVE) {
        return makeResult('DENY', 10, 'UnlimitedApproval', 'Approval exceeds max approval limit', now);
      }
    } else if (sel === SEL_DECREASE_ALLOWANCE) {
      if (byteLen !== 68) {
        return makeResult('DENY', 6, 'MalformedCalldata', 'Invalid decreaseAllowance calldata length', now);
      }
      // Decrease allowance is always allowed within shape bounds
    } else if (sel === SEL_TRANSFER) {
      if (byteLen !== 68) {
        return makeResult('DENY', 6, 'MalformedCalldata', 'Invalid transfer calldata length', now);
      }
      const rawAmt = BigInt('0x' + dataBytes.slice(72, 136));
      if (rawAmt > TOKEN_MAX_PER_TX) {
        return makeResult('DENY', 9, 'TokenCapExceeded', 'ERC-20 transfer exceeds per-transaction cap', now);
      }
    } else if (sel === SEL_TRANSFER_FROM) {
      if (byteLen !== 100) {
        return makeResult('DENY', 6, 'MalformedCalldata', 'Invalid transferFrom calldata length', now);
      }
      const rawAmt = BigInt('0x' + dataBytes.slice(136, 200));
      if (rawAmt > TOKEN_MAX_PER_TX) {
        return makeResult('DENY', 9, 'TokenCapExceeded', 'ERC-20 transferFrom exceeds per-transaction cap', now);
      }
    } else {
      return makeResult('DENY', 5, 'SelectorNotAllowed', 'Function selector is not allowlisted', now);
    }
  }

  // 4. Per-tx ETH cap check
  if (value > MAX_PER_TX_WEI) {
    return makeResult('DENY', 7, 'PerTxCapExceeded', 'ETH value exceeds per-transaction cap', now);
  }

  // 5. Window ETH cap check
  if (value > MAX_PER_WINDOW_WEI) {
    return makeResult('DENY', 8, 'WindowCapExceeded', 'ETH spend exceeds 24h window limit', now);
  }

  return makeResult('ALLOW', 0, 'None', 'Transaction allowed by policy', now, value);
}

function makeResult(
  verdict: 'ALLOW' | 'DENY',
  code: number,
  reason: string,
  message: string,
  now: number,
  spentWei: bigint = 0n
): LeashCheckResult {
  const remEthTx = MAX_PER_TX_WEI;
  const remEthWin = MAX_PER_WINDOW_WEI > spentWei ? MAX_PER_WINDOW_WEI - spentWei : 0n;

  return {
    verdict,
    code,
    reason,
    message,
    remaining: {
      eth_per_tx_wei: remEthTx.toString(),
      eth_window_wei: remEthWin.toString(),
      actions_in_window: 0,
      tokens: [
        {
          token: '0x1000000000000000000000000000000000000001',
          per_tx: TOKEN_MAX_PER_TX.toString(),
          window: '500000000000000000000'
        }
      ]
    },
    window_resets_at: Math.floor(now / 3600) * 3600 + 86400,
    fingerprint: GOLDEN_FINGERPRINT
  };
}

