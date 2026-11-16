import { cliInfo } from './_lib/leash';
import { errorMessage, sendJson, type Req, type Res } from './_lib/http';

/** GET /api/health: which predictor is in use, its version, and the policy fingerprint it computes. */
export default async function handler(_req: Req, res: Res): Promise<void> {
  try {
    const info = cliInfo();
    sendJson(res, 200, { ok: true, predictionSource: info.source, cliVersion: info.version, fingerprint: info.fingerprint });
  } catch (e) {
    sendJson(res, 500, { ok: false, error: errorMessage(e) });
  }
}
