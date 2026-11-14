import {
  predictVerdict,
  type CheckOptions,
  type LeashCheckResult,
  GOLDEN_FINGERPRINT,
} from './leash-cli';

export interface PlanStepProposal {
  id: string | number;
  description: string;
  to: `0x${string}`;
  valueWei?: bigint;
  data?: `0x${string}`;
  operation?: 'call' | 'delegatecall';
}

export interface PlanSimulationStepResult {
  step: PlanStepProposal;
  predicted: LeashCheckResult;
  passed: boolean;
  budgetAfter: {
    ethSpentInWindow: string;
    remainingWindowWei: string;
  };
}

export interface PlanSimulationReport {
  fingerprint: string;
  allStepsPassed: boolean;
  totalSteps: number;
  passedSteps: number;
  failedStepIndex: number | null;
  failureReason: string | null;
  steps: PlanSimulationStepResult[];
  simulatedAt: number;
}

export class PlanSimulator {
  /**
   * Simulates a multi-transaction agent execution plan sequentially.
   */
  static simulatePlan(steps: PlanStepProposal[], startTime: number = Math.floor(Date.now() / 1000)): PlanSimulationReport {
    const results: PlanSimulationStepResult[] = [];
    let allPassed = true;
    let failedIndex: number | null = null;
    let failureReason: string | null = null;

    let cumulativeEthSpent = 0n;
    const windowCap = 500_000_000_000_000_000n; // 0.5 ETH

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const val = step.valueWei || 0n;
      const now = startTime + i * 15; // 15s between steps

      const pred = predictVerdict({
        to: step.to,
        valueWei: val,
        data: step.data,
        op: step.operation || 'call',
        now,
      });

      // Also check running cumulative window spend in this plan
      let stepPassed = pred.verdict === 'ALLOW';
      let effectiveVerdict = pred;

      if (stepPassed && (cumulativeEthSpent + val > windowCap)) {
        stepPassed = false;
        effectiveVerdict = {
          ...pred,
          verdict: 'DENY',
          code: 8,
          reason: 'WindowCapExceeded',
          message: `Plan execution would breach 24h rolling budget of 0.5 ETH (attempted: ${cumulativeEthSpent + val} wei)`,
        };
      }

      if (stepPassed) {
        cumulativeEthSpent += val;
      } else if (allPassed) {
        allPassed = false;
        failedIndex = i;
        failureReason = `${effectiveVerdict.reason} (code ${effectiveVerdict.code}): ${effectiveVerdict.message}`;
      }

      const remainingWei = windowCap > cumulativeEthSpent ? windowCap - cumulativeEthSpent : 0n;

      results.push({
        step,
        predicted: effectiveVerdict,
        passed: stepPassed,
        budgetAfter: {
          ethSpentInWindow: cumulativeEthSpent.toString(),
          remainingWindowWei: remainingWei.toString(),
        },
      });
    }

    return {
      fingerprint: GOLDEN_FINGERPRINT,
      allStepsPassed: allPassed,
      totalSteps: steps.length,
      passedSteps: results.filter((r) => r.passed).length,
      failedStepIndex: failedIndex,
      failureReason,
      steps: results,
      simulatedAt: startTime,
    };
  }
}
