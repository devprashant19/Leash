import assert from 'node:assert/strict';
import { PlanSimulator, type PlanStepProposal } from '../../demo/lib/plan-simulator';

console.log('--- Plan Simulator Test Suite ---');

// Case 1: Perfectly valid plan under 24h budget
const plan1: PlanStepProposal[] = [
  { id: 1, description: 'Pay 0.05 ETH', to: '0x2000000000000000000000000000000000000002', valueWei: 50000000000000000n },
  { id: 2, description: 'Pay 0.05 ETH', to: '0x2000000000000000000000000000000000000002', valueWei: 50000000000000000n },
  { id: 3, description: 'Pay 0.05 ETH', to: '0x2000000000000000000000000000000000000002', valueWei: 50000000000000000n },
];

const report1 = PlanSimulator.simulatePlan(plan1);
assert.equal(report1.allStepsPassed, true);
assert.equal(report1.passedSteps, 3);
assert.equal(report1.failedStepIndex, null);
console.log('  PASS Case 1: Valid multi-tx plan passes cleanly');

// Case 2: Cumulative window overflow on step 6
// 6 transfers of 0.09 ETH: steps 1-5 = 0.45 ETH (ok), step 6 = 0.54 ETH > 0.5 ETH cap
const plan2: PlanStepProposal[] = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  description: `Chunk #${i + 1} of 0.09 ETH`,
  to: '0x2000000000000000000000000000000000000002',
  valueWei: 90000000000000000n, // 0.09 ETH
}));

const report2 = PlanSimulator.simulatePlan(plan2);
assert.equal(report2.allStepsPassed, false);
assert.equal(report2.passedSteps, 5);
assert.equal(report2.failedStepIndex, 5); // 0-indexed: step 6 failed
assert.equal(report2.steps[5].predicted.reason, 'WindowCapExceeded');
console.log('  PASS Case 2: Cumulative window overflow halts execution on step 6 (WindowCapExceeded)');

// Case 3: Rogue target diversion mid-plan
const plan3: PlanStepProposal[] = [
  { id: 1, description: 'Safe call', to: '0x2000000000000000000000000000000000000002', valueWei: 10000000000000000n },
  { id: 2, description: 'Diverted call', to: '0x3333333333333333333333333333333333333333', valueWei: 10000000000000000n },
  { id: 3, description: 'Subsequent call', to: '0x2000000000000000000000000000000000000002', valueWei: 10000000000000000n },
];

const report3 = PlanSimulator.simulatePlan(plan3);
assert.equal(report3.allStepsPassed, false);
assert.equal(report3.failedStepIndex, 1);
assert.equal(report3.steps[1].predicted.reason, 'TargetNotAllowed');
console.log('  PASS Case 3: Mid-plan diversion caught and flagged on step 2');

console.log('All plan simulator unit tests passed!');
