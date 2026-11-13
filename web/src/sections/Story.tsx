import { Button, Eyebrow } from '../ui/Button';
import { Chars, Fade, Reveal, T } from '../motion/Reveal';
import { Odometer } from '../motion/Odometer';
import { ScrubChars } from '../motion/Scrub';
import { Grid, Rails } from '../motion/Ambient';
import { DitherArt } from '../gfx/Art';
import { REPO } from '../lib/data';
import { scrollToId, useStore } from '../lib/store';

/** Section heading block: eyebrow, accent rule, split heading. */
export function Head({ eyebrow, title, center = false, sub, size = 't-h2', id }: { eyebrow: string; title: string; center?: boolean; sub?: string; size?: string; id?: string }) {
  return (
    <Reveal className={`head ${center ? 'center' : ''}`} id={id}>
      {!center && <span className="rule" style={{ top: 0, bottom: 0 }} />}
      <Fade d={0} dur={0.5}><Eyebrow>{eyebrow}</Eyebrow></Fade>
      <h2 className={size}><Chars text={title} d={0.1} /></h2>
      {sub && <Fade as="p" className="t-p head-sub" d={T.para}>{sub}</Fade>}
    </Reveal>
  );
}

const RINGS = [
  { r: 95, dir: 1, items: [{ a: 20, label: 'PER-TX CAP', c: 'var(--coral)' }, { a: 200, c: 'var(--coral)' }] },
  { r: 175, dir: -1, items: [{ a: 120, label: 'ALLOWLIST', c: 'var(--violet-2)' }, { a: 300, label: 'SELECTORS', c: 'var(--violet-2)' }, { a: 30, c: 'var(--violet-2)' }] },
  { r: 255, dir: 1, items: [{ a: 75, label: 'BREAKER', c: '#efedf0' }, { a: 250, label: 'GUARDIAN', c: '#efedf0' }, { a: 160, c: '#efedf0' }, { a: 330, c: '#efedf0' }] },
];

/** Orbit: the rule families circling the pure decide() core. Rings turn at 12°/s, alternating. */
export function Checks() {
  return (
    <section className="sec" aria-labelledby="checks-h">
      <div className="container"><div className="inner pad checks">
        <Head id="checks-h" eyebrow="One function decides" title="What the policy checks" center />
        <div className="orbit" aria-hidden="true">
          <svg viewBox="0 0 600 600">
            <defs>
              <radialGradient id="core-glow"><stop offset="0" stopColor="#ea5d56" stopOpacity=".35" /><stop offset="1" stopColor="#ea5d56" stopOpacity="0" /></radialGradient>
            </defs>
            {RINGS.map((ring, k) => (
              <g key={k} className={`ring ${ring.dir < 0 ? 'ccw' : ''}`} style={{ animationDuration: '30s' }}>
                <circle cx="300" cy="300" r={ring.r} fill="none" stroke="var(--line)" />
                {ring.items.map((it, j) => {
                  const x = 300 + ring.r * Math.cos((it.a * Math.PI) / 180);
                  const y = 300 + ring.r * Math.sin((it.a * Math.PI) / 180);
                  return (
                    <g key={j}>
                      <rect x={x - 4} y={y - 4} width="8" height="8" fill={it.c} />
                      {it.label && (
                        <g className={`upright ${ring.dir < 0 ? 'ccw' : ''}`}>
                          <rect x={x + 12} y={y - 11} width={it.label.length * 8.4 + 16} height="22" fill="var(--bg)" stroke="var(--line-2)" />
                          <text x={x + 20} y={y + 4} className="orbit-label">{it.label}</text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            ))}
            <circle cx="300" cy="300" r="70" fill="url(#core-glow)" className="core-glow" />
            <circle cx="300" cy="300" r="13" fill="none" stroke="var(--coral)" strokeWidth="2" />
            <text x="300" y="336" textAnchor="middle" className="orbit-label core">DECIDE()</text>
          </svg>
        </div>
        <Reveal className="center-row"><Fade d={0.1}><Button label="Read the policy (rules.fe)" variant="ghost" href={`${REPO}/blob/main/ingots/policy/src/rules.fe#L189`} /></Fade></Reveal>
      </div></div>
    </section>
  );
}

const STATS = [
  { v: '22,029', k: 'Bytes of runtime', d: 'LeashModule compiled from Fe, 2,547 bytes under the EVM limit.' },
  { v: '21', k: 'Deny codes', d: 'Every refusal has a stable number the agent and the chain agree on.' },
  { v: '159', k: 'EVM tests', d: 'Plus 119 native tests and 77 shared vectors run on both targets.' },
  { v: '1', k: 'Fingerprint', d: 'The CLI and the contract hash the same policy to the same value.' },
];

export function Stats() {
  return (
    <section className="sec" aria-labelledby="impact-h">
      <div className="container"><div className="inner">
        <div className="pad impact">
          <Head id="impact-h" eyebrow="Impact" title="When a policy becomes provable." sub="The limits an AI agent lives under are code you can read, test and hash, not a prompt it can talk its way around." />
          <div className="impact-art"><Grid seed={5} dots={4} /><DitherArt kind="vault" className="impact-dither" /></div>
        </div>
        <div className="stats">
          {STATS.map((s, i) => (
            <Reveal className="stat" key={s.k} amount={0.2}>
              <div className="t-stat"><Odometer value={s.v} delay={i * 0.12} /></div>
              <div>
                <Fade d={0.9 + i * 0.08}><h3 className="stat-k">{s.k}</h3></Fade>
                <Fade as="p" className="t-small" d={1 + i * 0.08}>{s.d}</Fade>
              </div>
            </Reveal>
          ))}
        </div>
      </div></div>
    </section>
  );
}

export function Intro() {
  const { run } = useStore();
  return (
    <section className="sec" aria-label="Why Leash">
      <div className="container"><div className="inner">
        <Rails seed={8} rails={3} />
        <div className="midcta">
          <Grid seed={21} dots={6} />
          <Reveal className="midcta-row"><Fade d={0}>
            <Button label="Run the demo" onClick={() => { run(); window.setTimeout(() => scrollToId('demo-run'), 80); }} />
          </Fade></Reveal>
        </div>
        <div className="pad intro">
          <Reveal><Fade d={0}><Eyebrow>Agents hold keys now</Eyebrow></Fade></Reveal>
          <ScrubChars className="intro-p" as="p"
            text="An AI agent with a wallet will one day be told, convincingly, to send everything somewhere else. Leash puts a Safe module between the agent and the money. Every call runs through the same Fe function the agent's own CLI ran a moment earlier, so what the agent expects and what the chain enforces are the same answer." />
        </div>
      </div></div>
    </section>
  );
}
