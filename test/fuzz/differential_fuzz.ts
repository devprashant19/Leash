/**
 * Leash Differential Fuzzer
 * Generates pseudorandom transaction streams across all boundary conditions
 * and asserts 100% verdict congruence between the off-chain predictor (CLI/TS mirror)
 * and the EVM-deployed Fe LeashModule contract.
 */
import assert from 'node:assert/strict';
import { encodeFunctionData, type Hex } from 'viem';
import { setupEnvironment, runStep, mustSend, REASONS, type Env } from '../../api/_lib/leash';
import type { ScenarioTx } from '../../demo/lib/scenario';
import {
  SEL_APPROVE,
  SEL_TRANSFER,
  SEL_TRANSFER_FROM,
  MAX_PER_TX_WEI,
  ADDR_TOKEN,
  ADDR_TREASURY,
  predictionSource,
  findLeashBinary,
} from '../../demo/lib/leash-cli';

// Deterministic LCG for reproducible fuzz runs
class PRNG {
  private state: number;
  constructor(seed = 0x1337c0de) {
    this.state = seed >>> 0;
  }
  next(): number {
    this.state = (Math.imul(1664525, this.state) + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }
  choice<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  rangeBigInt(min: bigint, max: bigint): bigint {
    const r = BigInt(Math.floor(this.next() * 1000000));
    return min + ((max - min) * r) / 1000000n;
  }
}

const TARGETS: Array<`0x${string}`> = [
  ADDR_TREASURY as `0x${string}`,
  ADDR_TOKEN as `0x${string}`,
  '0x0000000000000000000000000000000000000000',
  '0xdead000000000000000000000000000000000000',
  '0x1234567890123456789012345678901234567890',
];

const SELECTORS = [
  SEL_TRANSFER,
  SEL_APPROVE,
  SEL_TRANSFER_FROM,
  '0x00000000',
  '0x12345678',
  '0xa9059cbb',
];

function pad(hex: string): string {
  return hex.replace(/^0x/, '').padStart(64, '0');
}

const TOKEN = 10n ** 18n;
const ATTACKER = '0xdead000000000000000000000000000000000000';

// A call an agent would plausibly make: an ETH payment to the treasury, or a token transfer,
// approval or transferFrom, with amounts inside, at and just over each cap. Repeated over a run they
// fill the 24 h ETH window and the token's daily cap, which approvals now count towards.
function generatePlausibleTx(rng: PRNG, i: number): ScenarioTx {
  const base = { i, operation: 0 as const, expectedVerdict: 'ALLOW' as const, expectedCode: 0 };
  if (rng.next() < 0.4) {
    const value = rng.choice([
      rng.rangeBigInt(1n, MAX_PER_TX_WEI),
      rng.rangeBigInt(1n, MAX_PER_TX_WEI),
      MAX_PER_TX_WEI,
      MAX_PER_TX_WEI + 1n,
    ]);
    return { ...base, description: `Fuzz tx #${i}: ${value} wei to the treasury`, to: ADDR_TREASURY as `0x${string}`, value, data: '0x' };
  }
  const kind = rng.choice(['transfer', 'approve', 'approve', 'transfer_from']);
  const amount = rng.choice([0n, 1n, 10n * TOKEN, 50n * TOKEN, 100n * TOKEN, 100n * TOKEN + 1n]);
  let data: `0x${string}`;
  if (kind === 'transfer') {
    data = `0x${pad(SEL_TRANSFER).slice(-8)}${pad(ADDR_TREASURY)}${pad(amount.toString(16))}` as `0x${string}`;
  } else if (kind === 'approve') {
    const spender = rng.choice([ADDR_TREASURY, ATTACKER]);
    data = `0x${pad(SEL_APPROVE).slice(-8)}${pad(spender)}${pad(amount.toString(16))}` as `0x${string}`;
  } else {
    data = `0x${pad(SEL_TRANSFER_FROM).slice(-8)}${pad(ADDR_TREASURY)}${pad(ADDR_TREASURY)}${pad(amount.toString(16))}` as `0x${string}`;
  }
  return { ...base, description: `Fuzz tx #${i}: token ${kind} of ${amount}`, to: ADDR_TOKEN as `0x${string}`, value: 0n, data };
}

function generateRandomTx(rng: PRNG, i: number): ScenarioTx {
  if (rng.next() < 0.5) return generatePlausibleTx(rng, i);
  const to = rng.choice(TARGETS);
  const op = rng.next() < 0.08 ? 1 : 0; // 8% chance of delegatecall

  // Edge value selection
  const valType = rng.choice(['zero', 'small', 'exact_cap', 'over_cap_1wei', 'large', 'massive']);
  let value: bigint;
  switch (valType) {
    case 'zero':
      value = 0n;
      break;
    case 'small':
      value = rng.rangeBigInt(1n, 50_000_000_000_000_000n);
      break;
    case 'exact_cap':
      value = MAX_PER_TX_WEI;
      break;
    case 'over_cap_1wei':
      value = MAX_PER_TX_WEI + 1n;
      break;
    case 'large':
      value = rng.rangeBigInt(MAX_PER_TX_WEI, 500_000_000_000_000_000n);
      break;
    case 'massive':
      value = 10n * 10n ** 18n;
      break;
    default:
      value = 0n;
  }

  // Calldata generation
  let data: `0x${string}`;
  const dataType = rng.choice(['empty', 'short', 'erc20_transfer', 'erc20_approve', 'erc20_transfer_from', 'malformed']);
  switch (dataType) {
    case 'empty':
      data = '0x';
      break;
    case 'short':
      data = '0x1234';
      break;
    case 'erc20_transfer': {
      const recipient = rng.choice(TARGETS);
      const amt = rng.rangeBigInt(1n, 120n * 10n ** 18n);
      data = `0x${pad(SEL_TRANSFER).slice(-8)}${pad(recipient)}${pad(amt.toString(16))}` as `0x${string}`;
      break;
    }
    case 'erc20_approve': {
      const spender = rng.choice(TARGETS);
      const amt = rng.choice([0n, 50n * 10n ** 18n, 100n * 10n ** 18n, 200n * 10n ** 18n]);
      data = `0x${pad(SEL_APPROVE).slice(-8)}${pad(spender)}${pad(amt.toString(16))}` as `0x${string}`;
      break;
    }
    case 'erc20_transfer_from': {
      const from = rng.choice(TARGETS);
      const toAddr = rng.choice(TARGETS);
      const amt = rng.rangeBigInt(1n, 100n * 10n ** 18n);
      data = `0x${pad(SEL_TRANSFER_FROM).slice(-8)}${pad(from)}${pad(toAddr)}${pad(amt.toString(16))}` as `0x${string}`;
      break;
    }
    case 'malformed':
      data = '0xa9059cbb12345678' as `0x${string}`;
      break;
    default:
      data = '0x';
  }

  return {
    i,
    description: `Fuzz tx #${i} to ${to.slice(0, 10)} val=${value} op=${op}`,
    to,
    value,
    data,
    operation: op,
    expectedVerdict: 'ALLOW',
    expectedCode: 0,
  };
}

// The Safe resets a tripped breaker, as an owner would; the agent's ledger is kept, so the 24 h
// windows keep filling across the run.
async function resetBreaker(env: Env) {
  const data = encodeFunctionData({ abi: env.safeAbi, functionName: 'resetBreakerOn', args: [env.module, env.agent.address] } as never) as Hex;
  await mustSend(env.chain, env.owner, env.safe, data, 'reset the breaker');
}

async function runSeed(seed: number, iterations: number) {
  const rng = new PRNG(seed);
  const env: Env = await setupEnvironment();
  let allowed = 0;
  let denied = 0;
  const codes = new Map<number, number>();

  for (let i = 1; i <= iterations; i++) {
    const tx = generateRandomTx(rng, i);
    const res = await runStep(env, tx);

    if (!res.matched) {
      console.error(`
[DISCREPANCY DETECTED at seed ${seed}, iteration ${i}]`);
      console.error(`TX:`, JSON.stringify(tx, (k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
      console.error(`Predicted:`, res.predicted);
      console.error(`On-chain: `, res.onchain);
      throw new Error(`Verdict mismatch at seed ${seed}, iteration ${i}: predicted=${res.predicted.verdict}(${res.predicted.code}) vs onchain=${res.onchain.verdict}(${res.onchain.code})`);
    }
    if (res.onchain.verdict === 'ALLOW') allowed++;
    else denied++;
    codes.set(res.onchain.code, (codes.get(res.onchain.code) ?? 0) + 1);

    // Advance chain time by 1 hour every 25 calls, to move the rolling window.
    if (i % 25 === 0) env.chain.now += 3600n;
    if (res.onchain.code === 15) await resetBreaker(env);
  }
  const byCode = [...codes.entries()].sort((x, y) => x[0] - y[0]).map(([c, n]) => `${c}:${n}`).join(' ');
  console.log(`  Seed ${seed}: ${iterations}/${iterations} matched; allowed ${allowed}, denied ${denied}; codes ${byCode}`);
  return { allowed, denied };
}

async function runDifferentialFuzz() {
  const seeds = (process.env.LEASH_FUZZ_SEEDS ?? '42,7,2026').split(',').map((x) => Number(x.trim()));
  const perSeed = Number(process.env.LEASH_FUZZ_ITERATIONS ?? 200);
  const total = seeds.length * perSeed;
  console.log(`=== Starting Differential Fuzzing (${seeds.length} seeds x ${perSeed} transactions) ===`);
  const src = predictionSource();
  const bin = findLeashBinary();
  console.log(`  Prediction source: ${src}${bin ? ` (${bin})` : ''}`);

  let allowed = 0;
  let denied = 0;
  for (const seed of seeds) {
    const r = await runSeed(seed, perSeed);
    allowed += r.allowed;
    denied += r.denied;
  }

  console.log(`
[Differential Fuzzing Results]`);
  console.log(`  Total Iterations: ${total}`);
  console.log(`  Congruent Verdicts: ${total}/${total} (100.0%)`);
  console.log(`  Allowed: ${allowed}, Denied: ${denied}`);
  console.log(`  All off-chain predictions matched EVM contract execution identically.
`);
}

runDifferentialFuzz().catch((err) => {
  console.error('Fuzzer failed:', err);
  process.exit(1);
});
