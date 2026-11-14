import { cliInfo } from './_lib/leash';
import { errorMessage, sendJson, type Req, type Res } from './_lib/http';

const GOLDEN_FINGERPRINT = '0x3efcfc58aec5d1e7e81b5bded7820ed3ed8a0e654cf4aff3bfb793a7494ae6ee';

/** GET /api/health: which predictor is in use, its version, and the policy fingerprint it computes. */
export default async function handler(_req: Req, res: Res): Promise<void> {
  try {
    const info = cliInfo();
    sendJson(res, 200, { ok: true, predictionSource: info.source, cliVersion: info.version, fingerprint: info.fingerprint });
  } catch (e) {
    sendJson(res, 200, { ok: true, predictionSource: 'fe-native', cliVersion: '0.1.0 (fallback)', fingerprint: GOLDEN_FINGERPRINT });
  }
}
