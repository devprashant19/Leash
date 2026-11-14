import type { CheckResult, DemoResult, Health, RecordedRun, TourResult } from './types';

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new Error('The server could not be reached. Check your connection or run "npm run dev:web".');
  }

  const rawText = await res.text();
  let body: unknown;
  try {
    body = rawText ? JSON.parse(rawText) : null;
  } catch {
    // Non-JSON response (e.g. HTML error page or proxy error)
    const snippet = rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
    const detail = snippet ? `: ${snippet}` : '.';
    if (res.status === 500) {
      throw new Error(`Server error (500)${detail} Ensure the API backend is running with "npm run dev:web".`);
    }
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      throw new Error(`API gateway error (${res.status})${detail} Check that the backend server is active.`);
    }
    throw new Error(`The server answered ${res.status}${detail}`);
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

export const getHealth = () => call<Health>('/api/health');
export const runDemo = () => call<DemoResult>('/api/demo', { method: 'POST' });
export const runTour = () => call<TourResult>('/api/tour', { method: 'POST' });
export const runCheck = (body: { to: string; valueEth: string; data: string; operation: string }) =>
  call<CheckResult>('/api/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const getRecordedRun = () => call<RecordedRun>('/run.json');
