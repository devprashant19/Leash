import type { CheckResult, DemoResult, Health, RecordedRun, TourResult } from './types';

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new Error('The server could not be reached. Check your connection and try again.');
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new Error(`The server answered ${res.status} without JSON.`);
  }
  if (!res.ok) {
    const msg = body && typeof body === 'object' && 'error' in body ? String((body as { error: unknown }).error) : `The server answered ${res.status}.`;
    throw new Error(msg);
  }
  return body as T;
}

export const getHealth = () => call<Health>('/api/health');
export const runDemo = () => call<DemoResult>('/api/demo', { method: 'POST' });
export const runTour = () => call<TourResult>('/api/tour', { method: 'POST' });
export const runCheck = (body: { to: string; valueEth: string; data: string; operation: string }) =>
  call<CheckResult>('/api/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const getRecordedRun = () => call<RecordedRun>('/run.json');
