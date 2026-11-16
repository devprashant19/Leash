import { errorMessage, sendJson, type Req, type Res } from './_lib/http';

/**
 * GET /api/health: which predictor is in use, its version, and the policy fingerprint it computes.
 * The engine is loaded lazily so that a failure to load it is reported as JSON, not a crashed function.
 */
export default async function handler(_req: Req, res: Res): Promise<void> {
  try {
    const { cliInfo } = await import('./_lib/leash');
    const info = cliInfo();
    sendJson(res, 200, { ok: true, predictionSource: info.source, cliVersion: info.version, fingerprint: info.fingerprint });
  } catch (e) {
    const stack = e instanceof Error && e.stack ? e.stack.split('\n').slice(0, 6).map((l) => l.trim()) : [];
    sendJson(res, 500, { ok: false, error: errorMessage(e), stack, node: process.version });
  }
}
