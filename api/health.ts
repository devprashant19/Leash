import { engine } from './_lib/load';
import { errorMessage, sendJson, type Req, type Res } from './_lib/http';

/**
 * GET /api/health: which predictor is in use, its version, and the policy fingerprint it computes.
 * The engine is loaded lazily so that a failure to load it is reported as JSON, not a crashed function.
 */
export default async function handler(_req: Req, res: Res): Promise<void> {
  try {
    const info = engine().cliInfo();
    sendJson(res, 200, { ok: true, predictionSource: info.source, cliVersion: info.version, fingerprint: info.fingerprint });
  } catch (e) {
    sendJson(res, 500, { ok: false, error: errorMessage(e) });
  }
}
