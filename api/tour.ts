import { runTour } from './_lib/tour';
import { errorMessage, sendJson, type Req, type Res } from './_lib/http';

/** GET or POST /api/tour: every rule the module enforces, plus guardian pause, breaker reset and session expiry, on one fresh chain. */
export default async function handler(req: Req, res: Res): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'Use GET or POST.' });
  }
  try {
    sendJson(res, 200, await runTour());
  } catch (e) {
    console.error('tour failed', e);
    sendJson(res, 500, { error: errorMessage(e) });
  }
}
