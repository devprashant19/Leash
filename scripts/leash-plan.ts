#!/usr/bin/env node
import fs from 'node:fs';
import { PlanSimulator, type PlanStepProposal } from '../demo/lib/plan-simulator.js';

const samplePlan: PlanStepProposal[] = [
  {
    id: 1,
    description: 'Initial treasury deposit (0.05 ETH)',
    to: '0x2000000000000000000000000000000000000002',
    valueWei: 50000000000000000n,
  },
  {
    id: 2,
    description: 'Second treasury transfer (0.05 ETH)',
    to: '0x2000000000000000000000000000000000000002',
    valueWei: 50000000000000000n,
  },
  {
    id: 3,
    description: 'Third treasury transfer (0.05 ETH)',
    to: '0x2000000000000000000000000000000000000002',
    valueWei: 50000000000000000n,
  },
];

const fileArg = process.argv[2];
let steps = samplePlan;
if (fileArg && fs.existsSync(fileArg)) {
  steps = JSON.parse(fs.readFileSync(fileArg, 'utf8'));
}

console.log('--- Leash Agent Plan Simulation ---');
console.log(`Evaluating ${steps.length} sequential steps...`);

const report = PlanSimulator.simulatePlan(steps);

console.log(`\nResult: ${report.allStepsPassed ? '✓ ALL STEPS ALLOWED' : '✗ PLAN REJECTED'}`);
console.log(`Summary: ${report.passedSteps}/${report.totalSteps} passed`);
if (report.failureReason) {
  console.log(`First failure at step ${report.failedStepIndex! + 1}: ${report.failureReason}`);
}

console.log('\nStep Details:');
for (const s of report.steps) {
  const icon = s.passed ? '✓' : '✗';
  console.log(` [${icon}] #${s.step.id}: ${s.step.description} -> ${s.predicted.verdict} (${s.predicted.reason})`);
  console.log(`     Spent: ${Number(s.budgetAfter.ethSpentInWindow) / 1e18} ETH | Remaining: ${Number(s.budgetAfter.remainingWindowWei) / 1e18} ETH`);
}
