import { useMemo, useState } from 'react';
import { Button, LeashMark } from '../ui/Button';
import { Chars, Fade, Reveal, T } from '../motion/Reveal';
import { Grid, Rails, rng } from '../motion/Ambient';
import { REPO } from '../lib/data';
import { reasonOf, scrollToId, short, useStore } from '../lib/store';

const LINKS: Array<[string, string]> = [['Demo', 'demo'], ['Rules', 'rules'], ['How it works', 'how'], ['Proof', 'proof']];

export function Nav() {
  const { run, status } = useStore();
  const [open, setOpen] = useState(false);
  const go = (id: string) => { setOpen(false); scrollToId(id); };
  return (
    <header className="nav">
      <div className="container nav-row">
        <nav className="nav-links" aria-label="Sections">
          {LINKS.map(([label, id]) => (
            <a key={id} href={`#${id}`} onClick={(e) => { e.preventDefault(); go(id); }}>{label}</a>
          ))}
          <a href={REPO} target="_blank" rel="noreferrer">GitHub</a>
        </nav>
        <a className="nav-logo" href="#top" onClick={(e) => { e.preventDefault(); go('top'); }} aria-label="Leash, back to top">
          <LeashMark /> <span>Leash</span>
        </a>
        <div className="nav-cta">
          <Button label={status === 'running' ? 'Running…' : 'Run the demo'} busy={status === 'running'} onClick={() => { setOpen(false); run(); window.setTimeout(() => scrollToId('demo-run'), 80); }} />
          <button className="nav-burger" aria-expanded={open} aria-controls="nav-sheet" onClick={() => setOpen((o) => !o)}>
            <span className="sr">Menu</span><i /><i />
          </button>
        </div>
      </div>
      <div id="nav-sheet" className={`nav-sheet ${open ? 'open' : ''}`} hidden={!open}>
        {LINKS.map(([label, id]) => <a key={id} href={`#${id}`} onClick={(e) => { e.preventDefault(); go(id); }}>{label}</a>)}
        <a href={REPO} target="_blank" rel="noreferrer">GitHub</a>
      </div>
    </header>
  );
}

function HealthPill() {
  const { health, healthError } = useStore();
  const ok = health?.predictionSource === 'fe-native';
  const text = healthError
    ? `Predictor unavailable: ${healthError}`
    : !health ? 'Checking the predictor…'
    : ok ? `Predictor ready · ${health.cliVersion.replace(/^leash\s*/i, '')} · ${short(health.fingerprint)}`
    : 'Predictor: TypeScript mirror (no Fe binary on this host)';
  return (
    <span className="pill" role="status">
      <span className={`dot ${healthError ? 'bad' : !health ? '' : ok ? 'ok' : 'warn'}`} />
      {text}
    </span>
  );
}

export function Hero() {
  const { run } = useStore();
  return (
    <section className="hero" id="top">
      <div className="container">
        <div className="inner hero-inner">
          <Grid seed={11} dots={12} />
          <Reveal mode="load" delay={0.2} className="hero-copy">
            <h1 className="t-hero"><Chars text="Limits written once." st={0.03} /><br /><Chars text="Enforced twice." d={0.6} st={0.03} /></h1>
            <Fade as="p" className="t-p hero-p" d={T.para + 0.2}>
              One Fe policy compiles to the Safe module that enforces it on-chain and to the CLI that predicts it off-chain, so the two can never drift.
            </Fade>
            <Fade d={T.button + 0.2} dur={0.6} className="hero-actions">
              <Button label="Run the demo" onClick={() => { run(); window.setTimeout(() => scrollToId('demo-run'), 80); }} />
              <Button label="Read the code" variant="ghost" href={REPO} />
            </Fade>
            <Fade d={T.button + 0.45} dur={0.6} className="hero-health"><HealthPill /></Fade>
          </Reveal>
        </div>
      </div>
      <Stream />
      <div className="container"><div className="inner"><Rails seed={3} /></div></div>
    </section>
  );
}

interface Bar { o: number; c: number; hi: number; lo: number; allow: boolean; live?: { i: number; label: string; reason: string } }

/** Transaction stream: one candle per agent transaction. Violet passed the policy, coral was blocked. */
function Stream() {
  const { recorded, result } = useStore();
  const [hover, setHover] = useState<number | null>(null);
  const bars = useMemo<Bar[]>(() => {
    const r = rng(42);
    const out: Bar[] = [];
    let p = 50;
    for (let k = 0; k < 58; k++) {
      const drift = Math.sin(k / 6) * 2.2 + (r() - 0.46) * 9;
      const o = p, c = Math.max(12, Math.min(88, p + drift));
      const allow = r() > 0.3;
      out.push({ o, c, hi: Math.max(o, c) + r() * 6, lo: Math.min(o, c) - r() * 6, allow });
      p = c;
    }
    const steps = result
      ? result.steps.map((s) => ({ i: s.i, allow: s.onchain.verdict === 'ALLOW', label: s.description, reason: s.onchain.reason }))
      : recorded?.steps.map((s) => ({ i: s.i, allow: s.onchain === 'ALLOW', label: s.description, reason: reasonOf(s.predicted) || 'None' })) ?? [];
    steps.forEach((s, j) => {
      const k = out.length - steps.length + j;
      const b = out[k];
      const tall = 8 + j * 1.5;
      b.c = s.allow ? b.o + tall : b.o - tall;
      b.hi = Math.max(b.o, b.c) + 4; b.lo = Math.min(b.o, b.c) - 4;
      b.allow = s.allow;
      b.live = { i: s.i, label: s.label, reason: s.reason };
    });
    return out;
  }, [recorded, result]);
  const W = 1000, H = 220, bw = W / bars.length;
  const y = (v: number) => H - (v / 100) * H;
  const hb = hover != null ? bars[hover] : null;
  return (
    <div className="stream">
      <div className="container"><div className="inner stream-inner">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="stream-svg" onPointerLeave={() => setHover(null)} role="img"
          aria-label="Agent transaction stream: violet bars passed the policy, coral bars were blocked.">
          {bars.map((b, k) => {
            const x = k * bw + bw * 0.22, w = bw * 0.56;
            const top = y(Math.max(b.o, b.c)), bot = y(Math.min(b.o, b.c));
            const col = b.allow ? 'var(--violet)' : 'var(--coral)';
            const dim = hover != null && hover !== k ? 0.45 : b.live ? 1 : 0.82;
            return (
              <g key={k} opacity={dim} onPointerEnter={() => setHover(k)} className={b.live ? 'bar live' : 'bar'}>
                <rect x={k * bw} y={0} width={bw} height={H} fill="transparent" />
                <line x1={x + w / 2} x2={x + w / 2} y1={y(b.hi)} y2={y(b.lo)} stroke={col} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
                <rect x={x} y={top} width={w} height={Math.max(2, bot - top)} fill={col} />
                {b.live && <text x={x + w / 2} y={Math.min(H - 4, bot + 16)} textAnchor="middle" className="bar-n">{b.live.i}</text>}
              </g>
            );
          })}
        </svg>
        <div className="stream-legend t-mono">
          <span><i className="sw v" /> passed the policy</span>
          <span><i className="sw c" /> blocked</span>
          <span className="stream-note">{result ? 'Bars 1–5: your live run' : 'Bars 1–5: the recorded demo run · earlier bars illustrative'}</span>
        </div>
        {hb && (
          <div className="stream-tip" style={{ left: `${((hover! + 0.5) / bars.length) * 100}%` }}>
            <span className={`verdict ${hb.allow ? 'allow' : 'deny'}`}>{hb.allow ? 'ALLOW' : 'DENY'}</span>
            <span>{hb.live ? `Tx ${hb.live.i} · ${hb.live.label}${hb.allow ? '' : ` · ${hb.live.reason}`}` : hb.allow ? 'Within every limit' : 'Stopped by a rule'}</span>
          </div>
        )}
      </div></div>
    </div>
  );
}
