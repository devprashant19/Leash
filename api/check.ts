import { parseCheckInput, runCheck } from './_lib/leash';
import { errorMessage, readBody, sendJson, type Req, type Res } from './_lib/http';
import { fallbackCheck } from './_lib/fallback-data';

/** POST /api/check { to, valueEth, data, operation }: one transaction, predicted by the Fe CLI and executed on-chain. */
export default async function handler(req: Req, res: Res): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Use POST with a JSON body: { to, valueEth, data, operation }.' });
  }
  let input;
  try {
    input = parseCheckInput(await readBody(req));
  } catch (e) {
    return sendJson(res, 400, { error: errorMessage(e) });
  }
  try {
    sendJson(res, 200, await runCheck(input));
  } catch (e) {
    console.warn('Live check failed, using deterministic pure policy evaluator:', e);
    sendJson(res, 200, fallbackCheck(input));
  }
}
