import { useEffect, useRef, useState } from 'react';
import { renderDither, reducedMotion, useCanvas, type ArtKind } from './canvas';
import { useInViewOnce } from '../motion/Reveal';

// Measured reveal: ~10 hard steps, ~160 ms each, block size 51 → 2 CSS px, flat block colours, once.
const STEPS = [51, 38, 28, 20, 14, 10, 7, 5, 3.5, 0];

/**
 * Generated dither artwork that pixelates in once it is on screen.
 * A violet ▷ placeholder holds the frame until the reveal starts.
 */
export function DitherArt({ kind, className = '', colors, cell = 2 }: { kind: ArtKind; className?: string; colors?: [string, string]; cell?: number }) {
  const [wrap, seen] = useInViewOnce<HTMLDivElement>(0.25);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (!seen) return;
    const cv = cvRef.current;
    if (!cv) return;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const w = Math.max(2, Math.round(cv.clientWidth * dpr));
    const h = Math.max(2, Math.round(cv.clientHeight * dpr));
    cv.width = w; cv.height = h;
    const src = renderDither(kind, w, h, Math.max(1, Math.round(cell * dpr)), colors);
    const ctx = cv.getContext('2d')!;
    const tmp = document.createElement('canvas');
    const tctx = tmp.getContext('2d')!;
    const drawStep = (b: number) => {
      if (!b) { ctx.imageSmoothingEnabled = true; ctx.drawImage(src, 0, 0); return; }
      const px = b * dpr;
      tmp.width = Math.max(1, Math.round(w / px));
      tmp.height = Math.max(1, Math.round(h / px));
      tctx.imageSmoothingEnabled = true;
      tctx.drawImage(src, 0, 0, tmp.width, tmp.height);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(tmp, 0, 0, w, h);
    };
    setStarted(true);
    if (reducedMotion()) { drawStep(0); return; }
    let k = 0;
    drawStep(STEPS[0]);
    const id = window.setInterval(() => {
      k++;
      drawStep(STEPS[k]);
      if (k >= STEPS.length - 1) window.clearInterval(id);
    }, 160);
    return () => window.clearInterval(id);
  }, [seen, kind, cell, colors]);
  return (
    <div ref={wrap} className={`art ${className}`} aria-hidden="true">
      <canvas ref={cvRef} />
      {!started && <span className="art-ph">▷</span>}
    </div>
  );
}

type CloudKind = 'drift' | 'infinity' | 'spiral' | 'lock';

function cloudPoints(kind: CloudKind, n: number): Array<[number, number, number]> {
  const pts: Array<[number, number, number]> = [];
  let s = 12345;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < n; i++) {
    let x = 0, y = 0;
    const t = r() * Math.PI * 2;
    const j = () => (r() - 0.5) * 0.06;
    if (kind === 'infinity') { // lemniscate: approvals that never end
      const d = 1 + Math.sin(t) ** 2;
      x = (0.42 * Math.cos(t)) / d + j(); y = (0.42 * Math.sin(t) * Math.cos(t)) / d + j();
    } else if (kind === 'spiral') { // runaway loop
      const u = r();
      const a = u * Math.PI * 7;
      const rad = 0.04 + u * 0.36;
      x = Math.cos(a) * rad + j() * 0.6; y = Math.sin(a) * rad + j() * 0.6;
    } else if (kind === 'drift') { // two copies of one rulebook, drifting apart
      const which = r() > 0.5 ? 1 : 0;
      const ox = which ? 0.08 : -0.08, oy = which ? 0.06 : -0.06;
      const side = Math.floor(r() * 4);
      const u = r() - 0.5;
      const [bx, by] = side === 0 ? [u * 0.4, -0.25] : side === 1 ? [u * 0.4, 0.25] : side === 2 ? [-0.2, u * 0.5] : [0.2, u * 0.5];
      const line = r() < 0.35 ? [(r() - 0.5) * 0.3, -0.15 + Math.floor(r() * 6) * 0.06] : null;
      x = (line ? line[0] : bx) + ox + j() * 0.5; y = (line ? line[1] : by) + oy + j() * 0.5;
    } else { // padlock
      if (r() < 0.6) { x = (r() - 0.5) * 0.46; y = 0.02 + r() * 0.3; if (r() < 0.5) { x = Math.sign(x) * 0.23; } }
      else { const a = Math.PI + r() * Math.PI; x = Math.cos(a) * 0.15; y = Math.sin(a) * 0.17 + 0.02; }
      x += j() * 0.5; y += j() * 0.5;
    }
    pts.push([x, y, 0.25 + r() * 0.75]);
  }
  return pts;
}

/**
 * Point-cloud illustration. No idle motion (as measured): points lean up to ~10 px toward
 * the cursor, easing in ~0.2 s and out ~0.6 s.
 */
export function PointCloud({ kind, className = '' }: { kind: CloudKind; className?: string }) {
  const pts = useRef(cloudPoints(kind, 1400)).current;
  const pointer = useRef({ x: -1e4, y: -1e4, k: 0, target: 0 });
  const offs = useRef(pts.map(() => [0, 0]));
  const ref = useCanvas((ctx, w, h) => {
    const p = pointer.current;
    p.k += (p.target - p.k) * (p.target > p.k ? 0.18 : 0.05);
    ctx.clearRect(0, 0, w, h);
    const s = Math.min(w, h);
    const dot = Math.max(1, s / 260);
    for (let i = 0; i < pts.length; i++) {
      const [x, y, a] = pts[i];
      let px = w / 2 + x * s, py = h / 2 + y * s;
      const dx = p.x - px, dy = p.y - py;
      const d = Math.hypot(dx, dy);
      const pull = p.k * Math.max(0, 1 - d / (s * 0.45)) * s * 0.035;
      const o = offs.current[i];
      o[0] += ((d ? (dx / d) * pull : 0) - o[0]) * 0.2;
      o[1] += ((d ? (dy / d) * pull : 0) - o[1]) * 0.2;
      px += o[0]; py += o[1];
      ctx.globalAlpha = a * 0.85;
      ctx.fillStyle = a > 0.9 ? '#efedf0' : '#b6b2b8';
      ctx.fillRect(px, py, dot, dot);
    }
  });
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const move = (e: PointerEvent) => {
      const b = cv.getBoundingClientRect();
      const dpr = cv.width / b.width;
      pointer.current.x = (e.clientX - b.left) * dpr;
      pointer.current.y = (e.clientY - b.top) * dpr;
      pointer.current.target = 1;
    };
    const leave = () => { pointer.current.target = 0; };
    const host = cv.parentElement!;
    host.addEventListener('pointermove', move);
    host.addEventListener('pointerleave', leave);
    return () => { host.removeEventListener('pointermove', move); host.removeEventListener('pointerleave', leave); };
  }, [ref]);
  return <canvas ref={ref} className={`cloud ${className}`} aria-hidden="true" />;
}

/** Dotted sphere (Fibonacci points), coral→lilac lit from the right, drifting ~2°/s, with square markers. */
export function Globe({ markers }: { markers: Array<{ lat: number; lon: number; label: string }> }) {
  const N = 1100;
  const pts = useRef(Array.from({ length: N }, (_, i) => {
    const y = 1 - (i / (N - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const th = i * Math.PI * (3 - Math.sqrt(5));
    return [Math.cos(th) * rad, y, Math.sin(th) * rad];
  })).current;
  const labels = useRef<HTMLDivElement>(null);
  const ref = useCanvas((ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h);
    const R = Math.min(w, h) * 0.46;
    const cx = w / 2, cy = h / 2;
    const rot = (t / 1000) * (2 * Math.PI / 180) + 0.6;
    const tilt = -0.32;
    const cr = Math.cos(rot), sr = Math.sin(rot), ct = Math.cos(tilt), st = Math.sin(tilt);
    const dot = Math.max(1.2, R / 120);
    for (const [x0, y0, z0] of pts) {
      const x = x0 * cr - z0 * sr;
      const z1 = x0 * sr + z0 * cr;
      const y = y0 * ct - z1 * st;
      const z = y0 * st + z1 * ct;
      if (z < -0.15) continue;
      const light = Math.max(0, 0.25 + 0.75 * (x * 0.8 + z * 0.6));
      ctx.globalAlpha = Math.min(1, 0.12 + light * 0.9) * (0.35 + 0.65 * (z + 0.15));
      ctx.fillStyle = x > 0.1 ? '#ee8a56' : '#b185fa';
      ctx.fillRect(cx + x * R, cy - y * R, dot, dot);
    }
    const box = labels.current;
    if (box) {
      const dpr = w / (box.clientWidth || 1);
      markers.forEach((m, i) => {
        const la = (m.lat * Math.PI) / 180, lo = (m.lon * Math.PI) / 180;
        const x0 = Math.cos(la) * Math.cos(lo), y0 = Math.sin(la), z0 = Math.cos(la) * Math.sin(lo);
        const x = x0 * cr - z0 * sr;
        const z1 = x0 * sr + z0 * cr;
        const y = y0 * ct - z1 * st;
        const z = y0 * st + z1 * ct;
        const el = box.children[i] as HTMLElement | undefined;
        if (!el) return;
        el.style.transform = `translate(${(cx + x * R) / dpr}px, ${(cy - y * R) / dpr}px)`;
        el.style.opacity = z > 0 ? '1' : '0.15';
        // Labels on the right half sit to the left of their marker so they never leave the frame.
        el.classList.toggle('flip', x > 0.05);
      });
    }
  });
  return (
    <div className="globe">
      <canvas ref={ref} aria-hidden="true" />
      <div className="globe-markers" ref={labels}>
        {markers.map((m) => (
          <div className="globe-marker" key={m.label}><i /><span className="t-mono">{m.label}</span></div>
        ))}
      </div>
    </div>
  );
}
