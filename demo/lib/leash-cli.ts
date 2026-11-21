import { spawnSync } from 'child_process';
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
  expectedFingerprint?: string;
}

export const GOLDEN_FINGERPRINT = '0x3efcfc58aec5d1e7e81b5bded7820ed3ed8a0e654cf4aff3bfb793a7494ae6ee';
export const ADDR_TOKEN = '0x1000000000000000000000000000000000000001'.toLowerCase();
export const ADDR_TREASURY = '0x2000000000000000000000000000000000000002'.toLowerCase();

export const SEL_APPROVE = '0x095ea7b3';
export const SEL_TRANSFER = '0xa9059cbb';
export const SEL_TRANSFER_FROM = '0x23b872dd';

export const MAX_PER_TX_WEI = 100_000_000_000_000_000n; // 0.1 ETH
export const MAX_PER_WINDOW_WEI = 500_000_000_000_000_000n; // 0.5 ETH
export const TOKEN_MAX_PER_TX = 100_000_000_000_000_000_000n; // 100 tokens
export const TOKEN_MAX_PER_WINDOW = 500_000_000_000_000_000_000n; // 500 tokens per 24 h period
export const TOKEN_MAX_APPROVE = 100_000_000_000_000_000_000n; // 100 tokens

/**
 * Where a prediction came from.
 * - 'fe-native': the real `leash` binary built from ingots/cli with `fe build --backend native`.
 * - 'ts-mirror': the TypeScript copy of the rules below. Used only when no native binary
 *   exists (Fe cannot link native binaries on Windows). It proves nothing about the Fe code.
 */
export type PredictionSource = 'fe-native' | 'ts-mirror';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** The native `leash` binary: $LEASH_BIN, else out/cli (fe build output), else bin/leash. */
export function findLeashBinary(): string | null {
  const exe = process.platform === 'win32' ? '.exe' : '';
  const candidates = [
    process.env.LEASH_BIN,
    path.join(REPO_ROOT, 'out', `cli${exe}`),
    path.join(REPO_ROOT, 'bin', `leash${exe}`),
  ].filter((p): p is string => !!p);
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

/**
 * The TypeScript fallback is forbidden in CI (LEASH_REQUIRE_NATIVE=1) and on Vercel: there every
 * prediction must come from the Fe binary, and a missing binary is an error, not a quiet fallback.
 */
function requireNative(): boolean {
  return process.env.LEASH_REQUIRE_NATIVE === '1' || !!process.env.VERCEL;
}

export function predictionSource(): PredictionSource {
  if (findLeashBinary()) return 'fe-native';
  if (requireNative()) {
    throw new Error(
      'LEASH_REQUIRE_NATIVE=1 but no native leash binary was found. ' +
        'Run `fe build --backend native` (x86-64 Linux or AArch64 macOS) or set LEASH_BIN.'
    );
  }
  return 'ts-mirror';
}

function runLeash(binary: string, args: string[]): string {
  const res = spawnSync(binary, args, { encoding: 'utf8' });
  if (res.error) throw new Error(`could not run ${binary}: ${res.error.message}`);
  // Exit 0 = ALLOW, 2 = DENY: both are answers. Anything else is a failure.
  if (res.status !== 0 && res.status !== 2) {
    throw new Error(`leash ${args[0]} exited with ${res.status}: ${(res.stderr || '').trim()}`);
  }
  return res.stdout;
}

/** The policy fingerprint as the CLI computes it (or the pinned vector when only the TS mirror is available). */
export function cliFingerprint(): string {
  const binary = predictionSource() === 'fe-native' ? findLeashBinary() : null;
  if (!binary) return GOLDEN_FINGERPRINT;
  return runLeash(binary, ['fingerprint']).trim();
}

export function predictVerdict(opts: CheckOptions): LeashCheckResult {
  const binary = predictionSource() === 'fe-native' ? findLeashBinary() : null;

  if (binary) {
    const now = opts.now !== undefined ? opts.now : Math.floor(Date.now() / 1000);
    const args = ['check', '--to', opts.to, '--value-wei', (opts.valueWei || 0n).toString(), '--now', now.toString(), '--json'];
    if (opts.data && opts.data !== '0x') args.push('--data', opts.data);
    if (opts.op) args.push('--op', opts.op);
    if (opts.stateHex) args.push('--state', opts.stateHex);
    if (opts.expectedFingerprint) args.push('--expected-fingerprint', opts.expectedFingerprint);
    // No silent fallback: if the real binary misbehaves, the demo must fail loudly.
    return JSON.parse(runLeash(binary, args));
  }

  // TypeScript mirror of the default policy (fallback only; see PredictionSource), in decide()'s order
  // (ingots/policy/src/rules.fe decide_spend). The deployed policy lists two targets: the treasury
  // (plain ETH only) and the token (approve, transferFrom, transfer).
  if (opts.expectedFingerprint && opts.expectedFingerprint.toLowerCase() !== GOLDEN_FINGERPRINT.toLowerCase()) {
    return {
      verdict: 'DENY',
      code: 22,
      reason: 'FingerprintMismatch',
      message: 'Policy fingerprint mismatch',
      remaining: {
        eth_per_tx_wei: MAX_PER_TX_WEI.toString(),
        eth_window_wei: MAX_PER_WINDOW_WEI.toString(),
        actions_in_window: 0,
        tokens: [{
          token: ADDR_TOKEN,
          per_tx: TOKEN_MAX_PER_TX.toString(),
          window: TOKEN_MAX_PER_WINDOW.toString(),
        }],
      },
      window_resets_at: (opts.now ?? Math.floor(Date.now() / 1000)) + 86400,
      fingerprint: GOLDEN_FINGERPRINT,
    };
  }
  const to = opts.to.toLowerCase();
  const value = opts.valueWei || 0n;
  const data = (opts.data || '0x').replace(/^0x/, '').toLowerCase();
  const op = opts.op || 'call';
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const byteLen = data.length / 2;
  const word = (offset: number) => data.slice(offset * 2, offset * 2 + 64);
  const isAddressWord = (offset: number) => /^0{24}$/.test(data.slice(offset * 2, offset * 2 + 24));

  const st = opts.stateHex ? decodeStateHex(opts.stateHex) : null;
  const spent = st ? spentInWindow(st.buckets, now) : 0n;
  const deny = (code: number, reason: string, message: string) => makeResult('DENY', code, reason, message, now, spent);

  // 1-3. Paused, CircuitTripped, SessionExpired (4. cooldown is off in the default policy)
  if (st?.paused) return deny(1, 'Paused', 'Agent is paused by the guardian or owner');
  if (st?.tripped) return deny(15, 'CircuitTripped', 'Circuit breaker tripped after repeated denials');
  if (st && st.expiry > 0n && BigInt(now) >= st.expiry) return deny(2, 'SessionExpired', 'Agent session has expired');

  // 5. DelegateCallBlocked
  if (op === 'delegatecall') return deny(3, 'DelegateCallBlocked', 'DelegateCall is permanently blocked');

  // 6. TargetNotAllowed
  const isTreasury = to === ADDR_TREASURY;
  const isToken = to === ADDR_TOKEN;
  if (!isTreasury && !isToken) return deny(4, 'TargetNotAllowed', 'Target contract is not allowlisted');

  // 7. Selector / calldata (8. rate limiting is off in the default policy)
  const sel = byteLen >= 4 ? '0x' + data.slice(0, 8) : '';
  if (byteLen === 0) {
    if (isToken) return deny(5, 'SelectorNotAllowed', 'Token contract allows no plain ETH transfer');
  } else if (byteLen < 4) {
    return deny(6, 'MalformedCalldata', 'Calldata shorter than a 4-byte selector');
  } else if (isTreasury || ![SEL_APPROVE, SEL_TRANSFER_FROM, SEL_TRANSFER].includes(sel)) {
    return deny(5, 'SelectorNotAllowed', 'Function selector is not allowlisted');
  }

  // 9-10. ETH caps
  if (value > MAX_PER_TX_WEI) return deny(7, 'PerTxCapExceeded', 'ETH value exceeds per-transaction cap');
  if (spent + value > MAX_PER_WINDOW_WEI) return deny(8, 'WindowCapExceeded', 'ETH spend exceeds 24h window limit');

  // 11. ERC-20 guard: decode, then the approval cap (10), or the per-transfer cap (9) and the 24 h
  //     period cap (21). The default policy has no recipient allowlist, so every recipient passes (11).
  if (isToken) {
    let amount: bigint;
    if (sel === SEL_TRANSFER_FROM) {
      if (byteLen !== 100 || !isAddressWord(4) || !isAddressWord(36)) return deny(6, 'MalformedCalldata', 'Invalid transferFrom calldata');
      amount = BigInt('0x' + word(68));
    } else {
      if (byteLen !== 68 || !isAddressWord(4)) return deny(6, 'MalformedCalldata', `Invalid ${sel === SEL_APPROVE ? 'approve' : 'transfer'} calldata`);
      amount = BigInt('0x' + word(36));
    }
    if (sel === SEL_APPROVE) {
      if (amount > TOKEN_MAX_APPROVE) return deny(10, 'UnlimitedApproval', 'Approval exceeds max approval limit');
      // An approval is booked like a transfer (the spender can pull it at any time); revoking (0) is free.
      const moved = st ? tokenSpentInPeriod(st.tokenSpent, now) : 0n;
      if (amount > 0n && moved + amount > TOKEN_MAX_PER_WINDOW) return deny(21, 'TokenWindowCapExceeded', 'ERC-20 approvals and transfers exceed the 24 h token cap');
    } else {
      if (amount > TOKEN_MAX_PER_TX) return deny(9, 'TokenCapExceeded', 'ERC-20 transfer exceeds per-transaction cap');
      const moved = st ? tokenSpentInPeriod(st.tokenSpent, now) : 0n;
      if (moved + amount > TOKEN_MAX_PER_WINDOW) return deny(21, 'TokenWindowCapExceeded', 'ERC-20 transfers exceed the 24 h token cap');
    }
  }

  return makeResult('ALLOW', 0, 'None', 'Transaction allowed by policy', now, spent);
}

const BUCKETS = 24;
const BUCKET_LEN = 3600n;
const TOKEN_PERIOD = 86400n;
const STATE_WORDS = 36;
const MASK_192 = (1n << 192n) - 1n;

interface DecodedState {
  paused: boolean;
  tripped: boolean;
  expiry: bigint;
  buckets: Array<[bigint, bigint]>;
  /** The default policy's one token rule: [period index, tokens moved in that period]. */
  tokenSpent: [bigint, bigint];
}

/**
 * Decodes `leash check --state` hex (36 words, policy/src/encoding.fe): paused, tripped, expiry,
 * 24 packed ETH buckets ((index << 192) | amount), last_action, then 4 (period, amount) token periods.
 */
function decodeStateHex(hex: string): DecodedState | null {
  const h = hex.replace(/^0x/, '');
  if (h.length !== STATE_WORDS * 64) return null;
  const w = (i: number) => BigInt('0x' + h.slice(i * 64, (i + 1) * 64));
  const buckets: Array<[bigint, bigint]> = [];
  for (let b = 0; b < BUCKETS; b++) {
    const packed = w(3 + b);
    const index = packed >> 192n;
    const amount = packed & MASK_192;
    buckets.push([index, amount]);
  }
  return { paused: w(0) !== 0n, tripped: w(1) !== 0n, expiry: w(2), buckets, tokenSpent: [w(28), w(29)] };
}

/** Same as ledger.fe spent_in_window: sum of buckets from the last 24 hourly slots. */
function spentInWindow(buckets: Array<[bigint, bigint]>, now: number): bigint {
  const cur = BigInt(now) / BUCKET_LEN;
  let total = 0n;
  for (const [index, amount] of buckets) if (index <= cur && cur - index < BigInt(BUCKETS)) total += amount;
  return total;
}

/** Same as ledger.fe token_spent_in_period: tokens moved in the 24 h period that contains `now`. */
function tokenSpentInPeriod([index, amount]: [bigint, bigint], now: number): bigint {
  return index === BigInt(now) / TOKEN_PERIOD ? amount : 0n;
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
          window: TOKEN_MAX_PER_WINDOW.toString()
        }
      ]
    },
    window_resets_at: Math.floor(now / 3600) * 3600 + 86400,
    fingerprint: GOLDEN_FINGERPRINT
  };
}

