# Formal Effect Boundary & Capability Matrix

Fe 26.6.0 introduces static capability security via explicit `uses (...)` clauses. In Leash, effect tracking is not merely an annotation—it is the foundational architectural mechanism that enforces privilege separation, non-bypassable guardrails, and project invariants at compile time.

---

## 1. Architectural Principles

1. **Pure Core**: The entire policy evaluation engine (`ingots/policy`) is strictly pure. `policy::decide` has no `uses` clause. It cannot read contract storage, cannot emit EVM logs, cannot initiate external calls, and cannot perform OS I/O.
2. **Principle of Least Privilege**: In `LeashModule`, each message receiver requests only the specific contract fields and EVM capabilities required for its execution.
3. **Privilege Separation**: A role (such as `guardian`) cannot mutate fields (such as `agents`, `ledgers`, or `paused`) outside its declared capability set. Attempting to access an unlisted field is rejected by the Fe compiler (`error[8-0116]: contract field is not in this handler's uses`).
4. **Backend-Specific Effect Binding**:
   - On native target (`ingots/cli`): Capabilities are bound to standard OS handles (`args: Args, out: mut Stdout, err: mut Stderr, fs: Fs`).
   - On EVM target (`ingots/module`): Capabilities are bound to EVM host primitives (`ctx: Ctx, call: mut Call, log: mut Log`).

---

## 2. Complete Codebase Capability Matrix

| Layer / Ingot | Function / Message Handler | Declared Effects (`uses`) | Enforced Security Boundary | Compile-Time Proof |
| :--- | :--- | :--- | :--- | :--- |
| `policy` | `decide(tx, policy, state)` | **None (Pure)** | Purity invariant: Deterministic execution without storage or I/O access. | `test/compile_fail/decide_cannot_read_storage.fe` |
| `policy` | `decide_spend(tx, policy, state)` | **None (Pure)** | Protocol guard evaluation and token outflow calculation without side-effects. | Verified by CI AST rule check |
| `policy` | `record(state, tx)` | **None (Pure)** | Ledger mutation modeled as pure functional state transition `(state, tx) -> state`. | Verified by CI AST rule check |
| `module` | `Pause` | `ctx, safe, guardian, mut paused, mut log` | Guardian boundary: Guardian can pause the module, but **cannot** read or write agent configs, spending limits, or ledgers. | `test/compile_fail/guardian_cannot_write_limits.fe` |
| `module` | `Unpause` | `ctx, safe, mut paused, mut log` | Safe boundary: Only the Safe can unpause. Guardian is excluded from capability scope. | `test_unpause_by_non_safe_reverts` |
| `module` | `SetAgent` | `ctx, safe, mut agents, mut log` | Safe-only administration: Only Safe can register agents, assign session keys, and set labels. | `test_set_agent_by_non_safe_reverts` |
| `module` | `RevokeAgent` | `ctx, safe, mut agents, mut log` | Safe-only administration: Immediate session key revocation. | `test_unauthorized_revoke_agent_rejected` |
| `module` | `SetGuardian` | `ctx, safe, mut guardian, mut log` | Safe-only administration: Guardian address rotation. | `test_unauthorized_set_guardian_rejected` |
| `module` | `ResetBreaker` | `ctx, safe, mut agents, mut log` | Circuit breaker recovery: Safe-only reset. Guardian cannot clear tripped breakers. | `test_attack_08_guardian_cannot_reset_breaker` |
| `module` | `Preview` | `ctx, paused, agents, ledgers` | Read-only simulation: Read-only storage view; cannot initiate calls or emit logs. | Checked by compiler |
| `module` | `Execute` | `ctx, safe, mut call, mut log, paused, mut locked, agents, mut ledgers` | Checks-effects-interactions: Reentrancy lock (`mut locked`), state mutation (`mut ledgers`), Safe dispatch (`mut call`), event emission (`mut log`). | `test_reentrancy_rejected_reentrant_flag` |
| `module` | `TryExecute` | `ctx, safe, mut call, mut log, paused, mut locked, mut agents, mut ledgers` | Non-reverting execution: Can update breaker denial counters (`mut agents`) and record state (`mut ledgers`). | `test_circuit_breaker_trips_and_resets` |
| `cli` | `main()` | `args: Args, out: mut Stdout, err: mut Stderr, fs: Fs` | Sandboxed CLI: Explicit OS arguments, standard streams, and filesystem sandbox. | Native link verification |

---

## 3. Negative Compilation Proofs

The repository includes automated compile-fail tests in `test/compile_fail/` executed in CI to verify that Fe's compiler actively enforces these boundaries:

1. **`test/compile_fail/guardian_cannot_write_limits.fe`**:
   - A contract handler declaring `uses (mut paused)` attempts to write to `max_limit`.
   - **Compiler diagnostic**: `error[8-0116]: contract field 'max_limit' is not in this handler's 'uses'`.
2. **`test/compile_fail/decide_cannot_read_storage.fe`**:
   - A function attempts to access contract storage from outside a contract message receiver.
   - **Compiler diagnostic**: `error[8-0051]: unresolved effect`.
3. **`test/compile_fail/policy_struct_per_tx_above_window.fe`**:
   - Constructs a `Policy` struct with `max_per_tx > max_per_window` and verifies it in a `const` context.
   - **Compiler diagnostic**: `error[3-0073]: division by zero in const context`.
