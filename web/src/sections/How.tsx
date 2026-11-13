import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { Head } from './Story';
import { Chars, Fade, Reveal, T, useInViewOnce } from '../motion/Reveal';
import { CountUp, Odometer } from '../motion/Odometer';
import { Eyebrow } from '../ui/Button';
import { Grid } from '../motion/Ambient';

const EASE = [0.25, 0.46, 0.45, 0.94] as const;

/** Square node that pops in. */
function Node({ x, y, c = 'var(--violet-2)', d, s = 9 }: { x: number; y: number; c?: string; d: number; s?: number }) {
  return <motion.rect x={x - s / 2} y={y - s / 2} width={s} height={s} fill={c} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: d, duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }} style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />;
}
function Seg({ d, delay, dur = 0.3, c = 'var(--violet-2)', w = 1.6 }: { d: string; delay: number; dur?: number; c?: string; w?: number }) {
  return <motion.path d={d} fill="none" stroke={c} strokeWidth={w} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay, duration: dur, ease: 'linear' }} />;
}
function Tag({ x, y, children, d, anchor = 'start' }: { x: number; y: number; children: string; d: number; anchor?: 'start' | 'middle' | 'end' }) {
  const w = children.length * 7.6 + 16;
  const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  return (
    <motion.g initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: d, duration: 0.4 }}>
      <rect x={x0} y={y - 11} width={w} height={22} fill="var(--bg)" stroke="var(--line-2)" />
      <text x={x0 + 8} y={y + 4} className="diag-label">{children}</text>
    </motion.g>
  );
}

function SplitDiagram() {
  return (
    <>
      <Tag x={20} y={150} d={0}>RULES.FE</Tag>
      <Seg d="M110 150 H170" delay={0.2} />
      <Node x={170} y={150} d={0.45} />
      <Seg d="M170 150 V80 H260" delay={0.5} />
      <Seg d="M170 150 V220 H260" delay={0.5} />
      <Node x={260} y={80} d={0.85} />
      <Node x={260} y={220} d={0.85} c="var(--coral)" />
      <Seg d="M260 80 H330 V60 H380" delay={0.9} />
      <Seg d="M260 220 H330 V240 H380" delay={0.9} c="var(--coral)" />
      <Node x={380} y={60} d={1.2} />
      <Node x={380} y={240} d={1.2} c="var(--coral)" />
      <Tag x={392} y={60} d={1.3}>EVM · LEASHMODULE</Tag>
      <Tag x={392} y={240} d={1.3}>NATIVE · LEASH CLI</Tag>
    </>
  );
}

function LoopDiagram() {
  const pts: Array<[number, number, string, 'middle' | 'end' | 'start', number, number]> = [
    [300, 50, 'TX', 'middle', 300, 22], [170, 150, 'DECIDE() · PURE', 'end', 150, 150], [430, 150, 'RECORD() · MUT', 'start', 450, 150], [300, 250, 'VERDICT', 'middle', 300, 280],
  ];
  return (
    <>
      <circle cx="300" cy="150" r="60" className="glow" />
      <Seg d="M300 50 L170 150 L300 250 L430 150 Z" delay={0} dur={1} c="var(--line-2)" w={1.2} />
      <Seg d="M300 50 C 200 70, 190 110, 170 150" delay={0.1} dur={0.8} c="var(--line)" w={1} />
      {pts.map(([x, y, label, a, tx, ty], i) => (
        <g key={label}><Node x={x} y={y} d={0.3 + i * 0.2} c="var(--coral)" s={10} /><Tag x={tx} y={ty} anchor={a} d={0.45 + i * 0.2}>{label}</Tag></g>
      ))}
    </>
  );
}

function RadarDiagram() {
  const axes = ['CAPS', 'WINDOW', 'TOKENS', 'TARGETS', 'BREAKER'];
  const [phase, setPhase] = useState(0);
  useEffect(() => { const id = window.setInterval(() => setPhase((p) => p + 1), 1600); return () => window.clearInterval(id); }, []);
  const cx = 300, cy = 155, R = 105;
  const poly = (vals: number[]) => vals.map((v, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return `${cx + Math.cos(a) * R * v},${cy + Math.sin(a) * R * v}`;
  }).join(' ');
  const wobble = (seed: number) => axes.map((_, i) => 0.55 + 0.4 * Math.abs(Math.sin(seed * 1.7 + i * 2.1)));
  const vals = wobble(phase);
  return (
    <>
      {[0.33, 0.66, 1].map((s) => <polygon key={s} points={poly([s, s, s, s, s])} fill="none" stroke="var(--line)" />)}
      {axes.map((ax, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        return <g key={ax}><line x1={cx} y1={cy} x2={cx + Math.cos(a) * R} y2={cy + Math.sin(a) * R} stroke="var(--line)" />
          <Tag x={cx + Math.cos(a) * (R + 26)} y={cy + Math.sin(a) * (R + 22)} anchor="middle" d={0.2 + i * 0.1}>{ax}</Tag></g>;
      })}
      <motion.polygon fill="rgba(127,15,213,.22)" stroke="var(--violet-2)" strokeWidth="1.6" initial={{ points: poly([0.1, 0.1, 0.1, 0.1, 0.1]) }} animate={{ points: poly(vals) }} transition={{ duration: 1.1, ease: EASE }} />
      <motion.polygon fill="none" stroke="var(--coral)" strokeWidth="1.2" strokeDasharray="4 4" initial={{ points: poly([0.1, 0.1, 0.1, 0.1, 0.1]) }} animate={{ points: poly(vals) }} transition={{ duration: 1.1, delay: 0.12, ease: EASE }} />
      {vals.map((v, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        return <motion.rect key={i} width="7" height="7" fill="var(--violet-2)" initial={false} animate={{ x: cx + Math.cos(a) * R * v - 3.5, y: cy + Math.sin(a) * R * v - 3.5 }} transition={{ duration: 1.1, ease: EASE }} />;
      })}
    </>
  );
}

function StagesDiagram() {
  const st = ['ANVIL', 'SEPOLIA', 'SAFE', 'AGENT'];
  return (
    <>
      {st.map((s, i) => {
        const h = 50 + i * 45;
        return (
          <g key={s}>
            <motion.rect x={70 + i * 120} width="70" fill={i === 3 ? 'var(--violet)' : 'var(--track)'} stroke="var(--line-2)" initial={{ y: 270, height: 0 }} animate={{ y: 270 - h, height: h }} transition={{ delay: i * 0.45, duration: 0.7, ease: EASE }} />
            <Node x={105 + i * 120} y={262 - h} d={i * 0.45 + 0.5} c={i === 3 ? 'var(--coral)' : 'var(--violet-2)'} />
            <Tag x={105 + i * 120} y={292} anchor="middle" d={i * 0.45 + 0.3}>{s}</Tag>
          </g>
        );
      })}
      <Seg d="M105 212 L225 167 L345 122 L465 77" delay={1.6} dur={0.9} c="var(--violet-2)" w={1.2} />
    </>
  );
}

function Diagram({ children }: { children: ReactNode }) {
  const [ref, seen] = useInViewOnce<HTMLDivElement>(0.35);
  return (
    <div className="diag" ref={ref} aria-hidden="true">
      <Grid seed={9} dots={3} />
      <svg viewBox="0 0 600 310">{seen ? children : null}</svg>
    </div>
  );
}

const STEPS = [
  { eb: 'Write it once', t: 'One source, two targets', p: 'The policy is plain Fe in rules.fe. The Fe compiler turns it into the LeashModule bytecode for the EVM and, from the same files, into the native leash binary the agent runs.', g: <SplitDiagram /> },
  { eb: 'Effects in the signature', t: 'Deciding is pure. Recording is explicit.', p: 'decide() has no effects, so the CLI can run it off-chain on a copy of the agent’s state. Only record() and record_denial() write, and Fe’s effect system puts that in their signatures where a reviewer can see it.', g: <LoopDiagram /> },
  { eb: 'Same policy, same hash', t: 'Fingerprints that must agree', p: 'Both sides hash the encoded policy. The CLI prints its fingerprint, the contract exposes its own, and a single changed limit makes them differ.', g: <RadarDiagram /> },
  { eb: 'Ship it', t: 'From a laptop to a real Safe', p: 'Run it on Anvil, deploy to Sepolia, enable the module on a Safe with the Transaction Builder, then hand the agent its key.', g: <StagesDiagram /> },
];

export function HowItWorks() {
  return (
    <section className="sec" id="how" aria-labelledby="how-h">
      <div className="container"><div className="inner">
        <div className="pad how-head"><Head id="how-h" eyebrow="How it works" title="One policy. Two runtimes. No drift." /></div>
        {STEPS.map((s) => (
          <div className="how-row" key={s.t}>
            <Reveal className="how-copy">
              <span className="rule" style={{ top: '2.2em', height: '4em' }} />
              <Fade d={0}><Eyebrow>{s.eb}</Eyebrow></Fade>
              <h3 className="t-h2"><Chars text={s.t} d={0.1} /></h3>
              <Fade as="p" className="t-small how-p" d={T.para}>{s.p}</Fade>
            </Reveal>
            <Diagram>{s.g}</Diagram>
          </div>
        ))}
      </div></div>
    </section>
  );
}

const LADDER = [
  { k: 'Compiles', t: 'Fits the EVM', p: '22,029 bytes of runtime, 2,547 under the 24,576-byte limit.' },
  { k: 'Tested', t: 'On both targets', p: '159 EVM tests, 119 native tests and 77 shared vectors run against both builds.' },
  { k: 'Matched', t: 'Prediction = decision', p: 'Every demo run compares the CLI verdict with the contract’s, transaction by transaction.' },
  { k: 'Released', t: 'Binaries in CI', p: 'cli-v0.1.0 ships leash for Linux x86-64 and macOS arm64, built and smoke-tested in CI.' },
];

export function Proof() {
  const [ref, seen] = useInViewOnce<HTMLDivElement>(0.3);
  const [col, setCol] = useState(0);
  const [barsRef, barsSeen] = useInViewOnce<HTMLDivElement>(0.3);
  return (
    <section className="sec" id="proof" aria-labelledby="proof-h">
      <div className="container"><div className="inner">
        <div className="proof-box">
          <div className="pad proof-top">
            <Head id="proof-h" eyebrow="Proof" title="Scale follows validation." size="t-h1" />
            <div className={`stair ${seen ? 'on' : ''}`} ref={ref} aria-hidden="true">
              {LADDER.map((l, i) => (
                <div key={l.k} className="stair-step" style={{ '--k': i, transitionDelay: `${(LADDER.length - 1 - i) * 0.18}s` } as React.CSSProperties}>
                  <i /><i /><i /><span className="t-mono">{l.k}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="ladder">
            {LADDER.map((l, i) => (
              <Reveal key={l.k} className={`ladder-col ${i === col ? 'on' : ''}`} amount={0.3}>
                <div onPointerEnter={() => setCol(i)} onFocus={() => setCol(i)} tabIndex={0}>
                  <Fade d={0.85 + i * 0.1}><div className="ladder-ico" aria-hidden="true"><i /></div></Fade>
                  <Fade d={0.9 + i * 0.1}><h3 className="t-h4">{l.t}</h3></Fade>
                  <Fade as="p" className="t-small" d={1 + i * 0.1}>{l.p}</Fade>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        <div className="pad big">
          <Reveal className="big-copy">
            <Fade d={0}><Eyebrow>Room to grow</Eyebrow></Fade>
            <div className="t-stat big-n"><Odometer value="2,547" /> <span className="big-unit">bytes</span></div>
            <Fade as="p" className="t-small" d={0.9}>of headroom under the EVM’s 24,576-byte contract limit, after every rule, guard and the circuit breaker are in.</Fade>
          </Reveal>
          <div className="big-bars" ref={barsRef} aria-label="Contract size and test counts">
            <div className="size-bar">
              <div className="t-mono size-k"><span>LeashModule runtime</span><span><CountUp to={22029} play={barsSeen} format={(n) => n.toLocaleString('en-US')} /> / 24,576 B</span></div>
              <div className="size-track"><motion.div className="size-fill" initial={{ width: 0 }} animate={barsSeen ? { width: `${(22029 / 24576) * 100}%` } : {}} transition={{ duration: 2, ease: [0.5, 1, 0.89, 1] }} /></div>
            </div>
            <div className="tests">
              {[['EVM tests', 159], ['Native tests', 119], ['Shared vectors', 77]].map(([k, n], i) => (
                <div className="test-bar" key={k}>
                  <motion.div className="test-fill" initial={{ height: 0 }} animate={barsSeen ? { height: `${((n as number) / 159) * 100}%` } : {}} transition={{ delay: 0.4 + i * 0.1, duration: 0.9, ease: EASE }} />
                  <div className="t-code test-n">{n}</div>
                  <div className="t-mono">{k}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div></div>
    </section>
  );
}
