import { createElement, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/** Wait for web fonts so split text is measured and revealed in its final face. */
export const fontsReady: Promise<unknown> =
  typeof document !== 'undefined' && document.fonts ? document.fonts.ready.catch(() => undefined) : Promise.resolve();

/** True once the element has been `amount` in view (fires once). */
export function useInViewOnce<T extends Element>(amount = 0.35, rootMargin = '0px') {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect(); }
    }, { threshold: amount, rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [amount, rootMargin, seen]);
  return [ref, seen] as const;
}

type Tag = keyof JSX.IntrinsicElements;

/**
 * Scope for CSS-driven reveals. Adds `reveal-on` once triggered, which starts every
 * `.ch` / `.fade` / `.rule` inside it with its own delay.
 *  mode "view": when `amount` of it is in the viewport. mode "load": after fonts + `delay`.
 */
export function Reveal({ as = 'div', mode = 'view', amount = 0.3, delay = 0, className = '', style, children, id }: {
  as?: Tag; mode?: 'view' | 'load'; amount?: number; delay?: number; className?: string; style?: CSSProperties; children: ReactNode; id?: string;
}) {
  const [ref, seen] = useInViewOnce<HTMLElement>(amount);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (mode !== 'load') return;
    let t: number | undefined;
    fontsReady.then(() => { t = window.setTimeout(() => setLoaded(true), delay * 1000); });
    return () => window.clearTimeout(t);
  }, [mode, delay]);
  const on = mode === 'load' ? loaded : seen;
  return createElement(as, { ref, id, style, className: `${className} ${on ? 'reveal-on' : ''}`.trim() }, children);
}

/**
 * Split a string into per-char spans (words kept unbroken). Screen readers get the plain text.
 * d: start delay (s); st: stagger per char (s); tail: blur ramp over the last `tail.chars` chars, up to `tail.px`.
 */
export function Chars({ text, d = 0, st = 0.034, tail, className }: {
  text: string; d?: number; st?: number; tail?: { chars: number; px: number }; className?: string;
}) {
  const words = text.split(' ');
  let i = 0;
  const total = text.replace(/ /g, '').length;
  return (
    <span className={className}>
      <span className="sr">{text}</span>
      <span aria-hidden="true">
        {words.map((w, wi) => (
          <span key={wi}>
            <span className="sr-word">
              {[...w].map((c) => {
                const idx = i++;
                const fromEnd = total - idx;
                const be = tail && fromEnd <= tail.chars ? (tail.px * (tail.chars - fromEnd + 1)) / tail.chars : 0;
                const style = { '--i': idx, '--d': `${d}s`, '--st': `${st}s`, ...(be ? { '--be': `${be.toFixed(2)}px` } : {}) } as CSSProperties;
                return <span className="ch" style={style} key={idx}>{c}</span>;
              })}
            </span>
            {wi < words.length - 1 ? ' ' : null}
          </span>
        ))}
      </span>
    </span>
  );
}

/** Block that fades up out of blur, `d` seconds after its Reveal scope triggers. */
export function Fade({ as = 'div', d = 0, dur = 0.5, className = '', style, children }: {
  as?: Tag; d?: number; dur?: number; className?: string; style?: CSSProperties; children: ReactNode;
}) {
  return createElement(as, { className: `fade ${className}`.trim(), style: { '--d': `${d}s`, '--fd': `${dur}s`, ...style } as CSSProperties }, children);
}

/** Measured hero/section timing: paragraph starts 0.53 s after the first char, button 0.5 s after that. */
export const T = { para: 0.53, button: 1.03 };
