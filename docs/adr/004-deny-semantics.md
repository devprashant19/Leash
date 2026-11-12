# ADR-004: Dual Execution Entry Points (`Execute` vs `TryExecute`)

## Context
When an automated agent attempts to execute a transaction on-chain that violates policy rules, traditional smart contracts have only one behavior: revert the transaction with an error.

However, in autonomous agent workflows:
1. Reverting transactions causes automated agent runners to discard failure metadata or classify them as unhandled system crashes.
2. An on-chain circuit breaker cannot record persistent state (such as denial counters or consecutive violation streaks) inside a reverted call because EVM state changes rollback entirely upon revert.
3. Conversely, traditional tooling and integrations (e.g. scripts that expect atomic failures, or testing frameworks) require hard reverts to prevent state progression and signal failure via standard EVM revert selectors.

## Decision
We expose two complementary execution messages on `LeashModule`:
1. `Execute { to, value, data, operation } -> bool`:
   - Enforces strict revert semantics.
   - On `Deny(reason)`, reverts with a 4-byte selector matching `#[error] struct Reason {}` (e.g., `Paused()`, `PerTxCapExceeded()`, `TargetNotAllowed()`).
   - Ensures zero ledger state changes and zero gas waste beyond validation.
2. `TryExecute { to, value, data, operation } -> (bool, u8)`:
   - Enforces no-revert soft denial semantics.
   - On `Deny(reason)`, does NOT revert. Instead, it emits `Denied(agent, target, code)`, returns `(false, code)`, and permits recording persistent denial metrics (such as incrementing the circuit breaker denial ledger).
   - Allows autonomous agent loops to gracefully receive error codes and pivot execution strategies without EVM transaction crashes.

On `Allow`, both entry points execute identically:
- Mutate spending ledger (`record`).
- Emit `Allowed(agent, target, value, selector)`.
- Call `safe.execTransactionFromModule(to, value, data, operation)`.
- Revert with `SafeCallFailed()` if the Safe execution returns false.

## Consequences
- **Positive**:
  - Full observability: Agents can use `TryExecute` to log denials on-chain for auditing without incurring revert crashes.
  - Composable: Traditional callers use `Execute` and receive typed custom revert errors.
  - Zero divergence: Both handlers evaluate the exact same pure `policy::rules::decide` function.
- **Negative**:
  - Requires maintaining two distinct message selectors in the ABI.
  - `TryExecute` consumes gas on denied transactions to emit events and persist breaker state, whereas `Execute` burns minimal gas up to the revert point.

## Status
Accepted.
