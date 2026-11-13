import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { runCheck } from '../lib/api';
import { PRESETS, REASONS, TREASURY, TOKEN } from '../lib/data';
import { short, useStore } from '../lib/store';
import type { CheckResult } from '../lib/types';
import { Button, LeashMark } from '../ui/Button';

const EASE = [0.25, 0.46, 0.45, 0.94] as const;

function weiToEth(w?: string) {
  if (!w) return '–';
  const n = BigInt(w);
  const s = (n / 10n ** 18n).toString();
  const f = (n % 10n ** 18n).toString().padStart(18, '0').replace(/0+$/, '');
  return f ? `${s}.${f}` : s;
}

function describe(to: string, valueEth: string, data: string, op: string) {
  const name = to.toLowerCase() === TREASURY ? 'the treasury' : to.toLowerCase() === TOKEN ? 'the token contract' : short(to);
  const sel = data.slice(0, 10).toLowerCase();
  const what = sel === '0xa9059cbb' ? 'transfer tokens via' : sel === '0x095ea7b3' ? 'approve a spender on' : sel === '0x23b872dd' ? 'transferFrom on' : data !== '0x' && data ? `call ${sel} on` : valueEth !== '0' ? `send ${valueEth} ETH to` : 'call';
  return `${op === 'delegatecall' ? 'Delegatecall: ' : ''}${what} ${name}`.replace(/^\w/, (c) => c.toUpperCase());
}

interface Exchange { id: number; ask: string; result?: CheckResult; error?: string }

/** Transaction console: presets + fields; replies arrive as two bubbles (prediction, decision). */
export function Console({ autoPreset = null, compact = false, onReady }: { autoPreset?: number | null; compact?: boolean; onReady?: (focus: () => void) => void }) {
  const { addHit } = useStore();
  const [to, setTo] = useState(TREASURY);
  const [value, setValue] = useState('0.05');
  const [data, setData] = useState('0x');
  const [op, setOp] = useState<'call' | 'delegatecall'>('call');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<Exchange[]>([]);
  const idRef = useRef(0);
  const firstRef = useRef<HTMLButtonElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const submit = async (body = { to: to.trim(), valueEth: value.trim() || '0', data: data.trim() || '0x', operation: op }) => {
    if (busy) return;
    const id = ++idRef.current;
    setBusy(true);
    setLog((l) => [...l.slice(-3), { id, ask: describe(body.to, body.valueEth, body.data, body.operation) }]);
    try {
      const r = await runCheck(body);
      setLog((l) => l.map((x) => (x.id === id ? { ...x, result: r } : x)));
      addHit(r.step.onchain.code);
    } catch (e) {
      setLog((l) => l.map((x) => (x.id === id ? { ...x, error: (e as Error).message } : x)));
    } finally {
      setBusy(false);
    }
  };

  const usePreset = (i: number) => {
    const p = PRESETS[i];
    setTo(p.to); setValue(p.valueEth); setData(p.data); setOp(p.operation ?? 'call');
    submit({ to: p.to, valueEth: p.valueEth, data: p.data, operation: p.operation ?? 'call' });
  };

  useEffect(() => { onReady?.(() => firstRef.current?.focus()); }, [onReady]);
  useEffect(() => { if (autoPreset != null && PRESETS[autoPreset]) usePreset(autoPreset); }, [autoPreset]); // eslint-disable-line react-hooks/exhaustive-deps
  // Keep the newest reply in view inside the chat box only (never scroll the page).
  useEffect(() => {
    const box = endRef.current?.parentElement;
    if (box && log.length) box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
  }, [log]);

  return (
    <div className={`console ${compact ? 'compact' : ''}`}>
      <div className="presets" role="group" aria-label="Example transactions">
        {PRESETS.map((p, i) => (
          <button key={p.label} ref={i === 0 ? firstRef : undefined} type="button" className="preset" onClick={() => usePreset(i)} disabled={busy}>{p.label}</button>
        ))}
      </div>

      <div className="chat" aria-live="polite">
        {!log.length && <p className="t-small chat-empty">Pick an example or write your own call. Leash predicts it with the Fe binary, then executes it against the Safe module.</p>}
        <AnimatePresence initial={false}>
          {log.map((x) => {
            const s = x.result?.step;
            const pa = s?.predicted.verdict === 'ALLOW', oa = s?.onchain.verdict === 'ALLOW';
            return (
              <motion.div key={x.id} className="ex" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }}>
                <div className="bubble me">{x.ask}</div>
                {!s && !x.error && <div className="thinking"><span className="spin" />Checking…</div>}
                {x.error && <div className="bubble err" role="alert">{x.error}</div>}
                {s && x.result && (
                  <>
                    <motion.div className="bubble" initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.4, ease: EASE }}>
                      <span className="t-mono">Fe CLI predicted</span>
                      <span className={`verdict ${pa ? 'allow' : 'deny'}`}>{s.predicted.verdict}{!pa && <em>{s.predicted.reason}</em>}</span>
                      <span className="t-small">{s.predicted.message || REASONS[s.predicted.code]?.msg}</span>
                    </motion.div>
                    <motion.div className="bubble" initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.4, delay: 0.25, ease: EASE }}>
                      <span className="t-mono">LeashModule decided</span>
                      <span className={`verdict ${oa ? 'allow' : 'deny'}`}>{s.onchain.verdict}{!oa && <em>{s.onchain.reason}</em>}</span>
                      <span className="t-code bubble-meta">code {s.onchain.code} · tx {short(s.onchain.txHash)} · {Number(s.onchain.gasUsed).toLocaleString('en-US')} gas</span>
                    </motion.div>
                    <motion.div className={`match ${s.matched ? 'ok' : 'bad'}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                      {s.matched ? '✓ The off-chain prediction matched the on-chain decision.' : '✗ The prediction did not match the on-chain decision.'}
                      {s.remaining?.eth_per_tx_wei && <span className="t-code budget">Budget before: {weiToEth(s.remaining.eth_per_tx_wei)} ETH per tx · {weiToEth(s.remaining.eth_window_wei)} ETH in the 24 h window</span>}
                      <span className="t-code budget">{x.result.predictionSource === 'fe-native' ? `Predicted by the Fe-built binary (${x.result.cliVersion})` : 'Predicted by the TypeScript mirror'} · {(x.result.elapsedMs / 1000).toFixed(2)} s</span>
                    </motion.div>
                  </>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={endRef} />
      </div>

      <form className="tx-form" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
        <label className="fld wide"><span className="t-mono">To</span>
          <input value={to} onChange={(e) => setTo(e.target.value)} spellCheck={false} autoComplete="off" /></label>
        <label className="fld"><span className="t-mono">Value (ETH)</span>
          <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" /></label>
        <label className="fld"><span className="t-mono">Operation</span>
          <select value={op} onChange={(e) => setOp(e.target.value as 'call' | 'delegatecall')}><option value="call">call</option><option value="delegatecall">delegatecall</option></select></label>
        <label className="fld wide"><span className="t-mono">Calldata</span>
          <textarea value={data} onChange={(e) => setData(e.target.value)} spellCheck={false} rows={2} /></label>
        <div className="fld wide form-actions">
          <Button type="submit" label={busy ? 'Checking…' : 'Check and execute'} busy={busy} disabled={busy} />
        </div>
      </form>
    </div>
  );
}

/**
 * Modal shell with the measured build order: close 0 ms, action +90 (slides up from a clip),
 * header +200, icon +230, title +370, subtitle +480; page behind blurred ~5 px.
 */
export function ConsoleModal() {
  const { consoleOpen, closeConsole, consolePreset } = useStore();
  const panel = useRef<HTMLDivElement>(null);
  const focusFirst = useRef<() => void>(() => undefined);
  const lastFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const lenis = (window as unknown as { __lenis?: { stop: () => void; start: () => void } }).__lenis;
    if (consoleOpen) {
      lastFocus.current = document.activeElement as HTMLElement;
      lenis?.stop();
      document.documentElement.classList.add('modal-open');
      const t = window.setTimeout(() => focusFirst.current(), 420);
      return () => window.clearTimeout(t);
    }
    lenis?.start();
    document.documentElement.classList.remove('modal-open');
    lastFocus.current?.focus?.();
  }, [consoleOpen]);

  useEffect(() => {
    if (!consoleOpen) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); closeConsole(); return; }
      if (e.key !== 'Tab' || !panel.current) return;
      const f = [...panel.current.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, textarea, a[href]')];
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [consoleOpen, closeConsole]);

  const step = (d: number, extra: object = {}) => ({
    initial: { opacity: 0, y: -9, ...extra }, animate: { opacity: 1, y: 0 }, transition: { delay: d, duration: 0.35, ease: EASE },
  });

  return (
    <AnimatePresence>
      {consoleOpen && (
        <motion.div className="modal" role="dialog" aria-modal="true" aria-labelledby="console-title"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.25 } }} transition={{ duration: 0.2 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) closeConsole(); }} data-lenis-prevent="">
          <div className="modal-panel" ref={panel}>
            <motion.button className="modal-x" onClick={closeConsole} aria-label="Close" {...step(0)}>×</motion.button>
            <motion.div className="modal-bar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.35 }}>
              <LeashMark size="1.1em" /><span>Transaction console</span><span className="modal-bar-r t-mono">fresh EVM per call</span>
            </motion.div>
            <div className="modal-head">
              <motion.div className="modal-ico" {...step(0.23)}><LeashMark size="1.6em" /></motion.div>
              <motion.h2 id="console-title" className="t-h3" initial={{ opacity: 0, y: -9, color: '#635f65' }} animate={{ opacity: 1, y: 0, color: '#efedf0' }} transition={{ delay: 0.37, duration: 0.45, ease: EASE }}>Try a transaction</motion.h2>
              <motion.p className="t-small" {...step(0.48)}>The agent’s CLI predicts, then the Safe module decides. Same Fe code, two runtimes.</motion.p>
            </div>
            <div className="modal-clip">
              <motion.div initial={{ y: 25, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.09, duration: 0.4, ease: EASE }}>
                <Console autoPreset={consolePreset} compact onReady={(f) => { focusFirst.current = f; }} />
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Inline section version (works without opening the modal). */
export function TrySection() {
  return (
    <section className="sec" id="try" aria-labelledby="try-h">
      <div className="container"><div className="inner pad try">
        <div className="try-copy">
          <div className="t-mono eyebrow">Try your own</div>
          <h2 className="t-h2" id="try-h">Send the agent anything.</h2>
          <p className="t-small">Any target, value, calldata or operation. Each check runs in its own freshly deployed environment, so you can’t break anything.</p>
        </div>
        <Console />
      </div></div>
    </section>
  );
}
