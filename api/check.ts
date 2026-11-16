import { engine } from './_lib/load';
import { errorMessage, readBody, sendJson, type Req, type Res } from './_lib/http';

/** POST /api/check { to, valueEth, data, operation }: one transaction, predicted by the Fe CLI and executed on-chain. */
export default async function handler(req: Req, res: Res): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Use POST with a JSON body: { to, valueEth, data, operation }.' });
  }
  let input;
  try {
    input = engine().parseCheckInput(await readBody(req));
  } catch (e) {
    return sendJson(res, 400, { error: errorMessage(e) });
  }
  try {
    sendJson(res, 200, await engine().runCheck(input));
  } catch (e) {
    console.error('check failed', e);
    sendJson(res, 500, { error: errorMessage(e) });
  }
}
