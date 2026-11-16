import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eyebrow } from '../ui/Button';
import { REASONS } from '../lib/data';

interface RuleDetail {
  code: number;
  name: string;
  scope: 'State' | 'Call' | 'Calldata' | 'Budget' | 'DeFi';
  condition: string;
  mitigation: string;
}

const MATRIX_DATA: RuleDetail[] = [
  { code: 1, name: 'Paused', scope: 'State', condition: 'The guardian or the Safe called pause() on the module', mitigation: 'Only the Safe can lift it, with unpause()' },
  { code: 2, name: 'SessionExpired', scope: 'State', condition: 'Block timestamp >= agent.expiry', mitigation: 'The Safe renews the agent with setAgent() and a new expiry' },
  { code: 3, name: 'DelegateCallBlocked', scope: 'Call', condition: 'Transaction requested delegatecall operation', mitigation: 'Switch operation to standard call (0)' },
  { code: 4, name: 'TargetNotAllowed', scope: 'Call', condition: 'Target address not present in allowlist', mitigation: 'Targets are compiled into the policy; adding one is a new policy build with a new fingerprint' },
  { code: 5, name: 'SelectorNotAllowed', scope: 'Calldata', condition: 'Function selector is not permitted on this target', mitigation: 'Use only allowlisted methods' },
  { code: 6, name: 'MalformedCalldata', scope: 'Calldata', condition: 'Calldata byte length does not match ABI schema', mitigation: 'Properly encode parameters with 32-byte words' },
  { code: 7, name: 'PerTxCapExceeded', scope: 'Budget', condition: 'ETH value exceeds per-transaction cap (0.1 ETH)', mitigation: 'Send less per call; the Safe can change this agent’s cap with setAgentPolicy()' },
  { code: 8, name: 'WindowCapExceeded', scope: 'Budget', condition: 'Rolling 24h spending exceeds 0.5 ETH', mitigation: 'Wait for older hourly buckets to leave the 24 h window' },
  { code: 9, name: 'TokenCapExceeded', scope: 'Budget', condition: 'ERC-20 transfer exceeds per-token cap (100 tokens)', mitigation: 'Send at most 100 tokens per call; token caps are compiled into the policy' },
  { code: 10, name: 'UnlimitedApproval', scope: 'Calldata', condition: 'approve() for more than 100 tokens, including 2^256 − 1', mitigation: 'Approve only what the next trade needs' },
  { code: 15, name: 'CircuitTripped', scope: 'State', condition: 'Three denials since the agent was set or last reset', mitigation: 'Safe owner must call resetBreaker(agent)' },
];

export function RuleMatrix() {
  const [selected, setSelected] = useState<RuleDetail>(MATRIX_DATA[0]);

  return (
    <section className="sec rule-matrix-sec" id="matrix">
      <div className="container"><div className="inner" style={{ padding: '4em 2em' }}>
        <div style={{ marginBottom: '2em' }}>
          <Eyebrow>Security Architecture</Eyebrow>
          <h2 className="t-h2" style={{ marginTop: '0.4em' }}>What each refusal means, and how to recover</h2>
          <p className="t-p dim" style={{ maxWidth: '42em', marginTop: '0.6em' }}>
            The deny codes this demo policy can return, the condition behind each one and what unblocks it. decide() checks them in a fixed order and returns the first that fails.
          </p>
        </div>

        <div className="rm-grid">
          <div style={{ display: 'grid', gap: '0.5em' }}>
            {MATRIX_DATA.map((r) => (
              <button
                key={r.code}
                onClick={() => setSelected(r)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.8em 1.2em',
                  background: selected.code === r.code ? 'rgba(155, 77, 255, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                  border: `1px solid ${selected.code === r.code ? 'var(--violet)' : 'var(--line)'}`,
                  borderRadius: '8px',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div>
                  <span className="t-mono" style={{ fontSize: '0.75em', opacity: 0.6, marginRight: '0.8em' }}>CODE {String(r.code).padStart(2, '0')}</span>
                  <span style={{ fontWeight: 600 }}>{r.name}</span>
                </div>
                <span className="t-mono" style={{ fontSize: '0.7em', padding: '2px 6px', background: 'var(--bg-2)', borderRadius: '4px' }}>
                  {r.scope}
                </span>
              </button>
            ))}
          </div>

          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line-2)', borderRadius: '12px', padding: '2em' }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={selected.code}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: '1em', marginBottom: '1.5em' }}>
                  <h3 className="t-h3" style={{ margin: 0 }}>Code {selected.code}: {selected.name}</h3>
                  <span className="verdict deny">DENY</span>
                </div>

                <div style={{ display: 'grid', gap: '1.2em' }}>
                  <div>
                    <div className="t-mono" style={{ fontSize: '0.75em', color: 'var(--text-mute)', marginBottom: '0.4em' }}>TRIGGER CONDITION</div>
                    <p style={{ margin: 0, color: 'var(--text)' }}>{selected.condition}</p>
                  </div>

                  <div>
                    <div className="t-mono" style={{ fontSize: '0.75em', color: 'var(--text-mute)', marginBottom: '0.4em' }}>RESOLUTION & RECOVERY</div>
                    <p style={{ margin: 0, color: 'var(--text-2)' }}>{selected.mitigation}</p>
                  </div>

                  <div style={{ marginTop: '1em', padding: '1em', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px dashed var(--line)' }}>
                    <div className="t-mono" style={{ fontSize: '0.7em', color: 'var(--violet)' }}>PURE FE CONTRACT SIGNATURE</div>
                    <code className="t-code" style={{ fontSize: '0.8em', display: 'block', marginTop: '0.4em' }}>
                      pub fn decide(policy: Policy, state: State, tx: Tx) -&gt; Verdict
                    </code>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div></div>
    </section>
  );
}
