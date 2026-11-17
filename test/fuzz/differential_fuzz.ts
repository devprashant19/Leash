/**
 * Leash Differential Fuzzer
 * Generates pseudorandom transaction streams across all boundary conditions
 * and asserts 100% verdict congruence between the off-chain predictor (CLI/TS mirror)
 * and the EVM-deployed Fe LeashModule contract.
 */
import assert from 'node:assert/strict';
import { setupEnvironment, runStep, REASONS, type Env } from '../../api/_lib/leash';
import type { ScenarioTx } from '../../demo/lib/scenario';
import {
  SEL_APPROVE,
  SEL_TRANSFER,
  SEL_TRANSFER_FROM,
  MAX_PER_TX_WEI,
  ADDR_TOKEN,
  ADDR_TREASURY,
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

function generateRandomTx(rng: PRNG, i: number): ScenarioTx {
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

async function runDifferentialFuzz(iterations = 200) {
  console.log(`=== Starting Differential Fuzzing (${iterations} iterations) ===`);
  const rng = new PRNG(42);
  let env: Env = await setupEnvironment();

  let congruent = 0;
  let allowedCount = 0;
  let deniedCount = 0;

  for (let i = 1; i <= iterations; i++) {
    const tx = generateRandomTx(rng, i);

    // If circuit breaker is tripped on the current agent, reset it via Safe or re-setup
    const res = await runStep(env, tx);

    if (!res.matched) {
      console.error(`\n[DISCREPANCY DETECTED at iteration ${i}]`);
      console.error(`TX:`, JSON.stringify(tx, (k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
      console.error(`Predicted:`, res.predicted);
      console.error(`On-chain: `, res.onchain);
      throw new Error(`Verdict mismatch at iteration ${i}: predicted=${res.predicted.verdict}(${res.predicted.code}) vs onchain=${res.onchain.verdict}(${res.onchain.code})`);
    }

    congruent++;
    if (res.onchain.verdict === 'ALLOW') {
      allowedCount++;
    } else {
      deniedCount++;
    }

    // Periodically advance chain time by 1 hour to test rolling window mechanics
    if (i % 25 === 0) {
      env.chain.now += 3600n;
    }

    // If breaker tripped, re-initialize environment for next fuzz batch
    if (res.onchain.code === 15) {
      env = await setupEnvironment();
    }
  }

  console.log(`\n[Differential Fuzzing Results]`);
  console.log(`  Total Iterations: ${iterations}`);
  console.log(`  Congruent Verdicts: ${congruent}/${iterations} (100.0%)`);
  console.log(`  Allowed: ${allowedCount}, Denied: ${deniedCount}`);
  console.log(`  All off-chain predictions matched EVM contract execution identically.\n`);
}

runDifferentialFuzz().catch((err) => {
  console.error('Fuzzer failed:', err);
  process.exit(1);
});
