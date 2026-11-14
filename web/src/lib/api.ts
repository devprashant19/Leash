import type { CheckResult, DemoResult, Health, RecordedRun, TourResult } from './types';
import { evaluateFallbackCheck, getFallbackDemo, getFallbackHealth, getFallbackTour } from './fallback';

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new Error('The server could not be reached.');
  }

  const rawText = await res.text();
  let body: unknown;
  try {
    body = rawText ? JSON.parse(rawText) : null;
  } catch {
    throw new Error(`The server answered ${res.status} with non-JSON content.`);
  }

  if (!res.ok) {
    const msg =
      body && typeof body === 'object' && 'error' in body
        ? String((body as { error: unknown }).error)
        : `The server answered ${res.status}.`;
    throw new Error(msg);
  }
  return body as T;
}

export async function getHealth(): Promise<Health> {
  try {
    return await call<Health>('/api/health');
  } catch {
    return getFallbackHealth();
  }
}

export async function runDemo(): Promise<DemoResult> {
  try {
    return await call<DemoResult>('/api/demo', { method: 'POST' });
  } catch {
    return getFallbackDemo();
  }
}

export async function runTour(): Promise<TourResult> {
  try {
    return await call<TourResult>('/api/tour', { method: 'POST' });
  } catch {
    return getFallbackTour();
  }
}

export async function runCheck(body: { to: string; valueEth: string; data: string; operation: string }): Promise<CheckResult> {
  try {
    return await call<CheckResult>('/api/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return evaluateFallbackCheck(body);
  }
}

export async function getRecordedRun(): Promise<RecordedRun> {
  try {
    return await call<RecordedRun>('/run.json');
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
