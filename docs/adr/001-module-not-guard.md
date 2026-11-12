# ADR-001: Safe Module Architecture Rather Than Guard

## Context
When integrating spending limits and policy controls for automated AI agents operating with a Gnosis/Safe smart account, two integration models exist:
1. **Safe Guard (`TransactionGuard`)**: Intercepts transactions initiated directly by Safe owners or modules during `execTransaction`.
2. **Safe Module (`ModuleManager`)**: Exposes an independent entry point that calls `Safe.execTransactionFromModule` to execute approved actions.

## Decision
We choose the **Module** pattern (`LeashModule`). The AI agent interacts exclusively with `LeashModule`, rather than holding a multi-sig owner key on the Safe.

## Consequences
- **Positive**:
  - Clear separation of privilege: The AI agent has no direct signing power over the Safe.
  - Revocability: Safe owners retain supreme control and can revoke or disable the module with a single multi-sig transaction without altering signer key sets.
  - Independent State: The module manages agent session keys, hourly rolling ledger buckets, and circuit breakers in its own storage context.
  - Guard compatibility: Safe owners can still attach arbitrary transaction guards to their Safe without interfering with `LeashModule`.
- **Negative**:
  - The Safe must explicitly enable `LeashModule` via `enableModule(address)`.
  - Transaction submission requires calling `LeashModule.Execute` instead of standard `Safe.execTransaction`.

## Status
Accepted.
