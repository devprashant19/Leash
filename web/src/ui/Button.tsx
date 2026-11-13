import { useEffect, useRef, type ReactNode, type CSSProperties, type MouseEventHandler } from 'react';

// 9×9 dot field on a 0..24 grid. Opacity map: a leash ring (bright) with a lead line to the corner.
const DOTS: Array<[number, number, number]> = [];
for (let y = 0; y <= 24; y += 3) {
  for (let x = 0; x <= 24; x += 3) {
    const dx = x - 10.5, dy = y - 10.5;
    const r = Math.hypot(dx, dy);
    const ring = Math.max(0, 1 - Math.abs(r - 6.4) / 3.2);
    const lead = x >= 15 && y >= 15 && Math.abs(x - y) <= 1 ? 1 : 0;
    const base = Math.max(0.1, Math.min(1, ring * 0.95 + lead * 0.9));
    DOTS.push([x, y, base]);
  }
}
const COLORS = ['#F96D57', '#F8543A', '#F7472B'];

/** Canvas of coral dots that breathe on a slow cosine cycle and ripple outward on hover. */
export function ButtonDots({ busy = false, hoverRef }: { busy?: boolean; hoverRef: React.RefObject<HTMLElement> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let ripple = -1e9;
    const size = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = cv.clientWidth || 32;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(w * dpr);
    };
    size();
    const draw = (now: number) => {
      const W = cv.width;
      const pad = W * 0.16;
      const step = (W - pad * 2) / 24;
      const dot = Math.max(1, step * 1.7);
      ctx.clearRect(0, 0, W, W);
      const cycle = busyRef.current ? 900 : 2600;
      DOTS.forEach(([x, y, base], i) => {
        const phase = (x + y) * 38;
        const t = ((now - phase) % cycle + cycle) % cycle;
        let a = base * (0.55 + 0.45 * (1 - Math.cos((2 * Math.PI * t) / cycle)) / 2);
        const dr = Math.hypot(x - 12, y - 12) / 17;
        const p = Math.min(1, Math.max(0, (now - ripple - dr * 400) / 800));
        if (p > 0 && p < 1) a = Math.min(1, a + Math.sin(p * Math.PI) * 0.9);
        ctx.globalAlpha = reduce ? base : a;
        ctx.fillStyle = COLORS[(i + (x > 12 ? 1 : 0)) % 3];
        ctx.fillRect(pad + x * step - dot / 2, pad + y * step - dot / 2, dot, dot);
      });
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    const host = hoverRef.current;
    const enter = () => { ripple = performance.now(); };
    host?.addEventListener('pointerenter', enter);
    const ro = new ResizeObserver(size);
    ro.observe(cv);
    return () => { cancelAnimationFrame(raf); host?.removeEventListener('pointerenter', enter); ro.disconnect(); };
  }, [hoverRef]);
  return <canvas ref={ref} aria-hidden="true" />;
}

/** Split label whose chars roll up on hover (0.01 s per char, house ease). */
export function RollLabel({ text }: { text: string }) {
  return (
    <span className="btn-label">
      <span className="sr">{text}</span>
      {[...text].map((c, i) => <span aria-hidden="true" key={i} style={{ '--i': i } as CSSProperties}>{c}</span>)}
    </span>
  );
}

export function Button({ children, label, href, onClick, variant = 'light', icon = true, busy = false, disabled, type = 'button', className = '', style, ariaLabel }: {
  children?: ReactNode; label: string; href?: string; onClick?: MouseEventHandler; variant?: 'light' | 'dark' | 'ghost';
  icon?: boolean; busy?: boolean; disabled?: boolean; type?: 'button' | 'submit'; className?: string; style?: CSSProperties; ariaLabel?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const cls = `btn ${variant === 'light' ? '' : variant} ${className}`.trim();
  const inner = (
    <>
      <span className="btn-bg" />
      <RollLabel text={label} />
      {children}
      {icon && variant !== 'ghost' ? <span className="btn-icon"><ButtonDots busy={busy} hoverRef={ref} /></span> : null}
    </>
  );
  if (href) {
    const ext = /^https?:/.test(href);
    return <a ref={ref as never} className={cls} href={href} style={style} aria-label={ariaLabel} {...(ext ? { target: '_blank', rel: 'noreferrer' } : {})}>{inner}</a>;
  }
  return <button ref={ref as never} className={cls} type={type} onClick={onClick} disabled={disabled} aria-busy={busy || undefined} style={style} aria-label={ariaLabel}>{inner}</button>;
}

/** Leash mark: a handle loop (top right) and a curved lead ending in a clasp. Stroke draws on load; tilts with overshoot on hover. */
export function LeashMark({ size = '1.4em' }: { size?: string }) {
  return (
    <svg className="mark" viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <path className="mark-ring" d="M21.5 4.5 C 27 2.5, 30.5 6.5, 27.5 10.5 C 25.5 13, 21 12.5, 20.5 9.5 C 20.2 7.5, 20.6 5.5, 21.5 4.5 Z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" pathLength={1} />
      <path className="mark-lead" d="M21.2 11.2 C 18 16, 13 13.5, 10.5 18.5 C 9 21.5, 9.5 23.5, 8.5 25" fill="none" stroke="#9b4dff" strokeWidth="2.6" strokeLinecap="square" pathLength={1} />
      <rect className="mark-knot" x="4.8" y="24.6" width="6" height="5" rx="1" fill="#ea5d56" />
    </svg>
  );
}

/** Mono eyebrow with the violet square bullet. */
export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`t-mono eyebrow ${className}`}>{children}</div>;
}
