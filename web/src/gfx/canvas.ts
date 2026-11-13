import { useEffect, useRef } from 'react';

export const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Canvas sized to its CSS box (DPR capped at 1.5), with a draw loop that only runs while
 * the canvas is on screen. `draw(ctx, w, h, t)` gets device pixels and ms since start.
 * If `animate` is false it draws once per resize.
 */
export function useCanvas(draw: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void, animate = true, deps: unknown[] = []) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    let raf = 0;
    let visible = false;
    const t0 = performance.now();
    const fit = () => {
      const w = Math.max(1, Math.round(cv.clientWidth * dpr));
      const h = Math.max(1, Math.round(cv.clientHeight * dpr));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    };
    const frame = (now: number) => {
      fit();
      drawRef.current(ctx, cv.width, cv.height, now - t0);
      if (animate && visible && !reducedMotion()) raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver(([e]) => {
      const was = visible;
      visible = e.isIntersecting;
      if (visible && !was) { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
    }, { rootMargin: '120px' });
    io.observe(cv);
    const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); });
    ro.observe(cv);
    return () => { cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate, ...deps]);
  return ref;
}

export const BAYER8 = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
].map((v) => (v + 0.5) / 64);

export type ArtKind = 'vault' | 'knot' | 'orbit' | 'split' | 'agent' | 'stack' | 'gate' | 'wave';

/** Luminance field (0..1) for each generated artwork, in unit coordinates (x,y ∈ 0..1, aspect a = w/h). */
function field(kind: ArtKind, x: number, y: number, a: number): number {
  const cx = (x - 0.5) * a, cy = y - 0.5;
  const r = Math.hypot(cx, cy);
  const ang = Math.atan2(cy, cx);
  switch (kind) {
    case 'vault': { // round vault door with spokes and bolts
      const door = Math.max(0, 1 - Math.abs(r - 0.33) / 0.05);
      const dial = Math.max(0, 1 - r / 0.12) * 0.9;
      const spokes = r < 0.28 && r > 0.12 ? Math.pow(Math.abs(Math.cos(ang * 3)), 18) * 0.85 : 0;
      const bolts = Math.abs(r - 0.4) < 0.025 && Math.abs(Math.sin(ang * 6)) > 0.94 ? 1 : 0;
      return Math.min(1, door + dial + spokes + bolts + 0.18 * (1 - y));
    }
    case 'knot': { // big leash mark: ring + diagonal lead
      const ring = Math.max(0, 1 - Math.abs(Math.hypot(cx + 0.08 * a, cy + 0.08) - 0.24) / 0.06);
      const t = (cx + cy) / 2;
      const lead = Math.abs(cx - cy) < 0.07 && t > 0.08 && t < 0.42 ? 1 - Math.abs(cx - cy) / 0.07 : 0;
      return Math.min(1, ring + lead + 0.25 * Math.exp(-r * 4));
    }
    case 'orbit': { // planet with a tilted ring
      const planet = Math.max(0, 1 - r / 0.22);
      const ry = (cy - cx * 0.35) * 3.2;
      const band = Math.max(0, 1 - Math.abs(Math.hypot(cx, ry) - 0.38) / 0.04) * (cy - cx * 0.35 > -0.01 || r > 0.22 ? 1 : 0.2);
      return Math.min(1, planet * 0.95 + band + 0.15 * Math.random());
    }
    case 'split': { // one source splitting into two streams
      const stem = x < 0.42 ? Math.max(0, 1 - Math.abs(cy) / 0.06) : 0;
      const up = x >= 0.42 ? Math.max(0, 1 - Math.abs(cy + (x - 0.42) * 0.7) / 0.05) : 0;
      const dn = x >= 0.42 ? Math.max(0, 1 - Math.abs(cy - (x - 0.42) * 0.7) / 0.05) : 0;
      return Math.min(1, stem + up + dn + 0.12 * (1 - r));
    }
    case 'agent': { // abstract agent: head circle + shoulders arc
      const head = Math.max(0, 1 - Math.abs(Math.hypot(cx, cy + 0.12) - 0.13) / 0.04) + Math.max(0, 1 - Math.hypot(cx, cy + 0.12) / 0.1) * 0.5;
      const body = cy > 0.12 ? Math.max(0, 1 - Math.abs(Math.hypot(cx * 0.8, cy - 0.42) - 0.3) / 0.05) : 0;
      return Math.min(1, head + body + 0.2 * y);
    }
    case 'stack': { // stacked blocks (chain of transactions)
      const row = Math.floor(y * 6);
      const off = ((row * 37) % 5) / 10;
      const inBlock = Math.abs(((x + off) * 4) % 1 - 0.5) < 0.38 && Math.abs((y * 6) % 1 - 0.5) < 0.36;
      return inBlock ? 0.35 + 0.6 * ((row + 1) / 6) : 0.06;
    }
    case 'gate': { // arch gate
      const inner = cy > -0.05 ? Math.abs(cx) < 0.18 : Math.hypot(cx, cy + 0.05) < 0.18;
      const outer = cy > -0.05 ? Math.abs(cx) < 0.3 : Math.hypot(cx, cy + 0.05) < 0.3;
      return outer && !inner && y < 0.92 ? 0.9 : 0.1 + 0.25 * (1 - y);
    }
    default: { // wave band
      const w = Math.sin(x * 9 + y * 3) * 0.08;
      return Math.max(0, 1 - Math.abs(cy - w) / 0.18) * 0.9 + 0.1;
    }
  }
}

/** Render a two-colour ordered (Bayer 8×8) dither of an artwork into a canvas. cell = device px per dither cell. */
export function renderDither(kind: ArtKind, w: number, h: number, cell: number, colors: [string, string] = ['#7f0fd5', '#e66157']): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d')!;
  const cols = Math.ceil(w / cell), rows = Math.ceil(h / cell);
  const a = w / h;
  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = colors[1];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const v = field(kind, (i + 0.5) / cols, (j + 0.5) / rows, a);
      if (v > BAYER8[(j % 8) * 8 + (i % 8)]) ctx.fillRect(i * cell, j * cell, cell, cell);
    }
  }
  return cv;
}
