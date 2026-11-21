# Formal Effect Boundary & Capability Matrix

Fe 26.6.0 introduces static capability security via explicit `uses (...)` clauses. In Leash, effect tracking is not merely an annotation—it is the foundational architectural mechanism that enforces privilege separation, non-bypassable guardrails, and project invariants at compile time.

---

## 1. Architectural Principles

1. **Pure Core**: The entire policy evaluation engine (`ingots/policy`) is strictly pure. `policy::decide` has no `uses` clause. It cannot read contract storage, cannot emit EVM logs, cannot initiate external calls, and cannot perform OS I/O.
2. **Principle of Least Privilege**: In `LeashModule`, each message receiver requests only the specific contract fields and EVM capabilities required for its execution.
3. **Privilege Separation**: A role (such as `guardian`) cannot mutate fields (such as `agents`, `eth_windows`, `token_periods`, or `paused`) outside its declared capability set. Attempting to access an unlisted field is rejected by the Fe compiler (`error[8-0116]: contract field is not in this handler's uses`).
4. **Backend-Specific Effect Binding**:
   - On native target (`ingots/cli`): Capabilities are bound to standard OS handles (`args: Args, out: mut Stdout, err: mut Stderr, fs: Fs`).
   - On EVM target (`ingots/module`): Capabilities are bound to EVM host primitives (`ctx: Ctx, call: mut Call, log: mut Log`).

---

## 2. Complete Codebase Capability Matrix

| Layer / Ingot | Function / Message Handler | Declared Effects (`uses`) | Enforced Security Boundary | Compile-Time Proof |
| :--- | :--- | :--- | :--- | :--- |
| `policy` | `decide(tx, policy, state)` | **None (Pure)** | Purity invariant: Deterministic execution without storage or I/O access. | `decide_cannot_write_the_ledger`, `decide_cannot_add_wei_to_a_duration` ([`scripts/compile-fail.sh`](../scripts/compile-fail.sh)); the CI `rules` job |
| `policy` | `decide_spend(tx, policy, state)` | **None (Pure)** | Protocol guard evaluation and token outflow calculation without side-effects. | Verified by CI AST rule check |
| `policy` | `record(tx, policy, mut state)` | **None** | Writes only the `mut AgentState` it is given: the one policy function that books a spend. | `decide` gets the state by `ref`, so it cannot call `record` (`decide_cannot_write_the_ledger`) |
| `module` | `Pause` | `ctx, safe, guardian, mut paused, mut log` | Guardian boundary: Guardian can pause the module, but **cannot** read or write agent configs, spending limits, or ledgers. | `guardian_cannot_write_agents` ([`scripts/compile-fail.sh`](../scripts/compile-fail.sh)) |
| `module` | `Unpause` | `ctx, safe, mut paused, mut log` | Safe boundary: Only the Safe can unpause. Guardian is excluded from capability scope. | `test_unpause_by_non_safe_reverts` |
| `module` | `SetAgent` | `ctx, safe, mut agents, mut log` | Safe-only administration: Only Safe can register agents, assign session keys, and set labels. | `test_set_agent_by_non_safe_reverts` |
| `module` | `RevokeAgent` | `ctx, safe, mut agents, mut log` | Safe-only administration: Immediate session key revocation. | `test_unauthorized_revoke_agent_rejected` |
| `module` | `SetGuardian` | `ctx, safe, mut guardian, mut log` | Safe-only administration: Guardian address rotation. | `test_unauthorized_set_guardian_rejected` |
| `module` | `ResetBreaker` | `ctx, safe, mut agents, mut log` | Circuit breaker recovery: Safe-only reset. Guardian cannot clear tripped breakers. | `test_attack_08_guardian_cannot_reset_breaker` |
| `module` | `Preview` | `ctx, paused, agents, eth_windows, token_periods` | Read-only simulation: Read-only storage view; cannot initiate calls or emit logs. | Checked by compiler |
| `module` | `Execute` | `ctx, safe, mut call, mut log, paused, mut locked, agents, mut eth_windows, mut token_periods` | Checks-effects-interactions: Reentrancy lock (`mut locked`), state mutation (`mut eth_windows, mut token_periods`), Safe dispatch (`mut call`), event emission (`mut log`). Reads `agents` but cannot write it. | `execute_cannot_write_agents` (compile-fail); `test_reentry_by_an_agent_hits_the_lock` |
| `module` | `TryExecute` | `ctx, safe, mut call, mut log, paused, mut locked, mut agents, mut eth_windows, mut token_periods` | Non-reverting execution: Can update breaker denial counters (`mut agents`) and record state (`mut eth_windows, mut token_periods`). | `test_circuit_breaker_trips_and_resets` |
| `cli` | `main()` | `args: Args, out: mut Stdout, err: mut Stderr, fs: Fs` | The program's root: it receives every capability and hands each subcommand only what it declares. | Native link verification |
| `cli` | `check::run()` | `args: Args, out: mut Stdout, err: mut Stderr` | No file access: `leash check` cannot read files or call anything that does. | `check_cannot_read_files` (compile-fail, Linux) |
| `cli` | `replay::run()` | `args: Args, out: mut Stdout, err: mut Stderr, fs: Fs` | The only subcommand that reads a file (the CSV log it replays). | Checked by compiler |

---

## 3. Negative Compilation Proofs

[`scripts/compile-fail.sh`](../scripts/compile-fail.sh), run by the CI `check` job, proves these boundaries on the project's own code. Each case copies `ingots/` to a temporary folder, makes one forbidden change to a real source file, and requires `fe check` to reject the copy with the expected diagnostic. The unchanged copy must compile first, and a case whose anchor line no longer exists fails, so a case cannot pass by testing nothing.

| Case | The change to the real code | Diagnostic |
| :--- | :--- | :--- |
| `guardian_cannot_write_agents` | The guardian's `Pause` handler writes the agent registry | `error[8-0116]: contract field 'agents' is not in this handler's 'uses'` |
| `execute_cannot_write_agents` | `Execute` counts a denial in `agents` | `error[8-0066]: mutable borrow requires a mutable place` |
| `decide_cannot_write_the_ledger` | `decide` calls `record` on its `ref` state | `error[8-0066]: mutable borrow requires a mutable place` |
| `decide_cannot_add_wei_to_a_duration` | `decide` adds `tx.value` to `policy.window` | `error[8-0000]: type mismatch` |
| `check_cannot_read_files` | `leash check` calls `replay::run`, which needs `Fs` (Linux and macOS; Fe 26.6.0 compiles the CLI's file access for Unix targets only) | `error[8-0036]: missing effect 'Fs' required by 'run'` |
| `policy_per_tx_cap_above_the_window` | `config.fe`: 1 ETH per transaction against a 0.5 ETH window | `error[3-0073]: division by zero in const context` |
| `policy_with_no_targets` | `config.fe`: no targets | the same |
| `policy_with_a_zero_window` | `config.fe`: a 0-hour window | the same |
| `policy_with_a_12_hour_window` | `config.fe`: a 12-hour window, which the 24-bucket ring cannot enforce | the same |
| `policy_with_rate_limiting` | `config.fe`: 10 actions per window, which `LeashModule` cannot store | the same |
| `policy_with_a_cooldown` | `config.fe`: a 60-second cooldown, which `LeashModule` cannot store | the same |
| `policy_with_another_breaker_threshold` | `config.fe`: a breaker threshold of 5, while the module trips at 3 | the same |

The last seven are `policy::invariants::validate_policy_invariants`, which `config.fe` evaluates as a `const`; every `config.fe` that `scripts/build-policy.mjs` generates calls the same function.
