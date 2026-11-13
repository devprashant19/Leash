import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { motion, useMotionValue, useScroll, useSpring, useTransform } from 'motion/react';
import { Head } from './Story';
import { Chars, Fade, Reveal, T, useInViewOnce } from '../motion/Reveal';
import { ScrubChars } from '../motion/Scrub';
import { Grid, Rails, rng } from '../motion/Ambient';
import { Globe, PointCloud } from '../gfx/Art';
import { Button, Eyebrow, LeashMark } from '../ui/Button';
import { REPO } from '../lib/data';
import { scrollToId, useStore } from '../lib/store';

/** Dim line with a static blurred tail, then a sharp line 0.9 s later. */
export function Statement() {
  return (
    <section className="sec" aria-label="Why it matters">
      <div className="container"><div className="inner">
        <Reveal className="statement" amount={0.5}>
          <p className="t-h1 st-dim"><Chars text="Anyone can write a spending limit." st={0.034} tail={{ chars: 14, px: 8 }} /></p>
          <div className="st-sep" />
          <p className="t-h1"><Chars text="Few can prove both sides agree." d={0.9} st={0.034} /></p>
        </Reveal>
        <Rails seed={14} rails={5} />
      </div></div>
    </section>
  );
}

const CLOUDS = [
  { kind: 'drift' as const, t: 'Drifted rules', p: 'The SDK says 0.1 ETH, the contract says 1 ETH, and nobody notices until it matters.' },
  { kind: 'infinity' as const, t: 'Endless approvals', p: 'One approve(2^256 − 1) and a spender can take the whole balance, forever.' },
  { kind: 'spiral' as const, t: 'Runaway loops', p: 'An agent retrying a bad call burns its budget one “small” transaction at a time.' },
];

export function FailureModes() {
  return (
    <section className="sec" aria-labelledby="fail-h">
      <div className="container"><div className="inner">
        <div className="pad fail-head"><Head id="fail-h" eyebrow="How agents lose money" title="Three failure modes" center /></div>
        <div className="clouds">
          {CLOUDS.map((c, i) => (
            <Reveal className="cloud-col" key={c.t} amount={0.25}>
              <Fade d={i * 0.08} dur={0.9} className="cloud-art"><PointCloud kind={c.kind} /></Fade>
              <Fade d={0.4 + i * 0.08}><h3 className="t-h4">{c.t}</h3></Fade>
              <Fade as="p" className="t-small" d={0.5 + i * 0.08}>{c.p}</Fade>
            </Reveal>
          ))}
        </div>
      </div></div>
    </section>
  );
}

const COMPARE: Array<[string, string]> = [
  ['Limits live in the prompt or the SDK', 'Limits live in a Safe module the agent cannot bypass'],
  ['Two implementations that drift apart', 'One Fe source compiled for both sides'],
  ['Unknown calldata waved through', 'ERC-20 calls decoded and checked by selector'],
  ['Approvals of any size', 'Unlimited approvals denied by name'],
  ['Failures are opaque reverts', '21 stable deny codes, the same on both sides'],
  ['No brake when an agent loops', 'Breaker after three denials, plus a guardian pause'],
];

function CompareRow({ a, b }: { a: string; b: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { rootMargin: '0px 0px -35% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`cmp-row ${on ? 'on' : ''}`}>
      <div className="cmp-a"><i />{a}</div>
      <div className="cmp-b"><i />{b}</div>
    </div>
  );
}

export function Compare() {
  return (
    <section className="sec" aria-labelledby="cmp-h">
      <div className="container"><div className="inner">
        <div className="pad scrub-head">
          <Reveal><Fade d={0}><Eyebrow>What we believe</Eyebrow></Fade></Reveal>
          <ScrubChars as="h2" className="t-h1" offset={['start 75%', 'start 35%']} from={0.25} soft={6} text="Agent wallets will not get simpler. They need one source of truth." />
        </div>
        <div className="pad cmp-wrap">
          <Head id="cmp-h" eyebrow="Our approach" title="A different operating model" />
          <div className="cmp" role="table" aria-label="Off-chain checks alone compared with Leash">
            <div className="cmp-row cmp-h on" role="row">
              <div className="t-mono" role="columnheader">Off-chain checks alone</div>
              <div className="t-mono cmp-brand" role="columnheader"><LeashMark size="1.2em" /> The Leash way</div>
            </div>
            {COMPARE.map(([a, b]) => <CompareRow key={a} a={a} b={b} />)}
          </div>
        </div>
      </div></div>
    </section>
  );
}

const TABS = [
  { t: 'Agent builders', p: 'Give your agent a wallet it cannot empty. It asks the leash CLI before every call and gets the same answer the chain will give, with a reason code it can act on.' },
  { t: 'Safe owners', p: 'Enable one module, set the caps, list the targets and recipients. The guardian key can pause the agent at any time; the owners keep full control.' },
  { t: 'Auditors', p: 'Read one Fe source. Effects are in the signatures, the deny codes are a closed list, and the fingerprint tells you the deployed policy is the one you reviewed.' },
];

/** Three columns; the active one is bright with a rule that grows over 5 s, then advances. */
export function UseFor() {
  const [i, setI] = useState(0);
  const [ref, seen] = useInViewOnce<HTMLDivElement>(0.4);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!seen || paused) return;
    const id = window.setTimeout(() => setI((v) => (v + 1) % TABS.length), 5000);
    return () => window.clearTimeout(id);
  }, [i, seen, paused]);
  return (
    <section className="sec" aria-labelledby="use-h">
      <div className="container"><div className="inner">
        <div className="usefor" ref={ref} onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
          <Reveal className="usefor-h"><Fade d={0}><Eyebrow>Use Leash for…</Eyebrow></Fade></Reveal>
          <div className="tabs" role="tablist" aria-label="Who Leash is for">
            {TABS.map((t, k) => (
              <button key={t.t} role="tab" aria-selected={k === i} className={`tab ${k === i ? 'on' : ''}`} onClick={() => setI(k)} onFocus={() => setI(k)}>
                <span className="tab-rule"><i key={`${k}-${i}-${seen}-${paused}`} className={k === i && seen && !paused ? 'run' : k === i ? 'full' : ''} /></span>
                <span className="t-h4">{t.t}</span>
                <span className="t-small">{t.p}</span>
              </button>
            ))}
          </div>
        </div>
      </div></div>
    </section>
  );
}

export function Where() {
  return (
    <section className="sec" aria-labelledby="where-h">
      <div className="container"><div className="inner">
        <div className="pad where">
          <Head id="where-h" eyebrow="Where it runs" title="Two targets, one source." center />
          <div className="where-wrap">
            <Globe markers={[
              { lat: 22, lon: -40, label: 'ANY EVM CHAIN' },
              { lat: -18, lon: 10, label: 'LINUX X86-64' },
              { lat: 35, lon: 60, label: 'MACOS ARM64' },
              { lat: -40, lon: 110, label: 'THIS PAGE · VERCEL' },
            ]} />
            <Reveal className="where-card" amount={0.5}>
              <Fade d={0}><div className="where-pin" /></Fade>
              <Fade d={0.1}><div className="t-h4">Fe 26.6.0</div></Fade>
              <Fade d={0.2}><div className="t-mono">Contract · CLI · this demo</div></Fade>
            </Reveal>
          </div>
        </div>
      </div></div>
    </section>
  );
}

/** Purple panel: corners round as it scrolls in, background drifts with the mouse, squares blink. */
export function FinalCta() {
  const { openConsole } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end end'] });
  const radius = useTransform(useSpring(scrollYProgress, { stiffness: 140, damping: 30 }), [0, 1], ['0em', '2.5em']);
  const { scrollYProgress: bgP } = useScroll({ target: ref, offset: ['start end', 'start 30%'] });
  const bgOpacity = useTransform(bgP, [0, 1], [0, 1]);
  const bgY = useTransform(bgP, [0, 1], ['0%', '-10%']);
  const sideL = useTransform(bgP, [0, 1], ['-100%', '0%']);
  const sideR = useTransform(bgP, [0, 1], ['100%', '0%']);
  const mx = useMotionValue(0), my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 40, damping: 20 }), sy = useSpring(my, { stiffness: 40, damping: 20 });
  useEffect(() => {
    const move = (e: PointerEvent) => { mx.set(((e.clientX / innerWidth) - 0.5) * 60); my.set(((e.clientY / innerHeight) - 0.5) * 60); };
    addEventListener('pointermove', move);
    return () => removeEventListener('pointermove', move);
  }, [mx, my]);
  const r = rng(77);
  const squares = Array.from({ length: 21 }, () => ({ x: r() * 100, y: r() * 100, d: r() * 4, p: 1.6 + r() * 2.4 }));
  return (
    <section className="sec cta-sec" aria-labelledby="cta-h">
      <div className="container">
        <motion.div ref={ref} className="cta" style={{ borderRadius: radius }}>
          <motion.div className="cta-bg" style={{ opacity: bgOpacity, y: bgY }}>
            <motion.div className="cta-par" style={{ x: sx, y: sy }}>
              <motion.div className="cta-side l" style={{ x: sideL }} />
              <motion.div className="cta-side r" style={{ x: sideR }} />
              {squares.map((s, i) => <i key={i} className="cta-sq" style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${s.d}s`, animationDuration: `${s.p}s` } as CSSProperties} />)}
            </motion.div>
          </motion.div>
          <Reveal className="cta-copy" amount={0.4}>
            <h2 className="t-h1" id="cta-h"><Chars text="Put your agent on a leash." st={0.04} /></h2>
            <Fade as="p" className="t-p cta-p" d={T.para + 0.25}>Write the limits once in Fe. Let the chain enforce them and let your agent see them coming. Try a transaction right now, or read the code.</Fade>
            <Fade d={T.button + 0.3} dur={0.6} className="cta-actions">
              <span className="cta-halo" />
              <Button label="Try a transaction" variant="dark" onClick={() => openConsole(null)} />
              <Button label="GitHub" variant="ghost" href={REPO} className="on-violet" />
            </Fade>
          </Reveal>
        </motion.div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wordmark" aria-hidden="true">
        <div className="marquee-track">
          {Array.from({ length: 4 }, (_, i) => <span key={i}><LeashMark size="0.8em" /> Leash</span>)}
        </div>
      </div>
      <div className="container"><div className="inner">
        <Rails seed={5} rails={3} />
        <div className="foot-card">
          <div className="foot-l">
            <a className="nav-logo" href="#top" onClick={(e) => { e.preventDefault(); scrollToId('top'); }}><LeashMark /> <span>Leash</span></a>
            <p className="t-small">Spending limits for AI agents, written once in Fe and enforced on-chain by a Safe module.</p>
          </div>
          <nav className="foot-links" aria-label="Footer">
            <a href="#demo" onClick={(e) => { e.preventDefault(); scrollToId('demo'); }}>Demo</a>
            <a href="#rules" onClick={(e) => { e.preventDefault(); scrollToId('rules'); }}>Rules</a>
            <a href="#how" onClick={(e) => { e.preventDefault(); scrollToId('how'); }}>How it works</a>
            <a href="/dashboard/">Recorded run</a>
            <a href={REPO} target="_blank" rel="noreferrer">GitHub</a>
            <a href={`${REPO}/releases/tag/cli-v0.1.0`} target="_blank" rel="noreferrer">CLI release</a>
          </nav>
        </div>
        <div className="foot-legal t-small" id="page-end">
          <span>Apache-2.0 · Contracts and CLI written in Fe 26.6.0</span>
          <span>Every demo run happens in a fresh in-memory EVM on the server; nothing touches a real network.</span>
        </div>
      </div></div>
    </footer>
  );
}
