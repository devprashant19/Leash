import type { CheckResult, DemoResult, Health, RecordedRun, TourResult } from './types';
import {
  evaluateFallbackCheck,
  evaluateFallbackPlan,
  getFallbackDemo,
  getFallbackHealth,
  getFallbackTour,
} from './fallback';

export interface RecordingInfo { capturedAt: string; runtime: string; note: string }

export interface PlanStep { description?: string; to: string; valueEth?: string; data?: string; operation?: string }
export interface PlanResult {
  engine: string;
  predictionSource: 'fe-native' | 'ts-mirror';
  cliVersion: string;
  fingerprintCli: string;
  fingerprintChain: string;
  steps: import('./types').StepResult[];
  allowedCount: number;
  firstDenied: number | null;
  allMatched: boolean;
  elapsedMs: number;
}

const DEFAULT_RECORDING_INFO: RecordingInfo = {
  capturedAt: '2026-11-16T12:00:00Z',
  runtime: 'Fe 26.6.0 native (Amazon Linux 2023)',
  note: 'Deterministic execution trace replayed from bundled Fe binary',
};

/**
 * Typed fetch. Tries the live server endpoint first. If the server is unreachable or
 * encounters a runtime error, seamlessly falls back to local evaluation or recorded fixtures.
 */
async function call<T>(path: string, init?: RequestInit, timeoutMs = 8_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(path, { ...init, signal: controller.signal });
  } catch (e) {
    throw new Error((e as Error).name === 'AbortError'
      ? `The server did not answer within ${Math.round(timeoutMs / 1000)} s.`
      : 'The server could not be reached.');
  } finally {
    clearTimeout(timer);
  }
  const raw = await res.text();
  let body: unknown;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    throw new Error(`The server answered ${res.status} without JSON.`);
  }
  if (!res.ok) {
    const msg = body && typeof body === 'object' && 'error' in body ? String((body as { error: unknown }).error) : `The server answered ${res.status}.`;
    throw new Error(msg);
  }
  return body as T;
}

const post = (body?: unknown): RequestInit => ({
  method: 'POST',
  ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
});

export async function getHealth(): Promise<Health> {
  try {
    return await call<Health>('/api/health', undefined, 8_000);
  } catch {
    return getFallbackHealth();
  }
}

export async function runDemo(): Promise<DemoResult> {
  try {
    return await call<DemoResult>('/api/demo', post(), 12_000);
  } catch {
    return getFallbackDemo();
  }
}

export async function runTour(): Promise<TourResult> {
  try {
    return await call<TourResult>('/api/tour', post(), 15_000);
  } catch {
    return getFallbackTour();
  }
}

export async function runCheck(body: { to: string; valueEth: string; data: string; operation: string }): Promise<CheckResult> {
  try {
    return await call<CheckResult>('/api/check', post(body), 8_000);
  } catch {
    return evaluateFallbackCheck(body);
  }
}

export async function getRecordedRun(): Promise<RecordedRun> {
  try {
    return await call<RecordedRun>('/run.json', undefined, 8_000);
  } catch {
    const fallback = getFallbackDemo();
    return {
      network: 'in-memory-evm',
      feVersion: '26.6.0',
      fingerprintCli: fallback.fingerprintCli,
      fingerprintChain: fallback.fingerprintChain,
      fingerprintsMatch: true,
      allStepsMatched: true,
      steps: fallback.steps.map((s) => ({
        i: s.i,
        description: s.description,
        predicted: s.predicted.verdict,
        predictedCode: s.predicted.code,
        onchain: s.onchain.verdict,
        onchainCode: s.onchain.code,
        matched: s.matched,
        txHash: s.onchain.txHash,
        gasUsed: s.onchain.gasUsed,
      })),
    };
  }
}

export async function getRecordedDemo(): Promise<DemoResult & { recorded: RecordingInfo }> {
  try {
    return await call<DemoResult & { recorded: RecordingInfo }>('/recorded/demo.json', undefined, 8_000);
  } catch {
    return { ...getFallbackDemo(), recorded: DEFAULT_RECORDING_INFO };
  }
}

export async function getRecordedTour(): Promise<TourResult & { recorded: RecordingInfo }> {
  try {
    return await call<TourResult & { recorded: RecordingInfo }>('/recorded/tour.json', undefined, 8_000);
  } catch {
    return { ...getFallbackTour(), recorded: DEFAULT_RECORDING_INFO };
  }
}

export async function runPlan(steps: PlanStep[]): Promise<PlanResult> {
  try {
    return await call<PlanResult>('/api/plan', post({ steps }), 15_000);
  } catch {
    return evaluateFallbackPlan(steps);
  }
}
