# Phase 2 — LeashModule contract and mock Safe

| | |
|---|---|
| **Dates** | Nov 17–18, 2026 (2 days). Registration closes Nov 17, 23:59 UTC; confirm it was done. |
| **Roadmap stage** | 3 — features B1, B2 (expiry), B7, B8 |
| **Depends on** | Phase 1 gate green |
| **Goal** | A deployable `LeashModule` that runs `policy::decide`, records spending, and forwards only allowed calls to a Safe, tested end to end against a mock Safe in `fe test`. |
| **Skills** | superpowers TDD loop; addy security-and-hardening + doubt-driven-development on **every handler that moves funds**; superpowers systematic-debugging for compiler surprises |

---

## Background the agent needs (Safe module mechanics)

- A Safe calls modules "enabled modules". An enabled module may call `execTransactionFromModule(address to, uint256 value, bytes data, uint8 operation) returns (bool success)` on the Safe, and the Safe executes the call **as itself**, with no owner signatures.
- The Safe owners enable a module with `enableModule(address)`. That call must come from the Safe itself (an owner-signed `execTransaction` to the Safe's own address).
- `execTransactionFromModule` returns `false` on failure instead of reverting. **The module must check the bool and revert with `SafeCallFailed()` if it is false**, or the ledger would record spending that never happened.
- `operation` 0 = Call, 1 = DelegateCall. A delegatecall from the Safe runs foreign code with the Safe's storage. That is why A2 blocks it.
- Cite the Safe interface (ModuleManager) in `DECLARATION.md` under "Reused interfaces".

---

## Contract design

### Storage

| Field | Type | Notes |
|---|---|---|
| `safe` | `Address` | Set once in the constructor; never changes |
| `guardian` | `Address` | Set in the constructor; changeable only by the Safe |
| `paused` | `bool` | Module-wide kill switch |
| `agents` | `StorageMap<Address, AgentConfig>` | `AgentConfig { active: bool, expiry: Timestamp, label: u256 /* bytes32 */ }` (Phase 4 adds a per-agent policy) |
| `ledgers` | `StorageMap<Address, AgentLedger>` | Per-agent window buckets (the storage form of the ledger part of `AgentState`) |
| `locked` | `bool` | Reentrancy lock (belt and braces on top of CEI) |
| policy | compiled-in `policy::DEFAULT_POLICY` constant in this phase | Phase 4 moves to a per-agent stored policy (ADR-007) |

### Messages (handlers)

| Message | Caller | Effects the handler declares | What it does |
|---|---|---|---|
| `Execute { to, value, data, operation }` | Agent key | read policy, `mut ledger`, Call, Log | Build `Tx` (with `now = block.timestamp`) and `AgentState` (from storage + `paused` + agent expiry) → `decide` → on Deny **revert with the matching `#[error]`** → on Allow `record`, emit `Allowed`, then call `safe.execTransactionFromModule`; revert `SafeCallFailed()` if it returns false |
| `TryExecute { to, value, data, operation }` (ADR-004) | Agent key | same as Execute | Same checks, but on Deny it **does not revert**: emits `Denied(agent, target, code)`, returns `(false, code)`. On Allow, same as Execute and returns `(true, 0)`. Phase 4's circuit breaker counts denials here. |
| `Preview { agent, to, value, data, operation }` | Anyone | read policy, read ledger (**no `mut`**) | Returns `(code, remaining_eth_per_tx, remaining_eth_window)`; changes nothing (B8) |
| `State { agent }` | Anyone | read ledger | Returns `policy::encode_state(agent_state)` bytes (for `leash check --state`, ADR-006) |
| `Pause` | Safe **or** guardian | `mut paused` only | Sets `paused = true`; emits `Paused(by)` |
| `Unpause` | Safe only | `mut paused` only | Sets `paused = false`; emits `Unpaused()` |
| `SetAgent { agent, expiry, label }` | Safe only | `mut agents` | Add or rotate a session key; `expiry` must be > now; emits `AgentSet(agent, expiry)` |
| `RevokeAgent { agent }` | Safe only | `mut agents` | `active = false`; emits `AgentRevoked(agent)` |
| `SetGuardian { guardian }` | Safe only | `mut guardian` | Emits `GuardianSet(guardian)` |
| `Fingerprint` | Anyone | read policy | Returns `policy::fingerprint(policy)` |

Effect lists are part of the Fe-specific score: a reviewer must be able to see from the signatures that `Pause` can only write `paused`, and that `Preview` and `State` cannot write anything. Keep each handler's `uses` list as small as possible, and put a table like the one above in `docs/ARCHITECTURE.md`.

### Errors (B7) — `ingots/module/src/errors.fe`

- One `#[error]` struct per `DenyReason` (context §6, codes 1–10 so far), with no fields, so the selector is `bytes4(keccak256("Name()"))`.
- Access errors: `NotAgent()`, `NotSafe()`, `NotGuardian()`, `SafeCallFailed()`, `Reentrant()`, `InvalidExpiry()`.
- `revert_for(reason: DenyReason) -> !` with an **exhaustive match**, so a new reason cannot be added without an error.

### Events — `ingots/module/src/events.fe`

`Allowed(agent indexed, target indexed, value, selector)`, `Denied(agent indexed, target indexed, code)` (TryExecute only), `Paused(by indexed)`, `Unpaused()`, `AgentSet(agent indexed, expiry)`, `AgentRevoked(agent indexed)`, `GuardianSet(guardian indexed)`.

### Execute order (checks → effects → interactions)

1. `locked` is false → else revert `Reentrant()`. Set `locked = true`.
2. Caller is an `active` agent → else revert `NotAgent()`. *(Expiry and pause are **policy** rules: they go through `decide` as `SessionExpired` / `Paused`, so the CLI predicts them too.)*
3. Build `Tx` and `AgentState`; `verdict = policy::decide(tx, policy, state)`.
4. Deny → revert with the typed error (Execute) or emit + return (TryExecute; reset `locked` first).
5. Allow → `policy::record(...)` writes the ledger **before** the external call.
6. Emit `Allowed`.
7. Call `safe.execTransactionFromModule(to, value, data, op)`; false → revert `SafeCallFailed()` (this also rolls back the ledger write).
8. `locked = false`.

---

## Tasks

### T1 — `testkit::MockSafe` (2 h)
- [ ] Contract with `enableModule(addr)` (test helper; no auth), `isModuleEnabled`, and `execTransactionFromModule(to, value, data, op) -> bool` that: reverts if the caller is not an enabled module, records the last call (`to, value, data hash, op`) and a call counter, then actually performs the call (so reentrancy tests work), and returns `false` when a test switch `set_fail(true)` is on.
- [ ] Tests for the mock itself (keep them short).

### T2 — `testkit::MockErc20` (1 h)
- [ ] Minimal ERC-20: `mint`, `transfer`, `approve`, `transferFrom`, `balanceOf`, `allowance`. Used for calldata tests now and as the demo token in Phase 6 (it must be deployable).

### T3 — Storage, constructor, admin (2 h)
- [ ] Constructor `(safe, guardian)`. Reject the zero address.
- [ ] `SetAgent`, `RevokeAgent`, `SetGuardian`, `Unpause` callable **only by the Safe** (`msg.sender == safe`) → else `NotSafe()`.
- [ ] `Pause` callable by the Safe or the guardian → else `NotGuardian()`.
- [ ] The guardian handler declares only `mut paused` (show this in a code comment and in ARCHITECTURE.md).

### T4 — `Execute` and `TryExecute` (3 h)
- [ ] Implement the order above. **No `if` deciding allow/deny may exist in the module, except "is the caller an active agent" (an access check, not a policy rule).** Everything else comes from `decide`.
- [ ] Write `docs/adr/004-deny-semantics.md` (the context file explains why both entry points exist).

### T5 — `Preview`, `State`, `Fingerprint` (1.5 h)
- [ ] `Preview` returns the code and remaining budgets. Test: the ledger is unchanged after Preview (compare `State` before and after).
- [ ] `State` returns `encode_state`. Test: `decode_state(State(agent))` equals the state the module used.
- [ ] `Fingerprint` returns `policy::fingerprint(DEFAULT_POLICY)`. Test: it equals the pinned vector from Phase 1.

### T6 — Events and errors (1.5 h)
- [ ] For each deny reason that can be reached through the module, write a test with `#[test(should_revert, selector = …)]` asserting the exact selector.
- [ ] Event tests if `fe test` can read logs. If it cannot, note it in FE_FINDINGS and cover events in the Phase 6 Anvil demo instead.

### T7 — Reentrancy (1.5 h)
- [ ] `testkit::Reenterer` contract: when called by the Safe, it calls `LeashModule.Execute` again.
- [ ] Test A: the re-entrant call is rejected (`NotAgent()` because the reenterer is not an agent, or `Reentrant()`), so the outer call reverts and the **ledger is unchanged** after the revert.
- [ ] Test B: register the reenterer as an agent too, and confirm `Reentrant()` fires and the ledger is still correct.

### T8 — Size and warnings (0.5 h)
- [ ] `fe build --emit sizes`: record the runtime size in `docs/GAS.md`. It must be < 24,576 bytes with no warnings. If it is close (> 20 KB), note it now. Phase 4 adds code.

### T9 — Threat model first draft (1 h)
- [ ] Run **addy security-and-hardening** and **doubt-driven-development** on every fund-moving handler. Write `docs/THREAT_MODEL.md`: assets (Safe funds, allowances), actors (owner, guardian, agent, compromised agent, malicious target, anyone), trust boundaries, every entry point with who can call it and what it can change, the known attacks (Phase 5 list), the window approximation, the ADR-004 note that reverted denials do not count toward the breaker, and residual risks.

---

## Integration tests (`test/module/`, EVM only)

| # | Scenario | Expected |
|---|---|---|
| 1 | Allowed ETH transfer to the treasury | MockSafe records exactly one call with the same `to/value/data/op`; ledger window increased by `value` |
| 2 | Allowed ERC-20 transfer at cap | Reaches MockSafe; token balance moves (MockErc20) |
| 3–12 | One test per `DenyReason` reachable now (`Paused`, `SessionExpired`, `DelegateCallBlocked`, `TargetNotAllowed`, `SelectorNotAllowed`, `MalformedCalldata`, `PerTxCapExceeded`, `WindowCapExceeded`, `TokenCapExceeded`, `UnlimitedApproval`) | Reverts with the exact selector; MockSafe call counter unchanged; ledger unchanged |
| 13 | Same deny cases via `TryExecute` | Returns `(false, code)`; nothing moves |
| 14 | Paused module | Every Execute rejected with `Paused()`; Preview reports code 1 |
| 15 | Expired agent (`now > expiry`) | `SessionExpired()` |
| 16 | Revoked agent | `NotAgent()` |
| 17 | Non-Safe calls `SetAgent`/`Unpause`/`SetGuardian` | `NotSafe()` |
| 18 | Guardian calls `Pause` → ok; guardian calls `Unpause` / `SetAgent` | Pause works; the others revert `NotSafe()` |
| 19 | MockSafe returns false | `SafeCallFailed()`; ledger unchanged |
| 20 | Reentrancy A and B | As in T7 |
| 21 | Preview has no side effects | `State` identical before and after |
| 22 | Fingerprint | Equals the pinned vector |

---

## Exit gate

- [ ] Integration tests pass: an allowed call reaches MockSafe; each `DenyReason` reverts with the expected selector and moves nothing; a paused module rejects everything; an expired agent is rejected; a non-Safe admin call is rejected.
- [ ] Reentrancy tests pass.
- [ ] Contract runtime size < 24,576 bytes with **no build warnings**.
- [ ] addy security-and-hardening checklist completed and saved to `docs/THREAT_MODEL.md` (first draft).
- [ ] ADR-004 and ADR-006 written. ARCHITECTURE.md has the message/effects table.
- [ ] Phase 1 suites still green on both backends (full regression).
- [ ] Standard + review gate output pasted; handoff; commit `chore: phase 2 complete`.

## Fallbacks

- **`StorageMap` of structs is a problem:** store parallel maps (`agent_active`, `agent_expiry`, `bucket_index[agent][i]`, `bucket_amount[agent][i]`). Document it in FE_FINDINGS.
- **Typed errors per reason do not work:** use a single `LeashDenied(uint8 code)` error and say so in the README; keep the code table.
- **The external call shape fails on 26.6:** use the lowest-level call std offers with manually encoded calldata `abi.encodeWithSelector(0x468721a7, to, value, data, op)` (`execTransactionFromModule` selector; verify it with `cast sig`).
- **Running late on Nov 18:** `TryExecute` and `State` may move to Phase 3's first morning; everything else is required.
