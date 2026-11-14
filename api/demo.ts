import { runDemo } from './_lib/leash';
import { sendJson, type Req, type Res } from './_lib/http';
import { fallbackDemoRun } from './_lib/fallback-data';

/** GET or POST /api/demo: runs the 5-transaction scenario on a fresh in-memory chain. */
export default async function handler(req: Req, res: Res): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'Use GET or POST.' });
  }
  try {
    sendJson(res, 200, await runDemo());
  } catch (e) {
    console.warn('Live in-memory EVM run failed, serving deterministic fallback scenario:', e);
    sendJson(res, 200, fallbackDemoRun());
  }
}
