import { runDemo } from './_lib/leash';
import { errorMessage, sendJson, type Req, type Res } from './_lib/http';

/** GET or POST /api/demo: runs the 5-transaction scenario on a fresh in-memory chain. */
export default async function handler(req: Req, res: Res): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'Use GET or POST.' });
  }
  try {
    sendJson(res, 200, await runDemo());
  } catch (e) {
    console.error('demo failed', e);
    sendJson(res, 500, { error: errorMessage(e) });
  }
}
