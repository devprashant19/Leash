import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { scrollToId, short, useStore, type DemoMode } from '../lib/store';
import { REASONS, TOKEN, TREASURY } from '../lib/data';
import type { StepResult, TourEvent } from '../lib/types';

const EASE = [0.25, 0.46, 0.45, 0.94] as const;

/** What the server does before the agent sends anything (api/_lib/leash.ts setupEnvironment). */
const SETUP = [
  { t: 'Start a fresh EVM', d: 'An in-memory chain (Prague rules) just for this run, with owner, agent and guardian accounts.' },
  { t: 'Deploy the Safe', d: 'The wallet that holds the money. Only modules it enables can move funds.' },
  { t: 'Deploy LeashModule', d: 'The Safe module compiled from the Fe policy, with a separate guardian key.' },
  { t: 'Fund the Safe', d: '10 ETH, plus a test ERC-20 at the allowlisted token address with 1,000 tokens minted to the Safe.' },
  { t: 'Enable the module, register the agent', d: 'The Safe owner turns LeashModule on and gives the agent key a one-year session.' },
];

const POLICY = [
  ['Per transaction', '≤ 0.1 ETH'],
  ['Rolling 24 h', '≤ 0.5 ETH'],
  ['Allowed targets', 'treasury (ETH), test token (transfer · approve · transferFrom)'],
  ['Token limits', '≤ 100 tokens per transfer or approval'],
  ['Circuit breaker', 'trips after 3 denials; only the Safe resets it'],
  ['Guardian', 'can pause; only the Safe can unpause'],
];

/** Why each quick-demo transaction gets its verdict (demo/lib/scenario.ts canonicalScenarios). */
const QUICK_WHY: Array<{ match: RegExp; why: string; feature: string }> = [
  { match: /0\.05 ETH/, feature: 'ETH payment', why: '0.05 ETH is under the 0.1 ETH per-transaction cap and the 0.5 ETH daily budget, and the treasury is an allowed ETH target.' },
  { match: /50 tokens/, feature: 'Token transfer', why: 'transfer() on the allowlisted token, and 50 tokens is under the 100-token cap.' },
  { match: /0\.2 ETH/, feature: 'Per-transaction cap', why: '0.2 ETH is twice the 0.1 ETH per-transaction cap, so the policy refuses it before the Safe is touched.' },
  { match: /unlisted/i, feature: 'Target allowlist', why: 'The target is not on the allowlist. Only the token and the treasury are, so a prompt-injected “send it here” goes nowhere.' },
  { match: /approve/i, feature: 'Unlimited approval', why: 'approve(exchange, 2^256 − 1) would hand over the whole balance. Approvals are capped at 100 tokens. This is the third denial in a row, so the circuit breaker trips.' },
];

export type Item = ({ kind: 'tx'; step: StepResult; feature: string; why: string } | ({ kind: 'event' } & Omit<TourEvent, 'kind'>));
export interface Chapter { title: string; intro: string; items: Item[] }

/** The quick demo as a single chapter. */
export function quickChapters(steps: StepResult[]): Chapter[] {
  return [{
    title: 'Five agent transactions',
    intro: 'Two calls inside the limits, then three an attacker or a confused prompt might try.',
    items: steps.map((s) => {
      const q = QUICK_WHY.find((w) => w.match.test(s.description));
      return { kind: 'tx' as const, step: s, feature: q?.feature ?? s.onchain.reason, why: q?.why ?? (s.predicted.message || REASONS[s.predicted.code]?.msg || '') };
    }),
  }];
}

function tokenAmount(data: string, sel: string): string | null {
  if (!data.toLowerCase().startsWith(sel) || data.length < 138) return null;
  const n = BigInt('0x' + data.slice(74, 138));
  if (n > 10n ** 30n) return '2^256 − 1';
  return (n / 10n ** 18n).toString();
}

function askText(s: StepResult) {
  const to = s.to.toLowerCase() === TREASURY ? `the treasury (${short(s.to)})` : s.to.toLowerCase() === TOKEN ? `the token contract (${short(s.to)})` : `an unknown contract (${short(s.to)})`;
  const sel = s.data.slice(0, 10).toLowerCase();
  if (s.operation === 'delegatecall') return `Delegatecall into ${to}`;
  if (sel === '0xa9059cbb') { const a = tokenAmount(s.data, '0xa9059cbb'); return a ? `Call transfer(${a} tokens) on ${to}` : `Call transfer() on ${to}, with its arguments cut off`; }
  if (sel === '0x095ea7b3') return `Call approve(spender, ${tokenAmount(s.data, '0x095ea7b3') ?? '?'} tokens) on ${to}`;
  if (sel === '0x40c10f19') return `Call mint() on ${to}`;
  if (s.valueEth !== '0') return `Send ${s.valueEth} ETH to ${to}`;
  return `Call ${to}${s.data !== '0x' ? ` with data ${s.data.slice(0, 10)}…` : ''}`;
}

function outcome(s: StepResult) {
  if (s.onchain.verdict === 'DENY') return 'Nothing moved. The module refused, so the Safe never executed the call.';
  const sel = s.data.slice(0, 10).toLowerCase();
  if (sel === '0xa9059cbb') return `${tokenAmount(s.data, sel)} tokens moved from the Safe to the treasury.`;
  if (sel === '0x095ea7b3') return `The Safe approved the spender for ${tokenAmount(s.data, sel)} tokens. No funds moved yet.`;
  if (s.valueEth !== '0') return `${s.valueEth} ETH moved from the Safe to the treasury.`;
  return 'The Safe executed the call.';
}

const STAGES = ['The agent asks', 'Fe CLI predicts · off-chain', 'LeashModule decides · on-chain', 'Outcome'];
const STAGE_MS = 850;
const ACTOR: Record<TourEvent['actor'], string> = { owner: 'Safe owner', guardian: 'Guardian', clock: 'Clock' };

function PolicyBox() {
  return (
    <div className="wt-policy">
      <div className="t-mono wt-h">The policy this agent runs under</div>
      <dl>{POLICY.map(([k, v]) => <div key={k}><dt className="t-mono">{k}</dt><dd>{v}</dd></div>)}</dl>
    </div>
  );
}

/** While the request is in flight: the setup checklist, ticking in the order the server does it. */
export function SetupProgress({ mode }: { mode: DemoMode }) {
  const { startedAt } = useStore();
  const [k, setK] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setK(Math.min(SETUP.length, Math.floor((performance.now() - startedAt) / 350))), 100);
    return () => window.clearInterval(id);
  }, [startedAt]);
  return (
    <div className="wt">
      <div className="wt-setup">
        <div className="t-mono wt-h">Step 1 · Setting up on the server</div>
        <ol className="setup">
          {SETUP.map((s, i) => (
            <li key={s.t} className={i < k ? 'done' : i === k ? 'now' : ''}>
              <span className="setup-ico" aria-hidden="true">{i < k ? '✓' : i === k ? <span className="spin" /> : ''}</span>
              <div><b>{s.t}</b><span className="t-small">{s.d}</span></div>
            </li>
          ))}
          <li className={k >= SETUP.length ? 'now' : ''}>
            <span className="setup-ico" aria-hidden="true">{k >= SETUP.length ? <span className="spin" /> : ''}</span>
            <div>
              <b>{mode === 'tour' ? 'Run the feature tour: 18 transactions in 5 chapters' : 'Agent sends 5 transactions'}</b>
              <span className="t-small">For each one the Fe CLI predicts first, then the module decides.{mode === 'tour' ? ' The owner, the guardian and the clock step in between chapters.' : ''}</span>
            </div>
          </li>
        </ol>
      </div>
      <div className="wt-main"><PolicyBox /></div>
    </div>
  );
}

/** Replays a run item by item: each transaction in four stages, each owner/guardian/clock event as one card. */
export function Walkthrough({ chapters, addresses, onFinish }: { chapters: Chapter[]; addresses: { safe: string; module: string; agent: string; guardian?: string }; onFinish: () => void }) {
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const flat = useMemo(() => chapters.flatMap((c, ci) => c.items.map((it) => ({ it, ci }))), [chapters]);
  const [pos, setPos] = useState(0);
  const [stage, setStage] = useState(reduce ? 3 : 0);
  const [playing, setPlaying] = useState(!reduce);
  const [finished, setFinished] = useState(false);
  const N = flat.length;
  const cur = flat[pos];
  const lastStage = cur.it.kind === 'tx' ? 3 : 0;

  const finish = () => { if (!finished) { setFinished(true); onFinish(); } };
  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(() => {
      if (stage < lastStage) setStage(stage + 1);
      else if (pos < N - 1) { setPos(pos + 1); setStage(0); }
      else { setPlaying(false); finish(); }
    }, stage < lastStage ? STAGE_MS : cur.it.kind === 'tx' ? 1700 : 2300);
    return () => window.clearTimeout(id);
  }); // re-armed every render on purpose: the timer always reflects the current item

  const go = (p: number, full = false) => { setPos(Math.max(0, Math.min(N - 1, p))); setStage(full || reduce ? 3 : 0); };
  const ch = chapters[cur.ci];
  const txNo = flat.slice(0, pos + 1).filter((f) => f.it.kind === 'tx').length;
  const txTotal = flat.filter((f) => f.it.kind === 'tx').length;

  return (
    <div className="wt">
      <div className="wt-setup">
        <div className="t-mono wt-h">Step 1 · Set up on the server · done</div>
        <ol className="setup compact">
          {SETUP.map((x) => <li key={x.t} className="done"><span className="setup-ico" aria-hidden="true">✓</span><div><b>{x.t}</b></div></li>)}
        </ol>
        <div className="wt-addr t-code">
          <span>Safe {short(addresses.safe)}</span><span>LeashModule {short(addresses.module)}</span><span>Agent {short(addresses.agent)}</span>
          {addresses.guardian && <span>Guardian {short(addresses.guardian)}</span>}
        </div>
        <PolicyBox />
        {chapters.length > 1 && (
          <ol className="chapters" aria-label="Chapters">
            {chapters.map((c, i) => {
              const first = flat.findIndex((f) => f.ci === i);
              return (
                <li key={c.title}>
                  <button type="button" className={`chapter ${i === cur.ci ? 'on' : ''} ${i < cur.ci ? 'past' : ''}`} onClick={() => { setPlaying(false); go(first, true); }}>
                    <span className="t-code">{String(i + 1).padStart(2, '0')}</span><span>{c.title}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="wt-main">
        <div className="wt-top">
          <div className="t-mono wt-h">Step 2 · {chapters.length > 1 ? `Chapter ${cur.ci + 1} of ${chapters.length} · ` : ''}{cur.it.kind === 'tx' ? `transaction ${txNo} of ${txTotal}` : 'between transactions'}</div>
          <div className="wt-ctrl">
            <button type="button" onClick={() => { setPlaying(false); go(pos - 1, true); }} disabled={pos === 0} aria-label="Previous step">‹</button>
            <button type="button" onClick={() => { if (!playing && pos === N - 1 && stage === lastStage) go(0); setPlaying((p) => !p); }} aria-label={playing ? 'Pause' : 'Play'}>{playing ? '❚❚' : '▶'}</button>
            <button type="button" onClick={() => { setPlaying(false); go(pos + 1, true); }} disabled={pos === N - 1} aria-label="Next step">›</button>
            {!finished && <button type="button" className="wt-skip" onClick={() => { setPlaying(false); go(N - 1, true); finish(); window.setTimeout(() => scrollToId('demo-results'), 380); }}>Skip to results</button>}
          </div>
        </div>

        <div className="wt-dots" role="tablist" aria-label="Steps">
          {flat.map((f, i) => {
            const done = i < pos || (i === pos && stage === (f.it.kind === 'tx' ? 3 : 0));
            const cls = f.it.kind === 'event' ? 'ev' : done ? (f.it.step.onchain.verdict === 'ALLOW' ? 'allow' : 'deny') : '';
            return (
              <button key={i} role="tab" aria-selected={i === pos} type="button" title={f.it.kind === 'tx' ? f.it.step.description : f.it.title}
                className={`wt-dot ${cls} ${i === pos ? 'on' : ''} ${f.ci !== (flat[i - 1]?.ci ?? f.ci) ? 'gap' : ''}`}
                onClick={() => { setPlaying(false); go(i, true); }}>
                <span className="sr">{f.it.kind === 'tx' ? `Transaction ${f.it.step.i}` : f.it.title}</span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={pos} className={`wt-card ${cur.it.kind === 'event' ? 'event' : ''}`} initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -10, filter: 'blur(8px)' }} transition={{ duration: 0.4, ease: EASE }}>
            <div className="wt-chapter">
              <span className="t-mono">{chapters.length > 1 ? `Chapter ${cur.ci + 1} · ` : ''}{ch.title}</span>
              <span className="t-small">{ch.intro}</span>
            </div>
            {cur.it.kind === 'event' ? <EventCard e={cur.it} /> : <TxStages it={cur.it} stage={stage} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function EventCard({ e }: { e: Extract<Item, { kind: 'event' }> }) {
  return (
    <div className={`ev-card ${e.actor}`}>
      <span className={`ev-actor t-mono ${e.actor}`}>{ACTOR[e.actor]}</span>
      <h3 className="t-h4">{e.title}</h3>
      <p className="t-small">{e.detail}</p>
      {e.txHash && <span className="t-code stage-meta">tx {short(e.txHash)}</span>}
    </div>
  );
}

function TxStages({ it, stage }: { it: Extract<Item, { kind: 'tx' }>; stage: number }) {
  const s = it.step;
  const pa = s.predicted.verdict === 'ALLOW', oa = s.onchain.verdict === 'ALLOW';
  const left = s.remaining?.eth_window_wei ? (Number(s.remaining.eth_window_wei) / 1e18).toString() : null;
  return (
    <>
      <div className="wt-title-row"><h3 className="t-h4 wt-title">{s.description}</h3><span className="feature t-mono">{it.feature}</span></div>
      <ol className="stages" aria-live="polite">
        {STAGES.map((label, k) => (
          <li key={label} className={`stage ${k <= stage ? 'on' : ''} ${k === stage ? 'cur' : ''}`}>
            <span className="stage-dot" aria-hidden="true">{k + 1}</span>
            <div className="stage-body">
              <div className="t-mono">{label}</div>
              {k <= stage && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }}>
                  {k === 0 && <p>{askText(s)}<span className="t-code stage-meta">{s.operation} · value {s.valueEth} ETH · data {s.data.length > 12 ? `${s.data.slice(0, 10)}… (${(s.data.length - 2) / 2} bytes)` : s.data}</span></p>}
                  {k === 1 && (
                    <p>
                      Before sending, the agent runs the Fe-built <code className="t-code">leash</code> binary on its current on-chain state (pause flag, breaker, session, today’s spending).
                      <span className="stage-verdict"><span className={`verdict ${pa ? 'allow' : 'deny'}`}>{s.predicted.verdict}{!pa && <em>{s.predicted.reason}</em>}</span>
                        {left && <span className="t-code stage-meta">daily budget left: {left} ETH</span>}</span>
                    </p>
                  )}
                  {k === 2 && (
                    <p>
                      The agent calls <code className="t-code">tryExecute</code> on LeashModule. The same Fe <code className="t-code">decide()</code> runs inside the contract{oa ? ', then the Safe executes the call.' : ' and refuses.'}
                      <span className="stage-verdict"><span className={`verdict ${oa ? 'allow' : 'deny'}`}>{s.onchain.verdict}{!oa && <em>{s.onchain.reason} · code {s.onchain.code}</em>}</span>
                        <span className="t-code stage-meta">tx {short(s.onchain.txHash)} · {Number(s.onchain.gasUsed).toLocaleString('en-US')} gas{s.onchain.eventEmitted ? ` · ${oa ? 'Allowed' : 'Denied'} event` : ''}</span></span>
                    </p>
                  )}
                  {k === 3 && (
                    <p>
                      <span className={`stage-match ${s.matched ? 'ok' : 'bad'}`}>{s.matched ? '✓ Prediction matched the on-chain decision.' : '✗ Prediction and decision differ.'}</span>
                      {outcome(s)}
                      <span className="stage-why">Why: {it.why}</span>
                    </p>
                  )}
                </motion.div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
