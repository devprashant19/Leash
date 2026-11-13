import { useEffect, useMemo, useRef, useState } from 'react';
import { animate, motion, useMotionValue } from 'motion/react';
import { Head } from './Story';
import { Fade, Reveal } from '../motion/Reveal';
import { REASONS, RULES } from '../lib/data';
import { useStore } from '../lib/store';
import { renderDither } from '../gfx/canvas';

const P3OUT = [0.33, 1, 0.68, 1] as const;

/**
 * The rules list. Hover-driven like the reference: rows rest at 20% and the hovered row lights up
 * over .6 s; a 24em code card glides to the cursor's x (0.5 s power3.out retarget) and sits on the
 * hovered row. On touch screens the row in the middle of the viewport is active and shows its code inline.
 */
export function Rules() {
  const listRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [inside, setInside] = useState(false);
  const [canHover, setCanHover] = useState(true);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const bg = useMemo(() => (typeof document === 'undefined' ? '' : renderDither('wave', 240, 240, 2, ['#7f0fd5', '#e66157']).toDataURL()), []);

  useEffect(() => {
    const mq = matchMedia('(hover: hover) and (pointer: fine)');
    const set = () => setCanHover(mq.matches);
    set();
    mq.addEventListener('change', set);
    return () => mq.removeEventListener('change', set);
  }, []);

  // Touch: activate the row crossing the middle of the viewport.
  useEffect(() => {
    if (canHover || !listRef.current) return;
    const rows = [...listRef.current.querySelectorAll<HTMLElement>('.rule-row')];
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i)); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    rows.forEach((r) => io.observe(r));
    return () => io.disconnect();
  }, [canHover]);

  const place = (clientX: number, rowEl: HTMLElement | null) => {
    const list = listRef.current;
    if (!list || !rowEl) return;
    const lb = list.getBoundingClientRect();
    const card = list.querySelector<HTMLElement>('.rule-card');
    const cw = card?.offsetWidth ?? 300, ch = card?.offsetHeight ?? 300;
    const tx = Math.min(lb.width - cw, Math.max(0, clientX - lb.left - cw / 2));
    const ty = rowEl.offsetTop + rowEl.offsetHeight / 2 - ch / 2;
    animate(x, tx, { duration: 0.5, ease: P3OUT });
    animate(y, ty, { duration: 0.5, ease: P3OUT });
  };

  return (
    <section className="sec" id="rules" aria-labelledby="rules-h">
      <div className="container"><div className="inner">
        <div className="pad rules-head">
          <Head id="rules-h" eyebrow="The rules" title="Eight limits, checked twice." sub="Each rule is a plain Fe function. Point at one (or scroll on a phone) to see the exact line that enforces it." />
        </div>
        <div className={`rules-list ${canHover ? 'hoverable' : 'touch'} ${inside ? 'inside' : ''}`} ref={listRef}
          onPointerEnter={() => setInside(true)} onPointerLeave={() => setInside(false)}>
          {canHover && (
            <motion.div className={`rule-card ${inside ? 'on' : ''}`} style={{ x, y }} aria-hidden="true">
              <div className="rule-card-bg" style={{ backgroundImage: `url(${bg})` }} />
              {RULES.map((r, i) => (
                <div key={r.title} className={`rule-code ${i === active ? 'on' : ''}`}>
                  <div className="t-mono rule-at">{r.at}</div>
                  <pre className="t-code">{r.code.join('\n')}</pre>
                </div>
              ))}
            </motion.div>
          )}
          {RULES.map((r, i) => (
            <Reveal key={r.title} amount={0.4} className={`rule-row ${i === active ? 'active' : ''}`}>
              <div data-i={i} className="rule-hit" tabIndex={0}
                onPointerEnter={(e) => { setActive(i); place(e.clientX, e.currentTarget.parentElement); }}
                onPointerMove={(e) => place(e.clientX, e.currentTarget.parentElement)}
                onFocus={(e) => { setActive(i); setInside(true); place(e.currentTarget.getBoundingClientRect().right - 260, e.currentTarget.parentElement); }}
                onBlur={() => setInside(false)}>
                <span className="rule-bar" />
                <Fade d={0}><h3 className="t-h3 rule-title">{r.title}</h3></Fade>
                <Fade as="p" className="t-small rule-text" d={0.15}>{r.text}</Fade>
                {!canHover && (
                  <div className="rule-inline" aria-hidden={i !== active}>
                    <div className="t-mono rule-at">{r.at}</div>
                    <pre className="t-code">{r.code.join('\n')}</pre>
                  </div>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </div></div>
    </section>
  );
}

/** 21 deny codes. Cells brighten slowly, staggered by column; codes hit by a live run glow coral. */
export function DenyCodes() {
  const { hitCodes } = useStore();
  const [focus, setFocus] = useState<number | null>(null);
  const cols = 7;
  return (
    <section className="sec" aria-labelledby="codes-h">
      <div className="container"><div className="inner">
        <div className="pad codes-head">
          <Head id="codes-h" eyebrow="Deny codes" title="Every refusal has a number." sub="The CLI and the contract return the same code for the same reason, so an agent can tell exactly which limit it hit." />
        </div>
        <Reveal className="codes" amount={0.15}>
          {REASONS.map((r, i) => (
            <button key={r.name} type="button" className={`code ${hitCodes.includes(i) ? 'hit' : ''} ${i === 0 ? 'zero' : ''}`}
              style={{ '--c': i % cols } as React.CSSProperties}
              onPointerEnter={() => setFocus(i)} onFocus={() => setFocus(i)} onPointerLeave={() => setFocus(null)} onBlur={() => setFocus(null)}
              aria-describedby="code-msg">
              <span className="code-n t-code">{String(i).padStart(2, '0')}</span>
              <span className="code-name">{r.name}</span>
            </button>
          ))}
        </Reveal>
        <p id="code-msg" className="codes-msg t-small" aria-live="polite">
          {focus != null
            ? <><b className="t-code">{String(focus).padStart(2, '0')} {REASONS[focus].name}</b> — {REASONS[focus].msg}</>
            : hitCodes.length ? <>Coral cells: codes your last run hit ({hitCodes.map((c) => REASONS[c].name).join(', ')}).</>
            : <>Hover or focus a code to read it. Codes hit by your live run turn coral.</>}
        </p>
      </div></div>
    </section>
  );
}
