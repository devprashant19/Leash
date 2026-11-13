/**
 * Leash on a serverless function: deploys the real Fe-compiled contracts (MockSafe, LeashModule,
 * MockErc20) into an in-memory EVM, and asks the real Fe-built `leash` binary for every prediction.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import {
  decodeEventLog,
  decodeFunctionResult,
  encodeDeployData,
  encodeFunctionData,
  formatEther,
  type Abi,
  type Hex,
} from 'viem';
import { Chain, type Signer } from './evm';
import {
  predictVerdict,
  predictionSource,
  cliFingerprint,
  findLeashBinary,
  ADDR_TOKEN,
  ADDR_TREASURY,
  type LeashCheckResult,
  type PredictionSource,
} from '../../demo/lib/leash-cli';
import { canonicalScenarios, type ScenarioTx } from '../../demo/lib/scenario';

const ASSETS = path.join(process.cwd(), 'api', '_assets');

// Anvil's well-known development keys (public test keys, never used on a real network).
const OWNER_PK: Hex = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const AGENT_PK: Hex = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
// The guardian has its own key (Anvil account #2), separate from the agent, so a pause comes from a different party.
const GUARDIAN_PK: Hex = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a';

export const REASONS = [
  'None', 'Paused', 'SessionExpired', 'DelegateCallBlocked', 'TargetNotAllowed', 'SelectorNotAllowed',
  'MalformedCalldata', 'PerTxCapExceeded', 'WindowCapExceeded', 'TokenCapExceeded', 'UnlimitedApproval',
  'RecipientNotAllowed', 'RateLimited', 'CooldownActive', 'OutsideTradingHours', 'CircuitTripped',
  'SwapNotAllowed', 'LendingNotAllowed', 'PriceUnavailable', 'UsdCapExceeded', 'EscalationRequired',
];

/**
 * On Linux x86-64 (Vercel, CI), copy the bundled Fe-built binary to /tmp and make it executable.
 * On Vercel the TypeScript mirror is forbidden: every prediction must come from the Fe binary.
 */
let cliReady = false;
function ensureNativeCli(): void {
  if (cliReady) return;
  cliReady = true;
  if (process.env.VERCEL) process.env.LEASH_REQUIRE_NATIVE = '1';
  if (process.env.LEASH_BIN && fs.existsSync(process.env.LEASH_BIN)) return;
  if (process.platform !== 'linux' || process.arch !== 'x64') return;
  const src = path.join(ASSETS, 'leash-linux-x86_64');
  if (!fs.existsSync(src)) return;
  const dst = path.join(os.tmpdir(), 'leash-cli');
  if (!fs.existsSync(dst)) {
    fs.copyFileSync(src, dst);
    fs.chmodSync(dst, 0o755);
  }
  process.env.LEASH_BIN = dst;
}

export function cliInfo(): { source: PredictionSource; version: string; fingerprint: string } {
  ensureNativeCli();
  const source = predictionSource();
  const bin = findLeashBinary();
  const version =
    source === 'fe-native' && bin
      ? spawnSync(bin, ['--version'], { encoding: 'utf8' }).stdout.trim()
      : 'TypeScript mirror (no native binary on this host)';
  return { source, version, fingerprint: cliFingerprint() };
}

function artifact(name: string): { abi: Abi; bytecode: Hex } {
  return {
    abi: JSON.parse(fs.readFileSync(path.join(ASSETS, 'artifacts', `${name}.abi.json`), 'utf8')),
    bytecode: ('0x' + fs.readFileSync(path.join(ASSETS, 'artifacts', `${name}.bin`), 'utf8').trim()) as Hex,
  };
}

export interface Env {
  chain: Chain;
  owner: Signer;
  agent: Signer;
  guardian: Signer;
  safe: Hex;
  module: Hex;
  safeAbi: Abi;
  moduleAbi: Abi;
  tokenAbi: Abi;
}

export async function mustSend(chain: Chain, from: Signer, to: Hex | undefined, data: Hex, what: string) {
  const r = await chain.send(from, to, data);
  if (!r.success) throw new Error(`setup step failed (${what}): ${r.error}`);
  return r;
}

/** Deploys a fresh Safe + LeashModule + demo token, exactly like the Anvil demo does. */
export async function setupEnvironment(): Promise<Env> {
  ensureNativeCli();
  const chain = await Chain.create(BigInt(Math.floor(Date.now() / 1000)));
  const owner = await chain.signer(OWNER_PK, 100n * 10n ** 18n);
  const agent = await chain.signer(AGENT_PK, 10n * 10n ** 18n);
  const guardian = await chain.signer(GUARDIAN_PK, 1n * 10n ** 18n);

  const safeArt = artifact('MockSafe');
  const moduleArt = artifact('LeashModule');
  const tokenArt = artifact('MockErc20');

  const safe = (await mustSend(chain, owner, undefined, safeArt.bytecode, 'deploy MockSafe')).createdAddress!;
  const module = (
    await mustSend(
      chain,
      owner,
      undefined,
      encodeDeployData({ abi: moduleArt.abi, bytecode: moduleArt.bytecode, args: [safe, guardian.address] }),
      'deploy LeashModule'
    )
  ).createdAddress!;

  // The default policy allowlists the token at ADDR_TOKEN: run the Fe MockErc20 code there.
  const tokenDeployed = (await mustSend(chain, owner, undefined, tokenArt.bytecode, 'deploy MockErc20')).createdAddress!;
  await chain.putCode(ADDR_TOKEN as Hex, await chain.getCode(tokenDeployed));

  const fn = (abi: Abi, functionName: string, args: unknown[] = []) =>
    encodeFunctionData({ abi, functionName, args } as never);
  await mustSend(chain, owner, safe, fn(safeArt.abi, 'enableModule', [module]), 'enableModule');
  await mustSend(chain, owner, safe, fn(safeArt.abi, 'setForwardCalls', [true]), 'setForwardCalls');
  const expiry = chain.now + 365n * 24n * 3600n;
  await mustSend(chain, owner, safe, fn(safeArt.abi, 'setAgentOn', [module, agent.address, expiry, 1n]), 'setAgent');
  await chain.setBalance(safe, 10n * 10n ** 18n);
  await mustSend(chain, owner, ADDR_TOKEN as Hex, fn(tokenArt.abi, 'mint', [safe, 1000n * 10n ** 18n]), 'mint');

  return { chain, owner, agent, guardian, safe, module, safeAbi: safeArt.abi, moduleAbi: moduleArt.abi, tokenAbi: tokenArt.abi };
}

// Read-only calls use their own caller: ethereumjs bumps the caller's nonce on runCall,
// which would desynchronise the agent's and owner's signed transactions.
const READER: Hex = '0x00000000000000000000000000000000000000Ae';

async function read(env: Env, to: Hex, abi: Abi, functionName: string, args: unknown[] = []): Promise<unknown> {
  const data = await env.chain.call(READER, to, encodeFunctionData({ abi, functionName, args } as never));
  return decodeFunctionResult({ abi, functionName, data } as never);
}

/** The agent's on-chain state, encoded the way `leash check --state` expects (52 words, hex). */
async function stateHex(env: Env): Promise<Hex> {
  const words = (await read(env, env.module, env.moduleAbi, 'state', [env.agent.address])) as bigint[];
  return ('0x' + words.map((w) => w.toString(16).padStart(64, '0')).join('')) as Hex;
}

export interface Balances {
  safeEth: string;
  treasuryEth: string;
  safeTokens: string;
  treasuryTokens: string;
}

export async function balances(env: Env): Promise<Balances> {
  const tok = async (who: Hex) =>
    formatEther((await read(env, ADDR_TOKEN as Hex, env.tokenAbi, 'balanceOf', [who])) as bigint);
  return {
    safeEth: formatEther(await env.chain.balanceOf(env.safe)),
    treasuryEth: formatEther(await env.chain.balanceOf(ADDR_TREASURY as Hex)),
    safeTokens: await tok(env.safe),
    treasuryTokens: await tok(ADDR_TREASURY as Hex),
  };
}

export interface StepResult {
  i: number;
  description: string;
  to: Hex;
  valueEth: string;
  data: Hex;
  operation: 'call' | 'delegatecall';
  predicted: { verdict: 'ALLOW' | 'DENY'; code: number; reason: string; message: string };
  remaining: LeashCheckResult['remaining'];
  onchain: { verdict: 'ALLOW' | 'DENY'; code: number; reason: string; txHash: Hex; gasUsed: string; eventEmitted: boolean };
  matched: boolean;
}

/** One agent transaction: the Fe CLI predicts first (with the real on-chain state), then the module decides on-chain. */
export async function runStep(env: Env, s: ScenarioTx): Promise<StepResult> {
  const op = s.operation === 1 ? 'delegatecall' : 'call';
  const prediction = predictVerdict({
    to: s.to,
    valueWei: s.value,
    data: s.data,
    op,
    now: Number(env.chain.now),
    stateHex: await stateHex(env),
  });

  const res = await env.chain.send(
    env.agent,
    env.module,
    encodeFunctionData({ abi: env.moduleAbi, functionName: 'tryExecute', args: [s.to, s.value, s.data, s.operation] } as never)
  );
  if (!res.success) throw new Error(`tryExecute reverted for step ${s.i}: ${res.error}`);

  // tryExecute returns (bool ok, uint8 code); it also emits Allowed or Denied (not when the breaker is already tripped).
  const [ok, rawCode] = decodeFunctionResult({
    abi: env.moduleAbi,
    functionName: 'tryExecute',
    data: res.returnData,
  } as never) as unknown as [boolean, number | bigint];
  const verdict: 'ALLOW' | 'DENY' = ok ? 'ALLOW' : 'DENY';
  const code = ok ? 0 : Number(rawCode);
  const emitted = res.logs.some((log) => {
    if (log.address.toLowerCase() !== env.module.toLowerCase()) return false;
    try {
      const ev = decodeEventLog({ abi: env.moduleAbi, topics: log.topics as [Hex, ...Hex[]], data: log.data });
      return ev.eventName === (ok ? 'Allowed' : 'Denied');
    } catch {
      return false;
    }
  });

  return {
    i: s.i,
    description: s.description,
    to: s.to,
    valueEth: formatEther(s.value),
    data: s.data,
    operation: op,
    predicted: { verdict: prediction.verdict, code: prediction.code, reason: prediction.reason, message: prediction.message },
    remaining: prediction.remaining,
    onchain: { verdict, code, reason: REASONS[code] ?? `Code${code}`, txHash: res.hash, gasUsed: res.gasUsed.toString(), eventEmitted: emitted },
    matched: prediction.verdict === verdict && prediction.code === code,
  };
}

export interface DemoResult {
  engine: string;
  predictionSource: PredictionSource;
  cliVersion: string;
  fingerprintCli: string;
  fingerprintChain: string;
  fingerprintsMatch: boolean;
  allMatched: boolean;
  matchedCount: number;
  steps: StepResult[];
  balancesBefore: Balances;
  balancesAfter: Balances;
  addresses: { safe: Hex; module: Hex; token: string; treasury: string; agent: Hex };
  elapsedMs: number;
}

export const ENGINE = 'In-memory EVM (ethereumjs, Prague rules) running the Fe-compiled contracts';

export async function chainFingerprint(env: Env): Promise<string> {
  const fp = (await read(env, env.module, env.moduleAbi, 'fingerprint')) as bigint;
  return '0x' + fp.toString(16).padStart(64, '0');
}

export async function runDemo(): Promise<DemoResult> {
  const t0 = Date.now();
  const env = await setupEnvironment();
  const info = cliInfo();
  const before = await balances(env);
  const steps: StepResult[] = [];
  for (const s of canonicalScenarios()) steps.push(await runStep(env, s));
  const fingerprintChain = await chainFingerprint(env);
  return {
    engine: ENGINE,
    predictionSource: info.source,
    cliVersion: info.version,
    fingerprintCli: info.fingerprint,
    fingerprintChain,
    fingerprintsMatch: fingerprintChain.toLowerCase() === info.fingerprint.toLowerCase(),
    allMatched: steps.every((s) => s.matched),
    matchedCount: steps.filter((s) => s.matched).length,
    steps,
    balancesBefore: before,
    balancesAfter: await balances(env),
    addresses: { safe: env.safe, module: env.module, token: ADDR_TOKEN, treasury: ADDR_TREASURY, agent: env.agent.address },
    elapsedMs: Date.now() - t0,
  };
}

export interface CheckInput {
  to: Hex;
  valueWei: bigint;
  data: Hex;
  operation: 'call' | 'delegatecall';
}

const MAX_DATA_BYTES = 1024;

/** Validates untrusted input from the page. Throws a message meant for the user. */
export function parseCheckInput(body: unknown): CheckInput {
  const b = (body ?? {}) as Record<string, unknown>;
  const to = String(b.to ?? '').trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(to)) throw new Error('"to" must be a 20-byte hex address (0x + 40 hex characters).');
  const valueEth = String(b.valueEth ?? '0').trim();
  if (!/^\d{1,9}(\.\d{1,18})?$/.test(valueEth)) throw new Error('"value" must be an ETH amount such as 0.05 (up to 18 decimals).');
  const [whole, frac = ''] = valueEth.split('.');
  const valueWei = BigInt(whole) * 10n ** 18n + BigInt((frac + '0'.repeat(18)).slice(0, 18));
  if (valueWei > 9n * 10n ** 18n) throw new Error('"value" must be at most 9 ETH (the demo Safe holds 10 ETH).');
  const data = (String(b.data ?? '0x').trim() || '0x').toLowerCase();
  if (!/^0x([0-9a-f]{2})*$/.test(data)) throw new Error('"data" must be hex with an even number of digits, starting with 0x.');
  if ((data.length - 2) / 2 > MAX_DATA_BYTES) throw new Error(`"data" must be at most ${MAX_DATA_BYTES} bytes.`);
  const operation = String(b.operation ?? 'call');
  if (operation !== 'call' && operation !== 'delegatecall') throw new Error('"operation" must be "call" or "delegatecall".');
  return { to: to.toLowerCase() as Hex, valueWei, data: data as Hex, operation };
}

export interface CheckResult {
  engine: string;
  predictionSource: PredictionSource;
  cliVersion: string;
  step: StepResult;
  elapsedMs: number;
}

export async function runCheck(input: CheckInput): Promise<CheckResult> {
  const t0 = Date.now();
  const env = await setupEnvironment();
  const info = cliInfo();
  const step = await runStep(env, {
    i: 1,
    description: 'Your transaction',
    to: input.to,
    value: input.valueWei,
    data: input.data,
    operation: input.operation === 'delegatecall' ? 1 : 0,
  });
  return { engine: ENGINE, predictionSource: info.source, cliVersion: info.version, step, elapsedMs: Date.now() - t0 };
}

