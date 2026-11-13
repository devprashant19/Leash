import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getHealth, getRecordedRun, runDemo, runTour } from './api';
import type { DemoResult, Health, RecordedRun, TourResult } from './types';

export type DemoMode = 'quick' | 'tour';

export type DemoStatus = 'idle' | 'running' | 'done' | 'error';

interface Store {
  health: Health | null;
  healthError: string | null;
  recorded: RecordedRun | null;
  status: DemoStatus;
  result: DemoResult | null;
  tour: TourResult | null;
  /** Which run the status/result belong to. */
  mode: DemoMode;
  error: string | null;
  /** ms since the current run started (for the streaming log). */
  startedAt: number;
  run: (mode?: DemoMode) => void;
  consoleOpen: boolean;
  consolePreset: number | null;
  openConsole: (preset?: number | null) => void;
  closeConsole: () => void;
  /** deny codes seen in the latest live run or console check (for the code grid). */
  hitCodes: number[];
  addHit: (code: number) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [recorded, setRecorded] = useState<RecordedRun | null>(null);
  const [status, setStatus] = useState<DemoStatus>('idle');
  const [result, setResult] = useState<DemoResult | null>(null);
  const [tour, setTour] = useState<TourResult | null>(null);
  const [mode, setMode] = useState<DemoMode>('quick');
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [consolePreset, setConsolePreset] = useState<number | null>(null);
  const [hitCodes, setHitCodes] = useState<number[]>([]);
  const busy = useRef(false);

  useEffect(() => {
    getHealth().then(setHealth).catch((e: Error) => setHealthError(e.message));
    getRecordedRun().then(setRecorded).catch(() => undefined);
  }, []);

  const run = useCallback((m: DemoMode = 'quick') => {
    if (busy.current) return;
    busy.current = true;
    setMode(m);
    setStatus('running');
    setError(null);
    setStartedAt(performance.now());
    const job = m === 'tour'
      ? runTour().then((r) => {
        setTour(r);
        setHitCodes(r.codesCovered.filter((c) => c > 0));
      })
      : runDemo().then((r) => {
        setResult(r);
        setHitCodes(r.steps.map((s) => s.onchain.code).filter((c) => c > 0));
      });
    job
      .then(() => setStatus('done'))
      .catch((e: Error) => { setError(e.message); setStatus('error'); })
      .finally(() => { busy.current = false; });
  }, []);

  const addHit = useCallback((code: number) => { if (code > 0) setHitCodes((h) => [...h.filter((c) => c !== code), code]); }, []);
  const openConsole = useCallback((preset: number | null = null) => { setConsolePreset(preset); setConsoleOpen(true); }, []);
  const closeConsole = useCallback(() => setConsoleOpen(false), []);

  const value = useMemo<Store>(() => ({
    health, healthError, recorded, status, result, tour, mode, error, startedAt, run,
    consoleOpen, consolePreset, openConsole, closeConsole, hitCodes, addHit,
  }), [health, healthError, recorded, status, result, tour, mode, error, startedAt, run, consoleOpen, consolePreset, openConsole, closeConsole, hitCodes, addHit]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}

export const short = (h?: string, a = 6, b = 4) => (h && h.length > a + b + 2 ? `${h.slice(0, a)}…${h.slice(-b)}` : h ?? '');
export const reasonOf = (v: string) => (v.match(/\(([^)]+)\)/)?.[1] ?? '');

/** Scroll to an element id through Lenis when present. */
export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const lenis = (window as unknown as { __lenis?: { scrollTo: (t: Element, o?: object) => void } }).__lenis;
  if (lenis) lenis.scrollTo(el, { offset: -88, duration: 1.2 });
  else window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 72, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
