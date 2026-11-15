import { useState } from 'react';
import { Eyebrow, Button } from '../ui/Button';
import { PlanSimulator, type PlanStepProposal, type PlanSimulationReport, type PlanSimulationStepResult } from '../lib/plan-simulator';

const PRESET_PLANS: { title: string; steps: PlanStepProposal[] }[] = [
  {
    title: '3x Small Treasury Payments (Passes)',
    steps: [
      { id: 1, description: 'Pay 0.05 ETH', to: '0x2000000000000000000000000000000000000002', valueWei: 50000000000000000n },
      { id: 2, description: 'Pay 0.05 ETH', to: '0x2000000000000000000000000000000000000002', valueWei: 50000000000000000n },
      { id: 3, description: 'Pay 0.05 ETH', to: '0x2000000000000000000000000000000000000002', valueWei: 50000000000000000n },
    ],
  },
  {
    title: '6x 0.09 ETH Window Drain (Fails at Step 6)',
    steps: Array.from({ length: 6 }, (_, i) => ({
      id: i + 1,
      description: `Chunk #${i + 1} of 0.09 ETH`,
      to: '0x2000000000000000000000000000000000000002' as `0x${string}`,
      valueWei: 90000000000000000n,
    })),
  },
  {
    title: 'Rogue Target Injection (Fails at Step 2)',
    steps: [
      { id: 1, description: 'Valid Treasury call', to: '0x2000000000000000000000000000000000000002', valueWei: 20000000000000000n },
      { id: 2, description: 'Diverted call to unlisted contract', to: '0xdead000000000000000000000000000000000001', valueWei: 10000000000000000n },
      { id: 3, description: 'Subsequent payment', to: '0x2000000000000000000000000000000000000002', valueWei: 20000000000000000n },
    ],
  },
];

export function PlanSimulatorSection() {
  const [selectedPlan, setSelectedPlan] = useState<number>(0);
  const [report, setReport] = useState<PlanSimulationReport | null>(null);

  const runSimulation = (idx: number) => {
    setSelectedPlan(idx);
    const rep = PlanSimulator.simulatePlan(PRESET_PLANS[idx].steps);
    setReport(rep);
  };

  return (
    <section className="sec plan-sim-sec" id="plan-sim" style={{ borderTop: '1px solid var(--line)', padding: '4em 2em' }}>
      <div className="container"><div className="inner">
        <div>
          <Eyebrow>Batch Verification</Eyebrow>
          <h2 className="t-h2" style={{ marginTop: '0.4em' }}>Autonomous Multi-Step Plan Simulator</h2>
          <p className="t-p dim" style={{ maxWidth: '44em', marginTop: '0.6em' }}>
            Simulate a full sequence of agent transactions before broadcasting. Predict cumulative 24h budget consumption, hourly bucket rollovers, and multi-step denials in advance.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.8em', flexWrap: 'wrap', margin: '2em 0 1.5em' }}>
          {PRESET_PLANS.map((p, idx) => (
            <Button
              key={idx}
              label={p.title}
              variant={selectedPlan === idx ? 'light' : 'ghost'}
              onClick={() => runSimulation(idx)}
            />
          ))}
        </div>

        {report && (
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: '12px', padding: '2em' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5em', borderBottom: '1px solid var(--line)', paddingBottom: '1em' }}>
              <div>
                <span className="t-mono" style={{ fontSize: '0.8em', color: 'var(--text-mute)' }}>EXECUTION OUTCOME: </span>
                <span style={{ fontWeight: 700, color: report.allStepsPassed ? 'var(--mint)' : 'var(--coral)' }}>
                  {report.allStepsPassed ? 'ALL STEPS PERMITTED' : 'EXECUTION BLOCKED'}
                </span>
                <span className="t-code" style={{ marginLeft: '1em', fontSize: '0.8em' }}>
                  ({report.passedSteps}/{report.totalSteps} steps valid)
                </span>
              </div>
              <span className="t-mono" style={{ fontSize: '0.75em', color: 'var(--violet)' }}>
                Fingerprint: {report.fingerprint.slice(0, 10)}…{report.fingerprint.slice(-6)}
              </span>
            </div>

            <div style={{ display: 'grid', gap: '0.75em' }}>
              {report.steps.map((s: PlanSimulationStepResult) => (
                <div
                  key={s.step.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '3em 1.5fr 1fr 1.2fr auto',
                    gap: '1em',
                    alignItems: 'center',
                    padding: '0.8em 1.2em',
                    background: s.passed ? 'rgba(61, 214, 140, 0.03)' : 'rgba(234, 93, 86, 0.05)',
                    border: `1px solid ${s.passed ? 'rgba(61, 214, 140, 0.15)' : 'rgba(234, 93, 86, 0.25)'}`,
                    borderRadius: '8px',
                    fontSize: '0.9em',
                  }}
                >
                  <span className="t-code" style={{ color: 'var(--text-mute)' }}>#{s.step.id}</span>
                  <div>
                    <div style={{ fontWeight: 500 }}>{s.step.description}</div>
                    <div className="t-code" style={{ fontSize: '0.75em', color: 'var(--text-mute)' }}>to {s.step.to}</div>
                  </div>
                  <div className="t-code" style={{ fontSize: '0.8em' }}>
                    Spent: {Number(s.budgetAfter.ethSpentInWindow) / 1e18} ETH
                  </div>
                  <div>
                    <span className={`verdict ${s.passed ? 'allow' : 'deny'}`}>
                      {s.predicted.verdict}
                      {!s.passed && <em>{s.predicted.reason}</em>}
                    </span>
                  </div>
                  <span style={{ color: s.passed ? 'var(--mint)' : 'var(--coral)', fontWeight: 700 }}>
                    {s.passed ? '✓' : '✗'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div></div>
    </section>
  );
}
