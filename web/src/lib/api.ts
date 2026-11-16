import type { CheckResult, DemoResult, Health, RecordedRun, TourResult } from './types';

/**
 * Typed fetch. A failure is reported as an error, never replaced by invented results.
 * Timeouts are generous: a cold serverless function needs a few seconds to boot the EVM
 * (measured 2.4–4.5 s on Vercel's runtime), and the functions may run for up to 60 s.
 */
async function call<T>(path: string, init?: RequestInit, timeoutMs = 58_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(path, { ...init, signal: controller.signal });
  } catch (e) {
    throw new Error((e as Error).name === 'AbortError'
      ? `The server did not answer within ${Math.round(timeoutMs / 1000)} s.`
      : 'The server could not be reached. Check your connection and try again.');
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

export const getHealth = () => call<Health>('/api/health', undefined, 20_000);
export const runDemo = () => call<DemoResult>('/api/demo', post());
export const runTour = () => call<TourResult>('/api/tour', post());
export const runCheck = (body: { to: string; valueEth: string; data: string; operation: string }) => call<CheckResult>('/api/check', post(body));
export const getRecordedRun = () => call<RecordedRun>('/run.json', undefined, 15_000);

/** A real run saved earlier (web/public/recorded/*.json), replayed only when the live server is unavailable. */
export interface RecordingInfo { capturedAt: string; runtime: string; note: string }
export const getRecordedDemo = () => call<DemoResult & { recorded: RecordingInfo }>('/recorded/demo.json', undefined, 15_000);
export const getRecordedTour = () => call<TourResult & { recorded: RecordingInfo }>('/recorded/tour.json', undefined, 15_000);

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
export const runPlan = (steps: PlanStep[]) => call<PlanResult>('/api/plan', post({ steps }));
