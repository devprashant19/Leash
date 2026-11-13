import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Button, Eyebrow } from '../ui/Button';
import { Chars, Fade, Reveal, T } from '../motion/Reveal';
import { Odometer } from '../motion/Odometer';
import { DitherArt } from '../gfx/Art';
import { Grid } from '../motion/Ambient';
import { reasonOf, scrollToId, short, useStore, type DemoMode } from '../lib/store';
import { REASONS } from '../lib/data';
import { SetupProgress, Walkthrough, quickChapters, type Chapter, type Item } from './Walkthrough';
import type { Balances, StepResult, TourResult, TourTx } from '../lib/types';

const EASE = [0.25, 0.46, 0.45, 0.94] as const;

interface Row { i: number; label: string; allow: boolean; code: number; gas: number; matched: boolean }

function useRows(): Row[] {
  const { result, recorded } = useStore();
  return useMemo(() => {
    if (result) return result.steps.map((s) => ({ i: s.i, label: s.description, allow: s.onchain.verdict === 'ALLOW', code: s.onchain.code, gas: Number(s.onchain.gasUsed), matched: s.matched }));
    if (recorded) return recorded.steps.map((s) => ({ i: s.i, label: s.description, allow: s.onchain === 'ALLOW', code: s.onchainCode, gas: Number(s.gasUsed), matched: s.matched }));
    return [];
  }, [result, recorded]);
}

/** Dashboard tile: idles by cycling the transactions every 1.7 s; chips swap 100 ms apart, bars re-weight. */
function Mosaic() {
  const rows = useRows();
  const { result, recorded, status } = useStore();
  const [k, setK] = useState(0);
  useEffect(() => {
    if (!rows.length) return;
    const id = window.setInterval(() => setK((v) => (v + 1) % rows.length), status === 'running' ? 600 : 1700);
    return () => window.clearInterval(id);
  }, [rows.length, status]);
  const cur = rows[k % Math.max(1, rows.length)];
  const maxGas = Math.max(1, ...rows.map((r) => r.gas));
  const fpA = result?.fingerprintCli ?? recorded?.fingerprintCli ?? '';
  const fpB = result?.fingerprintChain ?? recorded?.fingerprintChain ?? '';
  const chips = cur ? [
    ['TX', String(cur.i)],
    ['VERDICT', cur.allow ? 'ALLOW' : 'DENY'],
    ['CODE', `${String(cur.code).padStart(2, '0')}`],
    ['GAS', cur.gas.toLocaleString('en-US')],
  ] : [];
  return (
    <div className={`mosaic ${status === 'running' ? 'busy' : ''}`} aria-hidden="true">
      <Grid seed={33} dots={5} />
      <div className="mz-chips">
        {chips.map(([kx, v], j) => (
          <div className="chip" key={kx}>{kx}
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.b key={`${kx}-${v}`} initial={{ y: 10, opacity: 0, filter: 'blur(6px)' }} animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                exit={{ y: -10, opacity: 0, filter: 'blur(6px)' }} transition={{ duration: 0.45, delay: j * 0.1, ease: EASE }}
                className={kx === 'VERDICT' ? (cur.allow ? 'is-allow' : 'is-deny') : ''}>{v}</motion.b>
            </AnimatePresence>
          </div>
        ))}
      </div>
      <div className="mz-agent"><DitherArt kind="agent" /></div>
      <svg className="mz-bars" viewBox="0 0 300 140" preserveAspectRatio="none">
        {rows.map((r, j) => {
          const h = 20 + (r.gas / maxGas) * 100;
          const x = 18 + j * 58;
          return (
            <g key={j} opacity={j === k % rows.length ? 1 : 0.42} style={{ transition: 'opacity .4s' }}>
              <motion.rect x={x} width="26" fill={r.allow ? 'var(--violet)' : 'var(--violet-deep)'} initial={false} animate={{ y: 140 - h, height: h }} transition={{ type: 'spring', stiffness: 120, damping: 18 }} />
              {!r.allow && <motion.rect x={x} width="26" height="5" fill="var(--coral)" initial={false} animate={{ y: 140 - h - 7 }} transition={{ type: 'spring', stiffness: 120, damping: 18 }} />}
            </g>
          );
        })}
      </svg>
      <div className="mz-stack"><DitherArt kind="stack" /></div>
      <div className="mz-fp">
        <div className="t-mono">FINGERPRINT</div>
        <div className="mz-fp-row"><span className="t-code">CLI</span><span className="t-code">{short(fpA, 8, 6)}</span></div>
        <div className="mz-fp-row"><span className="t-code">CHAIN</span><span className="t-code">{short(fpB, 8, 6)}</span></div>
        <svg viewBox="0 0 200 40" className="mz-fp-svg"><path d="M2 8 C 70 8, 90 20, 120 20 L 198 20" /><path d="M2 32 C 70 32, 90 20, 120 20" /><rect x="118" y="16" width="8" height="8" /></svg>
        <div className="t-mono mz-fp-eq">{fpA && fpA === fpB ? '= IDENTICAL' : fpA ? '≠ DIFFERENT' : '…'}</div>
      </div>
    </div>
  );
}

function Verdict({ allow, reason, delay }: { allow: boolean; reason: string; delay: number }) {
  return (
    <motion.span className={`verdict ${allow ? 'allow' : 'deny'}`} initial={{ rotateX: 90, opacity: 0 }} animate={{ rotateX: 0, opacity: 1 }} transition={{ duration: 0.5, delay, ease: EASE }}>
      {allow ? 'ALLOW' : 'DENY'}{!allow && <em>{reason}</em>}
    </motion.span>
  );
}

function Tick({ ok, delay }: { ok: boolean; delay: number }) {
  return (
    <svg viewBox="0 0 24 24" className={`tick ${ok ? 'ok' : 'bad'}`} role="img" aria-label={ok ? 'Prediction matched' : 'Prediction did not match'}>
      <motion.path d={ok ? 'M4 12.5 L9.5 18 L20 6' : 'M6 6 L18 18 M18 6 L6 18'} fill="none" strokeWidth="2.4" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay }} />
    </svg>
  );
}

function StepRow({ s, k }: { s: StepResult; k: number }) {
  const d = 0.15 + k * 0.22;
  const value = s.valueEth !== '0' ? `${s.valueEth} ETH` : '0 ETH';
  return (
    <motion.li className="step" initial={{ opacity: 0, y: 24, filter: 'blur(10px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.6, delay: d, ease: EASE }}>
      <span className="step-n t-code">{String(s.i).padStart(2, '0')}</span>
      <div className="step-desc">
        <div>{s.description}</div>
        <div className="t-code step-meta">to {short(s.to)} · {value} · {s.operation}{s.data !== '0x' ? ` · ${s.data.slice(0, 10)}` : ''}</div>
      </div>
      <div className="step-col"><div className="t-mono">Fe CLI predicted</div><Verdict allow={s.predicted.verdict === 'ALLOW'} reason={s.predicted.reason} delay={d + 0.25} /></div>
      <div className="step-col"><div className="t-mono">LeashModule decided</div><Verdict allow={s.onchain.verdict === 'ALLOW'} reason={s.onchain.reason} delay={d + 0.4} />
        <div className="t-code step-tx">tx {short(s.onchain.txHash)} · {Number(s.onchain.gasUsed).toLocaleString('en-US')} gas</div></div>
      <Tick ok={s.matched} delay={d + 0.6} />
    </motion.li>
  );
}

function BalanceTable({ a, b }: { a: Balances; b: Balances }) {
  const rows: Array<[string, string, string]> = [
    ['Safe · ETH', a.safeEth, b.safeEth], ['Treasury · ETH', a.treasuryEth, b.treasuryEth],
    ['Safe · tokens', a.safeTokens, b.safeTokens], ['Treasury · tokens', a.treasuryTokens, b.treasuryTokens],
  ];
  return (
    <table className="bal">
      <thead><tr><th>Account</th><th>Before</th><th>After</th><th>Change</th></tr></thead>
      <tbody>
        {rows.map(([k, x, y]) => {
          const dlt = Number(y) - Number(x);
          return (
            <tr key={k}><td>{k}</td><td className="t-code">{x}</td><td className="t-code">{y}</td>
              <td className={`t-code ${dlt > 0 ? 'up' : dlt < 0 ? 'down' : ''}`}>{dlt ? `${dlt > 0 ? '+' : ''}${+dlt.toFixed(6)}` : '–'}</td></tr>
          );
        })}
      </tbody>
    </table>
  );
}

const TOUR_FEATURES = [
  'ETH payment', 'token transfer', 'bounded approval', 'per-transaction cap', 'target allowlist', 'unlimited approval',
  'circuit breaker + owner reset', 'token cap', 'selector allowlist', 'malformed calldata', 'delegatecall',
  'rolling 24 h budget', 'guardian pause + owner unpause', 'session expiry',
];

function tourChapters(t: TourResult): Chapter[] {
  return t.chapters.map((c) => ({
    title: c.title,
    intro: c.intro,
    items: c.items.map((x): Item => (x.kind === 'tx' ? { kind: 'tx', step: x, feature: x.feature, why: x.why } : x)),
  }));
}

function TourSummary({ t }: { t: TourResult }) {
  const txs = t.chapters.flatMap((c) => c.items).filter((x): x is TourTx => x.kind === 'tx');
  return (
    <>
      <div className="demo-sum">
        <div><div className="t-mono">Predictions matched</div><div className={`t-h2 ${t.matchedCount === t.txCount ? 'ok' : 'bad'}`}><Odometer value={`${t.matchedCount}/${t.txCount}`} play /></div></div>
        <div><div className="t-mono">Verdicts the policy demands</div><div className={`t-h2 ${t.expectedCount === t.txCount ? 'ok' : 'bad'}`}><Odometer value={`${t.expectedCount}/${t.txCount}`} play /></div></div>
        <div><div className="t-mono">Predicted by</div><div className="t-h4">{t.predictionSource === 'fe-native' ? 'Fe-built binary' : 'TypeScript mirror'}</div><div className="t-code demo-sub">{t.cliVersion}</div></div>
        <div><div className="t-mono">Run time</div><div className="t-h2"><Odometer value={(t.elapsedMs / 1000).toFixed(2)} play />s</div></div>
      </div>
      <div className="tour-codes">
        <div className="t-mono demo-foot-h">Deny codes this run produced (they are lit in the grid above)</div>
        <div className="tour-code-list">
          {t.codesCovered.map((c) => <span key={c} className={`verdict ${c === 0 ? 'allow' : 'deny'}`}>{String(c).padStart(2, '0')}<em>{REASONS[c]?.name}</em></span>)}
        </div>
      </div>
      <div className="tour-table-wrap">
        <table className="bal tour-table">
          <thead><tr><th>#</th><th>Feature</th><th>Transaction</th><th>Fe CLI</th><th>Module</th><th>Match</th></tr></thead>
          <tbody>
            {txs.map((x) => (
              <tr key={x.i}>
                <td className="t-code">{String(x.i).padStart(2, '0')}</td>
                <td>{x.feature}</td>
                <td className="tour-desc">{x.description}</td>
                <td><span className={`verdict ${x.predicted.verdict === 'ALLOW' ? 'allow' : 'deny'}`}>{x.predicted.verdict === 'ALLOW' ? 'ALLOW' : x.predicted.code}</span></td>
                <td><span className={`verdict ${x.onchain.verdict === 'ALLOW' ? 'allow' : 'deny'}`}>{x.onchain.verdict === 'ALLOW' ? 'ALLOW' : x.onchain.code}</span></td>
                <td className={x.matched ? 'up' : 'down'}>{x.matched ? '✓' : '✗'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Results({ fpA, fpB, before, after, engine, addresses, children }: {
  fpA: string; fpB: string; before: Balances; after: Balances; engine: string; addresses: { safe: string; module: string; agent: string }; children: React.ReactNode;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <div className="t-mono wt-h results-h" id="demo-results">Step 3 · Results</div>
      {children}
      <div className="demo-foot">
        <div><div className="t-mono demo-foot-h">Balances · only the allowed calls moved money</div><BalanceTable a={before} b={after} /></div>
        <div>
          <div className="t-mono demo-foot-h">Policy fingerprint · {fpA === fpB ? 'identical' : 'different'}</div>
          <div className="fp"><span className="t-mono">CLI</span><code className="t-code">{fpA}</code></div>
          <div className="fp"><span className="t-mono">Chain</span><code className="t-code">{fpB}</code></div>
          <p className="t-small demo-engine">{engine}. Safe {short(addresses.safe)}, LeashModule {short(addresses.module)}, agent {short(addresses.agent)}.</p>
        </div>
      </div>
    </motion.div>
  );
}

export function LiveDemo() {
  const { status, result, tour, mode: runMode, error, run, recorded, openConsole } = useStore();
  const [mode, setMode] = useState<DemoMode>('quick');
  const [showResults, setShowResults] = useState(false);
  useEffect(() => { if (status === 'running') { setShowResults(false); setMode(runMode); } }, [status, runMode]);
  const busy = status === 'running';
  const label = busy ? 'Running…' : mode === 'tour' ? 'Run the full feature tour' : 'Run the 5-transaction demo';
  return (
    <section className="sec demo" id="demo" aria-labelledby="demo-h">
      <div className="container"><div className="inner">
        <div className="pad demo-top">
          <Reveal className="demo-copy">
            <span className="rule" style={{ top: 0, height: '7em' }} />
            <Fade d={0}><Eyebrow>Live demo · runs on this server</Eyebrow></Fade>
            <h2 className="t-h1" id="demo-h"><span className="dim"><Chars text="An agent with a wallet." d={0.1} st={0.03} /></span><br /><Chars text="Watch it hit its limits." d={0.7} st={0.03} /></h2>
            <Fade as="p" className="t-p" d={T.para + 0.4}>
              Each run deploys the Fe-compiled contracts into a fresh in-memory EVM, then an agent sends real transactions. Before each one, the Fe-built <code className="t-code">leash</code> binary predicts the verdict from the agent’s on-chain state; then the Safe module decides for real. You then step through every transaction to see what happened and why.
            </Fade>
            <Fade d={T.button + 0.2} dur={0.6} className="mode-pick">
              <div role="radiogroup" aria-label="What to run" className="modes">
                <button type="button" role="radio" aria-checked={mode === 'quick'} className={`mode ${mode === 'quick' ? 'on' : ''}`} onClick={() => setMode('quick')} disabled={busy}>
                  <b>Quick demo</b><span>5 transactions · about 20 s to watch</span>
                </button>
                <button type="button" role="radio" aria-checked={mode === 'tour'} className={`mode ${mode === 'tour' ? 'on' : ''}`} onClick={() => setMode('tour')} disabled={busy}>
                  <b>Full feature tour</b><span>18 transactions · every rule, breaker, guardian, session</span>
                </button>
              </div>
            </Fade>
            <Fade d={T.button + 0.4} dur={0.6} className="demo-actions">
              <Button label={label} busy={busy} disabled={busy} onClick={() => { run(mode); window.setTimeout(() => scrollToId('demo-run'), 80); }} />
              <Button label="Try your own" variant="ghost" onClick={() => openConsole(null)} />
            </Fade>
          </Reveal>
          <Mosaic />
        </div>

        <div className="demo-out" id="demo-run" aria-live="polite">
          <AnimatePresence mode="wait">
            {busy && (
              <motion.div key="run" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, filter: 'blur(8px)' }} transition={{ duration: 0.3 }}><SetupProgress mode={runMode} /></motion.div>
            )}
            {status === 'error' && (
              <motion.div key="err" className="demo-err" role="alert" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                The demo could not run: {error}
              </motion.div>
            )}
            {status === 'done' && runMode === 'quick' && result && (
              <motion.div key={`done-quick-${result.fingerprintChain}-${result.elapsedMs}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                <Walkthrough chapters={quickChapters(result.steps)} addresses={result.addresses} onFinish={() => setShowResults(true)} />
                {showResults && (
                  <Results fpA={result.fingerprintCli} fpB={result.fingerprintChain} before={result.balancesBefore} after={result.balancesAfter} engine={result.engine} addresses={result.addresses}>
                    <div className="demo-sum">
                      <div><div className="t-mono">Predictions matched</div><div className={`t-h2 ${result.allMatched ? 'ok' : 'bad'}`}><Odometer value={`${result.matchedCount}/${result.steps.length}`} play /></div></div>
                      <div><div className="t-mono">Fingerprints</div><div className={`t-h2 ${result.fingerprintsMatch ? 'ok' : 'bad'}`}>{result.fingerprintsMatch ? 'Identical' : 'Different'}</div></div>
                      <div><div className="t-mono">Predicted by</div><div className="t-h4">{result.predictionSource === 'fe-native' ? 'Fe-built binary' : 'TypeScript mirror'}</div><div className="t-code demo-sub">{result.cliVersion}</div></div>
                      <div><div className="t-mono">Run time</div><div className="t-h2"><Odometer value={(result.elapsedMs / 1000).toFixed(2)} play />s</div></div>
                    </div>
                    <ol className="steps">{result.steps.map((s, k) => <StepRow s={s} k={k} key={s.i} />)}</ol>
                  </Results>
                )}
              </motion.div>
            )}
            {status === 'done' && runMode === 'tour' && tour && (
              <motion.div key={`done-tour-${tour.elapsedMs}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                <Walkthrough chapters={tourChapters(tour)} addresses={tour.addresses} onFinish={() => setShowResults(true)} />
                {showResults && (
                  <Results fpA={tour.fingerprintCli} fpB={tour.fingerprintChain} before={tour.balancesBefore} after={tour.balancesAfter} engine={tour.engine} addresses={tour.addresses}>
                    <TourSummary t={tour} />
                  </Results>
                )}
              </motion.div>
            )}
            {status === 'idle' && recorded && (
              <motion.div key="idle" className="demo-idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {mode === 'quick' ? (
                  <>
                    <div className="t-mono">Quick demo · recorded run · {recorded.network} · {recorded.steps.filter((s) => s.matched).length}/{recorded.steps.length} matched</div>
                    <ol className="idle-list">
                      {recorded.steps.map((s) => {
                        const allow = s.onchain === 'ALLOW';
                        const reason = reasonOf(s.predicted) || REASONS[s.onchainCode]?.name;
                        return (
                          <li key={s.i}><span className="t-code">{String(s.i).padStart(2, '0')}</span><span>{s.description}</span>
                            <span className={`verdict ${allow ? 'allow' : 'deny'}`}>{allow ? 'ALLOW' : 'DENY'}{!allow && <em>{reason}</em>}</span></li>
                        );
                      })}
                    </ol>
                    <p className="t-small">Press <b>Run</b> to replay it live against freshly deployed contracts, step by step.</p>
                  </>
                ) : (
                  <>
                    <div className="t-mono">Full feature tour · 18 transactions in 5 chapters</div>
                    <div className="tour-code-list">{TOUR_FEATURES.map((f) => <span key={f} className="chip">{f}</span>)}</div>
                    <p className="t-small">Every rule the deployed module enforces, plus the controls humans keep: the owner resets the breaker and lifts a pause, a separate guardian key pauses the agent, and a short session expires. Every agent call is predicted by the Fe CLI and then decided on-chain.</p>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div></div>
    </section>
  );
}
