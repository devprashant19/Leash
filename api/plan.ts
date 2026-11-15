import { PlanSimulator, type PlanStepProposal } from '../demo/lib/plan-simulator';
import { errorMessage, readBody, sendJson, type Req, type Res } from './_lib/http';

export default async function handler(req: Req, res: Res): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Use POST with JSON body: { steps: [...] }' });
  }

  let body: any;
  try {
    body = await readBody(req);
  } catch (e) {
    return sendJson(res, 400, { error: errorMessage(e) });
  }

  const steps: PlanStepProposal[] = Array.isArray(body?.steps) ? body.steps : [];
  if (steps.length === 0) {
    return sendJson(res, 400, { error: 'Provide at least one step in "steps" array.' });
  }

  try {
    const report = PlanSimulator.simulatePlan(steps);
    sendJson(res, 200, report);
  } catch (e) {
    console.error('Plan simulation failed:', e);
    sendJson(res, 500, { error: errorMessage(e) });
  }
}
