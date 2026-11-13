import { useEffect, useRef, useState } from 'react';

const SEG_COLORS = ['#7f0fd5', '#ea5d56', '#3b383d', '#9b4dff', '#4e0a83'];

/** Deterministic pseudo-random (so the layout is identical on every load). */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Band of horizontal 1px rails whose coloured segments drift sideways on a clock
 * (~24 px/s at 1440 wide), neighbouring rails in opposite directions.
 */
export function Rails({ seed = 1, rails = 4, className = '' }: { seed?: number; rails?: number; className?: string }) {
  const r = rng(seed);
  const rows = Array.from({ length: rails }, (_, k) => {
    const segs: Array<{ w: number; gap: number; c: string }> = [];
    let total = 0;
    while (total < 100) {
      const gap = 6 + r() * 22;
      const w = 4 + r() * 16;
      segs.push({ w, gap, c: SEG_COLORS[Math.floor(r() * SEG_COLORS.length)] });
      total += w + gap;
    }
    return { segs, total, dur: 52 + r() * 18, top: (k + 0.5) * (100 / rails) };
  });
  return (
    <div className={`rails ${className}`} aria-hidden="true">
      {rows.map((row, k) => (
        <div className="rail" key={k} style={{ top: `${row.top}%` }}>
          <div className={`rail-track ${k % 2 ? 'rev' : ''}`} style={{ animationDuration: `${row.dur}s` }}>
            {[0, 1].map((rep) =>
              row.segs.map((s, j) => (
                <span key={`${rep}-${j}`} style={{ width: `${(s.w / row.total) * 50}%`, marginLeft: `${(s.gap / row.total) * 50}%`, background: s.c, opacity: s.c === '#3b383d' ? 0.9 : 0.75 }} />
              )),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Fixed bottom band that progressively blurs content scrolling up into view; hidden at the page end. */
export function ProgressiveBlur() {
  const [off, setOff] = useState(false);
  useEffect(() => {
    const end = document.getElementById('page-end');
    if (!end) return;
    const io = new IntersectionObserver(([e]) => setOff(e.isIntersecting || e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(end);
    return () => io.disconnect();
  }, []);
  return (
    <div className={`pblur ${off ? 'off' : ''}`} aria-hidden="true">
      <i /><i /><i /><i /><i /><i />
    </div>
  );
}

/** Grid backdrop with a few twinkling squares at intersections. */
export function Grid({ fade = false, dots = 10, seed = 7 }: { fade?: boolean; dots?: number; seed?: number }) {
  const r = rng(seed);
  const pts = Array.from({ length: dots }, () => ({ x: Math.floor(r() * 18) - 9, y: 1 + Math.floor(r() * 8), c: r() > 0.5 ? 'var(--violet-dot)' : 'var(--coral)', d: r() * 6, p: 3 + r() * 5 }));
  return (
    <div className={`grid-wrap ${fade ? 'grid-fade' : ''}`} aria-hidden="true">
      <div className="grid-bg" />
      {pts.map((p, i) => (
        <span key={i} className="grid-dot" style={{ left: `calc(50% + ${p.x} * var(--cell))`, top: `calc(${p.y} * var(--cell))`, background: p.c, animationDelay: `${p.d}s`, animationDuration: `${p.p}s` }} />
      ))}
    </div>
  );
}

/** Pointer position relative to an element, as CSS vars --mx/--my (px), rAF-throttled. */
export function usePointerVars<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const b = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - b.left}px`);
        el.style.setProperty('--my', `${e.clientY - b.top}px`);
      });
    };
    el.addEventListener('pointermove', move);
    return () => { el.removeEventListener('pointermove', move); cancelAnimationFrame(raf); };
  }, []);
  return ref;
}
