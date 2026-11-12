# Stage 10 — Owner co-signed override (B5) and escalation queue (B6)

| | |
|---|---|
| **When** | After the submission, or as a Phase 4 Could item (B6 only) |
| **Depends on** | Stage 3 (Phase 2) |
| **Exit check** | Replay and veto tests |
| **Skills** | superpowers TDD, addy security-and-hardening + doubt-driven-development (both features move funds above the normal caps) |

---

## B6 — Escalation queue (`EscalationRequired`, code 20)

**Behaviour:** a tx above `escalation_threshold` (a `Wei` amount, and optionally per token) is not executed directly. It is queued, and it executes after a delay unless the Safe vetoes it.

- [ ] Policy: `escalation_threshold: Wei` (0 = off), `escalation_delay: Duration`. `decide` returns `EscalationRequired` for a tx that passes every other rule but has `value > escalation_threshold` (last in the rule order). The caps still apply: the queue is for txs that are allowed but large, not for bypassing caps.
- [ ] Module storage: `queue: StorageMap<u256 /* id */, QueuedTx>`, `QueuedTx { agent, to, value, data_hash, op, ready_at, state }`, `enum QueueState { Queued, Vetoed, Executed }`.
- [ ] Messages:
  - `Queue { to, value, data, operation }` — agent only; runs `decide`. If the verdict is exactly `EscalationRequired`, store it with `ready_at = now + delay` and emit `Queued(id, agent, ready_at)`. Any other deny → revert with that error.
  - `Veto { id }` — Safe only; `Queued → Vetoed`; emits `Vetoed(id)`.
  - `ExecuteQueued { id, data }` — **anyone**, after `ready_at`; checks `keccak(data) == data_hash`, re-runs `decide` with an `escalated = true` flag that skips only the escalation rule (the window/caps are checked again **at execution time**), then `record` + the Safe call; `Queued → Executed`.
- [ ] Transitions are a pure function in policy: `next_queue_state(state, action, now, ready_at) -> Result<QueueState, Error>`, so they are tested on both backends.
- [ ] Tests: veto; early execute reverts; double execute reverts; execute after veto reverts; caps re-checked at execution (fill the window after queueing → the queued tx is denied); wrong data → revert; CLI `check` prints `DENY EscalationRequired` with the time it would be ready.

## B5 — Owner co-signed override

**Behaviour:** one tx above the cap passes if it carries an EIP-712 signature from a Safe owner. A nonce prevents replay.

- [ ] EIP-712 domain: `name = "Leash"`, `version = "1"`, `chainId`, `verifyingContract = module`. Type: `Override(address agent,address to,uint256 value,bytes32 dataHash,uint8 operation,uint256 nonce,uint256 deadline)`.
- [ ] Use `std::evm::crypto::eip712_digest` and `ecrecover` (the canonical std helpers; read their exact signatures in std). Reject high-`s` signatures and `v ∉ {27, 28}`.
- [ ] Message `ExecuteWithOverride { to, value, data, operation, deadline, signature }` — agent only. The recovered signer must be a Safe owner (`safe.isOwner(signer)` via a read-only call), `now ≤ deadline`, and `nonce == overrideNonce[agent]` (then incremented).
- [ ] What the override skips: **only** `PerTxCapExceeded`, `WindowCapExceeded` and `TokenCapExceeded`. It never skips `DelegateCallBlocked`, `TargetNotAllowed`, `Paused`, `SessionExpired` or `CircuitTripped`. Implement this as `decide_with_override(tx, policy, state) -> Verdict` in policy (pure), so the CLI can predict it with `leash check --override`.
- [ ] The override spend is still recorded in the window.
- [ ] Tests: valid override; replay of the same signature → revert; wrong signer (not an owner) → revert; expired deadline → revert; a signature for different `to`/`value`/`data` → revert; an override does not bypass the target allowlist or delegatecall.
- [ ] THREAT_MODEL: one compromised owner key + a compromised agent can move funds above the cap. Document why that is acceptable (a 1-of-N owner can already do it directly) and recommend threshold-aware overrides as future work.

## Exit check

- [ ] Replay, veto, early/double execute tests pass. Policy-level transition tests pass on both backends.
- [ ] Parity generator covers queue + override paths (or the README says why not).
- [ ] Module size still < 24,576 bytes. If not, move the queue into a separate `LeashQueue` module that the Safe also enables, and document it.
- [ ] ADR-011 (escalation), ADR-012 (override) written; README updated.
