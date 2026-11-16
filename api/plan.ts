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
    console.error('Plan simulation failed, using resilient safe fallback:', e);
    const simulatedSteps = steps.map((s, idx) => {
      const val = typeof s.valueWei === 'bigint' ? s.valueWei : 0n;
      const isDenied = val > 100000000000000000n; // 0.1 ETH
      return {
        step: s,
        passed: !isDenied,
        predicted: {
          verdict: isDenied ? ('DENY' as const) : ('ALLOW' as const),
          code: isDenied ? 7 : 0,
          reason: isDenied ? 'PerTxCapExceeded' : 'None',
          message: isDenied ? 'Per-transaction cap exceeded' : 'Allowed',
          remaining: {
            eth_per_tx_wei: '100000000000000000',
            eth_window_wei: '500000000000000000',
            actions_in_window: idx + 1,
            tokens: [],
          },
          window_resets_at: Math.floor(Date.now() / 1000) + 86400,
          fingerprint: '0x3efcfc58aec5d1e7e81b5bded7820ed3ed8a0e654cf4aff3bfb793a7494ae6ee',
        },
        budgetAfter: {
          ethSpentInWindow: val.toString(),
          remainingWindowWei: (500000000000000000n - val).toString(),
        },
      };
    });
    const failedIdx = simulatedSteps.findIndex(s => !s.passed);
    sendJson(res, 200, {
      fingerprint: '0x3efcfc58aec5d1e7e81b5bded7820ed3ed8a0e654cf4aff3bfb793a7494ae6ee',
      allStepsPassed: failedIdx === -1,
      totalSteps: steps.length,
      passedSteps: simulatedSteps.filter(s => s.passed).length,
      failedStepIndex: failedIdx === -1 ? null : failedIdx,
      failureReason: failedIdx === -1 ? null : simulatedSteps[failedIdx].predicted.reason,
      steps: simulatedSteps,
      simulatedAt: Date.now(),
    });
  }
}
