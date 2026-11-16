import { engine } from './_lib/load';
import { errorMessage, readBody, sendJson, type Req, type Res } from './_lib/http';

/**
 * POST /api/plan { steps: [{ description?, to, valueEth?, data?, operation? }, …] } (up to 12 steps):
 * runs the whole plan on a fresh chain; every step is predicted by the Fe CLI and decided by LeashModule.
 */
export default async function handler(req: Req, res: Res): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Use POST with a JSON body: { "steps": [ { "to": "0x…", "valueEth": "0.05" } ] }.' });
  }
  let plan;
  try {
    plan = engine().parsePlan(await readBody(req));
  } catch (e) {
    return sendJson(res, 400, { error: errorMessage(e) });
  }
  try {
    sendJson(res, 200, await engine().runPlan(plan));
  } catch (e) {
    console.error('plan failed', e);
    sendJson(res, 500, { error: errorMessage(e) });
  }
}
