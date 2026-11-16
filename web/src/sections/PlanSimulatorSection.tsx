import { useState } from 'react';
import { motion } from 'motion/react';
import { Eyebrow, Button } from '../ui/Button';
import { runPlan, type PlanResult, type PlanStep } from '../lib/api';
import { TOKEN, TREASURY } from '../lib/data';
import { short } from '../lib/store';

const pad = (h: string) => h.replace(/^0x/, '').padStart(64, '0');
const tokens = (n: number) => (BigInt(n) * 10n ** 18n).toString(16);

const PLANS: Array<{ title: string; note: string; steps: PlanStep[] }> = [
  {
    title: 'Three small payments',
    note: 'Each 0.05 ETH, 0.15 ETH in total: inside every limit.',
    steps: [1, 2, 3].map((i) => ({ description: `Pay 0.05 ETH (#${i})`, to: TREASURY, valueEth: '0.05' })),
  },
  {
    title: 'Six 0.09 ETH payments',
    note: 'Every call is under the 0.1 ETH cap, but the sixth would take the day past 0.5 ETH.',
    steps: [1, 2, 3, 4, 5, 6].map((i) => ({ description: `Pay 0.09 ETH (#${i})`, to: TREASURY, valueEth: '0.09' })),
  },
  {
    title: 'A diversion in the middle',
    note: 'A prompt-injected call to an unlisted contract is refused; the plan around it still runs.',
    steps: [
      { description: 'Pay 0.02 ETH', to: TREASURY, valueEth: '0.02' },
      { description: 'Send to an unlisted contract', to: '0xdead000000000000000000000000000000000001', valueEth: '0.01' },
      { description: 'Transfer 20 tokens', to: TOKEN, valueEth: '0', data: '0xa9059cbb' + pad(TREASURY) + pad(tokens(20)) },
    ],
  },
  {
    title: 'Three bad calls trip the breaker',
    note: 'After three refusals the module stops the agent, even for a harmless payment.',
    steps: [
      { description: 'Send to an unlisted contract', to: '0xdead000000000000000000000000000000000001', valueEth: '0' },
      { description: 'Pay 0.2 ETH (over the cap)', to: TREASURY, valueEth: '0.2' },
      { description: 'Delegatecall into the treasury', to: TREASURY, valueEth: '0', operation: 'delegatecall' },
      { description: 'Pay 0.01 ETH', to: TREASURY, valueEth: '0.01' },
    ],
  },
];

const eth = (wei?: string) => (wei ? (Number(BigInt(wei) / 10n ** 12n) / 1e6).toString() : '–');

/** Runs a whole multi-step plan on a fresh chain via /api/plan: Fe CLI prediction and module decision per step. */
export function PlanSimulatorSection() {
  const [sel, setSel] = useState(1);
  const [text, setText] = useState(() => JSON.stringify(PLANS[1].steps, null, 2));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<PlanResult | null>(null);

  const pick = (i: number) => { setSel(i); setText(JSON.stringify(PLANS[i].steps, null, 2)); setReport(null); setError(null); };
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      let steps: PlanStep[];
      try { steps = JSON.parse(text); } catch { throw new Error('The plan is not valid JSON.'); }
      setReport(await runPlan(steps));
    } catch (e) {
      setReport(null);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="sec" id="plan" aria-labelledby="plan-h">
      <div className="container"><div className="inner pad plan">
        <div className="plan-head">
          <Eyebrow>Plan simulator</Eyebrow>
          <h2 className="t-h2" id="plan-h">Check a whole plan before the agent sends it.</h2>
          <p className="t-small">The server runs every step in order on a fresh chain. The Fe CLI predicts each one from the agent’s state at that point, then LeashModule decides, so the daily budget and the circuit breaker carry over exactly as they would on-chain.</p>
        </div>
        <div className="plan-grid">
          <div className="plan-left">
            <div className="plan-presets" role="radiogroup" aria-label="Example plans">
              {PLANS.map((p, i) => (
                <button key={p.title} type="button" role="radio" aria-checked={sel === i} className={`mode ${sel === i ? 'on' : ''}`} onClick={() => pick(i)} disabled={busy}>
                  <b>{p.title}</b><span>{p.note}</span>
                </button>
              ))}
            </div>
            <label className="fld wide">
              <span className="t-mono">Plan (JSON, up to 12 steps · to, valueEth, data, operation)</span>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} spellCheck={false} />
            </label>
            <div><Button label={busy ? 'Running the plan…' : 'Run the plan'} busy={busy} disabled={busy} onClick={run} /></div>
          </div>
          <div className="plan-out" aria-live="polite">
            {error && <div className="bubble err" role="alert">The plan did not run: {error}</div>}
            {!error && !report && <p className="t-small chat-empty">Pick a plan or edit the JSON, then run it.</p>}
            {report && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <div className="plan-sum">
                  <span className={`verdict ${report.firstDenied ? 'deny' : 'allow'}`}>{report.firstDenied ? `Refused at step ${report.firstDenied}` : 'Every step allowed'}</span>
                  <span className="t-small">{report.allowedCount}/{report.steps.length} steps executed · {report.allMatched ? 'every prediction matched' : 'a prediction differed'} · {report.predictionSource === 'fe-native' ? 'Fe-built binary' : 'TypeScript mirror'} · {(report.elapsedMs / 1000).toFixed(2)} s</span>
                </div>
                <ol className="plan-steps">
                  {report.steps.map((s) => {
                    const ok = s.onchain.verdict === 'ALLOW';
                    return (
                      <li key={s.i} className={ok ? 'ok' : 'no'}>
                        <span className="t-code">{String(s.i).padStart(2, '0')}</span>
                        <div className="plan-desc"><div>{s.description}</div><div className="t-code step-meta">to {short(s.to)} · {s.valueEth} ETH{s.operation === 'delegatecall' ? ' · delegatecall' : ''} · budget left before: {eth(s.remaining?.eth_window_wei)} ETH</div></div>
                        <span className={`verdict ${s.predicted.verdict === 'ALLOW' ? 'allow' : 'deny'}`}>{s.predicted.verdict}{s.predicted.verdict === 'DENY' && <em>{s.predicted.reason}</em>}</span>
                        <span className={`verdict ${ok ? 'allow' : 'deny'}`}>{s.onchain.verdict}{!ok && <em>{s.onchain.reason}</em>}</span>
                        <span className={s.matched ? 'up' : 'down'} aria-label={s.matched ? 'prediction matched' : 'prediction differed'}>{s.matched ? '✓' : '✗'}</span>
                      </li>
                    );
                  })}
                </ol>
                <p className="t-small plan-legend">Columns: Fe CLI prediction · LeashModule decision · match.</p>
              </motion.div>
            )}
          </div>
        </div>
      </div></div>
    </section>
  );
}
