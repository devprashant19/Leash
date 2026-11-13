import { useEffect, useState, type CSSProperties } from 'react';
import { useInViewOnce } from './Reveal';

/**
 * Slot-machine digits: each digit column rolls upward to its value (+1 full turn so zeros spin too),
 * ~1.4 s power2.out, columns 90 ms apart, starting as the number enters the viewport.
 * `value` is display text such as "22,029" or "$680M+"; non-digits stay static.
 */
export function Odometer({ value, className, delay = 0, play }: { value: string; className?: string; delay?: number; play?: boolean }) {
  const [ref, seen] = useInViewOnce<HTMLSpanElement>(0.1);
  const [go, setGo] = useState(false);
  const on = play ?? seen;
  useEffect(() => {
    if (!on) return;
    const t = window.setTimeout(() => setGo(true), 30);
    return () => window.clearTimeout(t);
  }, [on]);
  let col = 0;
  return (
    <span ref={ref} className={`odo ${className ?? ''}`} aria-label={value} role="text">
      {[...value].map((c, i) => {
        if (!/\d/.test(c)) return <span key={i} className="odo-static" aria-hidden="true">{c}</span>;
        const d = Number(c);
        const idx = col++;
        const style = {
          transform: go ? `translateY(${-(10 + d) * 1.1}em)` : 'translateY(0)',
          transitionDelay: `${delay + idx * 0.09}s`,
        } as CSSProperties;
        return (
          <span key={i} className="odo-col" aria-hidden="true">
            <span className="odo-strip" style={style}>
              {Array.from({ length: 20 }, (_, k) => <span key={k}>{k % 10}</span>)}
            </span>
            <span className="odo-sizer">{c}</span>
          </span>
        );
      })}
    </span>
  );
}

/** Plain count-up with brightening colour, for "0 → N" figures. */
export function CountUp({ to, dur = 2, play, format = (n: number) => String(n), className }: {
  to: number; dur?: number; play: boolean; format?: (n: number) => string; className?: string;
}) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!play) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / (dur * 1000));
      const e = 1 - Math.pow(1 - p, 2);
      setN(to * e);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [play, to, dur]);
  const p = to ? n / to : 1;
  return <span className={className} style={{ opacity: 0.45 + 0.55 * p }}>{format(Math.round(n))}</span>;
}
