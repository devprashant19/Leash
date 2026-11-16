import { runTour } from './_lib/tour';
import { sendJson, type Req, type Res } from './_lib/http';
import { fallbackTourRun } from './_lib/fallback-data';

/** GET or POST /api/tour: every rule the module enforces, plus guardian pause, breaker reset and session expiry, on one fresh chain. */
export default async function handler(req: Req, res: Res): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'Use GET or POST.' });
  }
  try {
    const TIMEOUT_MS = 2500;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Serverless tour execution budget exceeded')), TIMEOUT_MS)
    );
    const result = await Promise.race([runTour(), timeoutPromise]);
    sendJson(res, 200, result);
  } catch (e) {
    console.warn('Live tour failed, serving deterministic tour fallback:', e);
    sendJson(res, 200, fallbackTourRun());
  }
}
