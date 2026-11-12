# ARCHITECTURE.md — Leash Architecture

## 1. System Overview

```
                 1 check                          same decide
  ┌──────────┐ ─────────► ┌──────────────────┐ ──────────────┐
  │ AI agent │            │ leash CLI(native)│               ▼
  │ proposes │            │ check·explain·   │      ┌─────────────────────┐
  │   a tx   │            │ replay·fingerprint│     │    policy ingot     │
  └────┬─────┘            │ Args,Stdout,Fs   │      │ decide: no effects  │
       │ 2 execute        └──────────────────┘      │ record: mut Ledger  │
       ▼                                            │ same fingerprint    │
  ┌──────────────────────┐   same decide + record   └─────────────────────┘
  │ LeashModule (EVM)    │ ─────────────────────────────────▲
  │ Execute·Preview·Pause│
  │ Storage,Call,Log     │
  └────┬─────────────────┘
       │ 3 allowed calls only
       ▼
  ┌──────────────────────────┐
  │ Safe smart account       │
  │ execTransactionFromModule│
  └──────────────────────────┘
```

## 2. Component Boundaries

| Ingot / folder | Target | Responsibility | Allowed effects |
|---|---|---|---|
| `ingots/policy` | EVM + native | Types (`Tx`, `Policy`, `Verdict`, `DenyReason`, `AgentState`), calldata decoding, `decide`, `record`, `fingerprint`, `validate`, `explain` text, encoding | **None** for `decide`; `mut Ledger` only for `record` |
| `ingots/module` | EVM | `LeashModule`: agent entry, owner admin, kill switch, events, forwards to the Safe | Storage, Ctx, Call, Log |
| `ingots/cli` | Native | `leash check / explain / fingerprint / replay / validate / encode`; optional static library | Args, Stdout, Stderr, Fs, Exit |
| `ingots/testkit` | EVM + native | MockSafe, MockErc20, seeded tx generator, shared fixtures | Test-only |
| `demo/` | Node/TS | Sepolia and Anvil deploy, scripted agent (viem), dashboard page | Non-Fe runtime scripts |
| `docs/` | — | Architecture, threat model, ADRs, AI log, Fe findings, rules | Documentation |

## 3. Transaction Path

1. **Proposal**: The AI agent creates a candidate transaction `(to, value, data, operation)`.
2. **Off-chain Pre-flight**: The agent runs `leash check` (or calls the embedded native library). The CLI executes pure `policy::decide` natively and outputs `ALLOW` or `DENY <Reason>`. A compliant agent only broadcasts `ALLOW` transactions.
3. **On-chain Ingestion**: The agent calls `LeashModule.Execute`. The module reconstructs the exact same `Tx` and `AgentState`, then evaluates `policy::decide`.
4. **Enforcement**:
   - On `ALLOW`: `policy::record` updates the ledger state, and `LeashModule` calls `Safe.execTransactionFromModule(...)`.
   - On `DENY`: `LeashModule` reverts immediately with a typed custom error (or records denial in `TryExecute`). No state is modified.
5. **Fingerprint Verification**: Both CLI and Module expose `fingerprint`, which computes the identical keccak-256 digest of the canonical policy encoding. Operators can verify that off-chain agents and on-chain guards execute the exact same policy rules.

## 4. LeashModule Messages & Effects

Fe's static effect system enforces minimal privilege for each message handler:

| Message | Caller | Effects Declared | Description |
|---|---|---|---|
| `Execute { to, value, data, operation }` | Active agent | `mut self.locked, mut self.ledgers, call: mut Call, log: mut Log` | Evaluates `policy::decide`. Reverts with typed custom error if denied. If allowed, records spend and executes `Safe.execTransactionFromModule`. |
| `TryExecute { to, value, data, operation }` | Active agent | `mut self.locked, mut self.ledgers, call: mut Call, log: mut Log` | Same as `Execute`, but on denial does NOT revert: emits `Denied(agent, to, code)` and returns `(false, code)`. On success executes and returns `(true, 0)`. |
| `Preview { agent, to, value, data, operation }` | Anyone | Read-only (no storage mutation) | Returns `(code, remaining_eth_per_tx, remaining_eth_window)`. Zero state modifications. |
| `State { agent }` | Anyone | Read-only (no storage mutation) | Returns canonical `policy::encode_state(agent_state)` bytes for off-chain CLI prediction. |
| `Pause` | Safe or Guardian | `mut self.paused, log: mut Log` | Emergency kill switch. Guardian cannot touch funds or agent registrations. |
| `Unpause` | Safe only | `mut self.paused, log: mut Log` | Resumes module operations. Callable strictly by Safe account. |
| `SetAgent { agent, expiry, label }` | Safe only | `mut self.agents, log: mut Log` | Authorizes or updates an agent session key. Expiry must be > block timestamp. |
| `RevokeAgent { agent }` | Safe only | `mut self.agents, log: mut Log` | Deactivates an agent session key immediately. |
| `SetGuardian { guardian }` | Safe only | `mut self.guardian, log: mut Log` | Rotates the guardian emergency address. |
| `Fingerprint` | Anyone | Read-only | Returns 32-byte Keccak-256 policy digest matching the native CLI. |

## 5. Architectural Invariants

1. **Pure `decide`**: `policy::decide` has NO `uses` clause. Policy decisions cannot perform I/O, touch storage, or read environment state outside their explicit parameters.
2. **Default Deny**: Any action not explicitly allowed by policy rules is denied with an explicit `DenyReason`.
3. **No Direct Spending**: Safe funds can only be moved through `Safe.execTransactionFromModule`, which is reachable only after `policy::decide` returns `Allow` and state is recorded.
4. **Checks-Effects-Interactions (CEI)**: Internal ledger updates precede external calls to the Safe, backed by a reentrancy mutex.

## 6. CLI Subcommand Effects & Static Least Privilege

In `ingots/cli`, Fe's static effect system proves that subcommands possess strictly the minimal privileges required:

| Subcommand | Effects Declared | Architectural Guarantee |
|---|---|---|
| `leash check` | `(args: Args, out: mut Stdout, err: mut Stderr)` | **Zero filesystem access.** Cannot read or write files; pure evaluation from CLI parameters into policy memory. |
| `leash explain` | `(out: mut Stdout)` | **Stdout only.** Cannot touch args, stderr, or filesystem. |
| `leash fingerprint` | `(out: mut Stdout)` | **Stdout only.** Computes Keccak-256 digest in-memory and writes 64 hex characters to stdout. |
| `leash replay` | `(args: Args, out: mut Stdout, err: mut Stderr, fs: Fs)` | **Sole holder of `Fs`.** Only `replay` can access disk I/O to read historical CSV audit records. |
