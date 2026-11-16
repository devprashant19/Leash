/**
 * Plan simulation: run a multi-step agent plan on a fresh chain with the real Fe-compiled contracts.
 * Each step is predicted by the Fe CLI from the agent's current on-chain state, then decided by
 * LeashModule, so cumulative effects (the 24 h budget, the circuit breaker) are exactly what the
 * contract would do.
 */
import { parseCheckInput, runStep, setupEnvironment, cliInfo, chainFingerprint, ENGINE, type StepResult } from './leash';
import type { PredictionSource } from '../../demo/lib/leash-cli';

export const MAX_PLAN_STEPS = 12;

export interface PlanStepInput { description?: string; to: string; valueEth?: string; data?: string; operation?: string }

export interface PlanResult {
  engine: string;
  predictionSource: PredictionSource;
  cliVersion: string;
  fingerprintCli: string;
  fingerprintChain: string;
  steps: StepResult[];
  allowedCount: number;
  firstDenied: number | null;
  allMatched: boolean;
  elapsedMs: number;
}

/** Validates the request body: { steps: [{ description?, to, valueEth?, data?, operation? }, …] }. */
export function parsePlan(body: unknown): Array<{ description: string; input: ReturnType<typeof parseCheckInput> }> {
  const steps = (body as { steps?: unknown })?.steps;
  if (!Array.isArray(steps) || steps.length === 0) throw new Error('Provide { "steps": [ { "to": "0x…", "valueEth": "0.05" }, … ] }.');
  if (steps.length > MAX_PLAN_STEPS) throw new Error(`A plan can have at most ${MAX_PLAN_STEPS} steps.`);
  return steps.map((s, i) => {
    try {
      const step = s as PlanStepInput;
      return { description: String(step.description || `Step ${i + 1}`).slice(0, 120), input: parseCheckInput(step) };
    } catch (e) {
      throw new Error(`Step ${i + 1}: ${(e as Error).message}`);
    }
  });
}

export async function runPlan(plan: ReturnType<typeof parsePlan>): Promise<PlanResult> {
  const t0 = Date.now();
  const env = await setupEnvironment();
  const info = cliInfo();
  const steps: StepResult[] = [];
  for (const [k, p] of plan.entries()) {
    steps.push(await runStep(env, {
      i: k + 1,
      description: p.description,
      to: p.input.to,
      value: p.input.valueWei,
      data: p.input.data,
      operation: p.input.operation === 'delegatecall' ? 1 : 0,
    }));
  }
  const firstDeniedIdx = steps.findIndex((s) => s.onchain.verdict === 'DENY');
  return {
    engine: ENGINE,
    predictionSource: info.source,
    cliVersion: info.version,
    fingerprintCli: info.fingerprint,
    fingerprintChain: await chainFingerprint(env),
    steps,
    allowedCount: steps.filter((s) => s.onchain.verdict === 'ALLOW').length,
    firstDenied: firstDeniedIdx === -1 ? null : firstDeniedIdx + 1,
    allMatched: steps.every((s) => s.matched),
    elapsedMs: Date.now() - t0,
  };
}
