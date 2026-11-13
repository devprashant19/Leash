/**
 * Feature tour: one fresh chain, every rule the deployed LeashModule enforces, plus the owner and
 * guardian controls. Each agent step is predicted by the Fe-built CLI first, then decided on-chain.
 */
import { encodeFunctionData, type Abi, type Hex } from 'viem';
import { ADDR_TOKEN, ADDR_TREASURY, type PredictionSource } from '../../demo/lib/leash-cli';
import {
  balances,
  chainFingerprint,
  cliInfo,
  ENGINE,
  mustSend,
  runStep,
  setupEnvironment,
  type Balances,
  type StepResult,
} from './leash';

export interface TourTx extends StepResult {
  kind: 'tx';
  feature: string;
  why: string;
  expected: { verdict: 'ALLOW' | 'DENY'; code: number };
  asExpected: boolean;
}
export interface TourEvent {
  kind: 'event';
  actor: 'owner' | 'guardian' | 'clock';
  title: string;
  detail: string;
  txHash?: Hex;
}
export interface TourChapter {
  title: string;
  intro: string;
  items: Array<TourTx | TourEvent>;
}
export interface TourResult {
  engine: string;
  predictionSource: PredictionSource;
  cliVersion: string;
  fingerprintCli: string;
  fingerprintChain: string;
  fingerprintsMatch: boolean;
  chapters: TourChapter[];
  txCount: number;
  matchedCount: number;
  expectedCount: number;
  codesCovered: number[];
  balancesBefore: Balances;
  balancesAfter: Balances;
  addresses: { safe: Hex; module: Hex; token: string; treasury: string; agent: Hex; guardian: Hex };
  elapsedMs: number;
}

const word = (v: bigint | string) => (typeof v === 'string' ? v.replace(/^0x/, '').toLowerCase() : v.toString(16)).padStart(64, '0');
const milli = (n: bigint) => n * 10n ** 15n; // n/1000 ETH
const TOK = (n: bigint) => n * 10n ** 18n;
const TREASURY = ADDR_TREASURY as Hex;
const TOKEN = ADDR_TOKEN as Hex;
const transferData = (to: string, amount: bigint) => ('0xa9059cbb' + word(to) + word(amount)) as Hex;
const approveData = (spender: string, amount: bigint) => ('0x095ea7b3' + word(spender) + word(amount)) as Hex;
const ALLOW = { verdict: 'ALLOW' as const, code: 0 };
const DENY = (code: number) => ({ verdict: 'DENY' as const, code });

export async function runTour(): Promise<TourResult> {
  const t0 = Date.now();
  const env = await setupEnvironment();
  const info = cliInfo();
  const before = await balances(env);
  const fn = (abi: Abi, functionName: string, args: unknown[] = []) => encodeFunctionData({ abi, functionName, args } as never);
  let n = 0;

  const tx = async (feature: string, description: string, why: string, to: Hex, value: bigint, data: Hex, operation: 0 | 1, expected: { verdict: 'ALLOW' | 'DENY'; code: number }): Promise<TourTx> => {
    const step = await runStep(env, { i: ++n, description, to, value, data, operation });
    return { ...step, kind: 'tx', feature, why, expected, asExpected: step.onchain.verdict === expected.verdict && step.onchain.code === expected.code };
  };
  const owner = async (title: string, detail: string, functionName: string, args: unknown[]): Promise<TourEvent> => {
    const r = await mustSend(env.chain, env.owner, env.safe, fn(env.safeAbi, functionName, args), title);
    return { kind: 'event', actor: 'owner', title, detail, txHash: r.hash };
  };
  const reset = (detail: string) => owner('Owner resets the breaker', detail, 'resetBreakerOn', [env.module, env.agent.address]);

  const chapters: TourChapter[] = [];

  chapters.push({
    title: 'Everyday spending is allowed',
    intro: 'Calls inside every limit go straight through: the CLI says ALLOW, the module agrees, and the Safe executes.',
    items: [
      await tx('ETH payment', 'Send 0.05 ETH to the treasury', 'Under the 0.1 ETH per-transaction cap and the 0.5 ETH daily budget, to an allowed ETH target.', TREASURY, milli(50n), '0x', 0, ALLOW),
      await tx('Token transfer', 'Transfer 50 tokens to the treasury', 'transfer() on the allowlisted token, under the 100-token cap.', TOKEN, 0n, transferData(ADDR_TREASURY, TOK(50n)), 0, ALLOW),
      await tx('Bounded approval', 'Approve the treasury to spend 50 tokens', 'A normal, bounded approval, under the 100-token approval cap.', TOKEN, 0n, approveData(ADDR_TREASURY, TOK(50n)), 0, ALLOW),
    ],
  });

  const guards = [
    await tx('Per-transaction cap', 'Send 0.2 ETH to the treasury', '0.2 ETH is over the 0.1 ETH per-transaction cap.', TREASURY, milli(200n), '0x', 0, DENY(7)),
    await tx('Target allowlist', 'Call an unlisted contract', 'Only the token and the treasury are allowed targets, so a prompt-injected “send it here” goes nowhere.', '0xdead00000000000000000000000000000000beef', 0n, '0x', 0, DENY(4)),
    await tx('Unlimited approval', 'approve(treasury, 2^256 − 1)', 'An unlimited approval would hand over the whole balance. This is the third denial, so the breaker trips.', TOKEN, 0n, approveData(ADDR_TREASURY, (1n << 256n) - 1n), 0, DENY(10)),
    await tx('Circuit breaker', 'Send 0.01 ETH to the treasury', 'A harmless payment, but the breaker tripped after three denials: everything is refused until the owner resets it.', TREASURY, milli(10n), '0x', 0, DENY(15)),
  ];
  chapters.push({
    title: 'Each guard refuses, then the breaker trips',
    intro: 'Three refused calls in a row trip the circuit breaker, which stops the agent completely, even for harmless calls.',
    items: [...guards, await reset('The Safe calls resetBreaker(agent). Only the Safe can do this; the agent cannot.')],
  });

  chapters.push({
    title: 'Calldata is decoded, not trusted',
    intro: 'Token calls are decoded by selector and checked field by field. Unknown or malformed calls are refused.',
    items: [
      await tx('Token cap', 'Transfer 101 tokens to the treasury', '101 tokens is over the 100-token per-transfer cap.', TOKEN, 0n, transferData(ADDR_TREASURY, TOK(101n)), 0, DENY(9)),
      await tx('Selector allowlist', 'Call mint() on the token', 'Only transfer, approve and transferFrom are allowed on the token; mint (0x40c10f19) is not.', TOKEN, 0n, ('0x40c10f19' + word(ADDR_TREASURY) + word(TOK(1n))) as Hex, 0, DENY(5)),
      await reset('Two denials so far. Resetting keeps the next lessons about calldata, not the breaker.'),
      await tx('Malformed calldata', 'transfer() with its arguments cut off', 'The transfer selector with only 4 bytes after it cannot be decoded, so it is refused instead of guessed.', TOKEN, 0n, '0xa9059cbb00000000', 0, DENY(6)),
      await tx('Delegatecall', 'Delegatecall into the treasury', 'Delegatecall would run foreign code with the Safe’s own storage. It is always refused.', TREASURY, 0n, '0x', 1, DENY(3)),
      await reset('Back to zero denials before the budget test.'),
    ],
  });

  chapters.push({
    title: 'The 24-hour budget adds up',
    intro: 'Each call is small, but the rolling window counts them all. 0.05 ETH is already spent from the first chapter.',
    items: [
      await tx('Rolling window', 'Send 0.1 ETH (0.15 ETH spent today)', 'Exactly at the per-transaction cap, and the day’s total stays under 0.5 ETH.', TREASURY, milli(100n), '0x', 0, ALLOW),
      await tx('Rolling window', 'Send 0.1 ETH (0.25 ETH spent today)', 'Still inside the 0.5 ETH daily budget.', TREASURY, milli(100n), '0x', 0, ALLOW),
      await tx('Rolling window', 'Send 0.1 ETH (0.35 ETH spent today)', 'Still inside the 0.5 ETH daily budget.', TREASURY, milli(100n), '0x', 0, ALLOW),
      await tx('Rolling window', 'Send 0.1 ETH (0.45 ETH spent today)', 'Still inside the 0.5 ETH daily budget.', TREASURY, milli(100n), '0x', 0, ALLOW),
      await tx('Window cap', 'Send 0.1 ETH (would make 0.55 ETH today)', 'Each call is under the per-transaction cap, but together they would pass 0.5 ETH in 24 hours.', TREASURY, milli(100n), '0x', 0, DENY(8)),
    ],
  });

  const pause = await env.chain.send(env.guardian, env.module, fn(env.moduleAbi, 'pause'));
  if (!pause.success) throw new Error(`guardian pause failed: ${pause.error}`);
  const paused = await tx('Guardian pause', 'Send 0.01 ETH while paused', 'The guardian paused the module, so every agent call is refused until the Safe unpauses it.', TREASURY, milli(10n), '0x', 0, DENY(1));
  const unpause = await owner('Owner unpauses', 'Only the Safe can lift a pause. The guardian can stop the agent but never move money.', 'unpauseOn', [env.module]);
  const session = await owner('Owner renews the agent with a 60-second session', 'setAgent sets a new expiry and clears the denial count.', 'setAgentOn', [env.module, env.agent.address, env.chain.now + 60n, 1n]);
  env.chain.now += 120n;
  const expired = await tx('Session expiry', 'Send 0.01 ETH after the session ended', 'Agent keys are time-boxed. Once the session expires, the agent can do nothing until the owner renews it.', TREASURY, milli(10n), '0x', 0, DENY(2));
  chapters.push({
    title: 'Humans stay in control',
    intro: 'A separate guardian key can stop the agent instantly, and agent sessions expire on their own.',
    items: [
      { kind: 'event', actor: 'guardian', title: 'Guardian pauses the module', detail: 'A separate guardian key calls pause(). It needs no owner signature.', txHash: pause.hash },
      paused,
      unpause,
      session,
      { kind: 'event', actor: 'clock', title: 'Two minutes pass', detail: 'The 60-second session has expired.' },
      expired,
    ],
  });

  const txs = chapters.flatMap((c) => c.items).filter((x): x is TourTx => x.kind === 'tx');
  const fingerprintChain = await chainFingerprint(env);
  return {
    engine: ENGINE,
    predictionSource: info.source,
    cliVersion: info.version,
    fingerprintCli: info.fingerprint,
    fingerprintChain,
    fingerprintsMatch: fingerprintChain.toLowerCase() === info.fingerprint.toLowerCase(),
    chapters,
    txCount: txs.length,
    matchedCount: txs.filter((t) => t.matched).length,
    expectedCount: txs.filter((t) => t.asExpected).length,
    codesCovered: [...new Set(txs.map((t) => t.onchain.code))].sort((a, b) => a - b),
    balancesBefore: before,
    balancesAfter: await balances(env),
    addresses: { safe: env.safe, module: env.module, token: ADDR_TOKEN, treasury: ADDR_TREASURY, agent: env.agent.address, guardian: env.guardian.address },
    elapsedMs: Date.now() - t0,
  };
}
