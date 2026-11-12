# ADR-005: Canonical Policy Representation and Pure Functional State Updates

## Status
Accepted

## Context
Leash enforces spending limits both on-chain (`LeashModule` compiled for EVM) and off-chain (`leash` CLI compiled for native target). The policy must compile identically on both backends and produce an immutable cryptographic fingerprint (`keccak256("LEASH_POLICY_V1" || enc(policy))`).

Furthermore, in Phase 1 we evaluated whether state changes should be handled via effect-based storage (`uses (ledger: mut Ledger)`) or pure functional state transformation (`record(tx, policy, state) -> AgentState`).

## Decision

1. **Fixed-Capacity Arrays with Counts**:
   - `Policy` uses fixed-size arrays (`MAX_TARGETS = 8`, `MAX_SELECTORS = 8`, `MAX_TOKENS = 4`, `MAX_RECIPIENTS = 8`) paired with explicit count fields (`n_targets`, `n_tokens`, etc.).
   - Arrays are strictly sorted in ascending order with unused slots zeroed.
   - Rationale: Guarantees deterministic serialization without dynamic heap overhead, eliminates ABI divergence between native and EVM backends, and makes `O(N)` lookups fast and unhackable.

2. **Canonical Word Serialization**:
   - `enc(policy)` serializes the policy into a fixed sequence of 138 big-endian 32-byte words (`[u256; 138]`).
   - The fingerprint is computed as `keccak256("LEASH_POLICY_V1" || enc(policy))`, absorbing the 15-byte prefix followed by each 32-byte word into `core::hash::Keccak256`.
   - `DEFAULT_POLICY` produces the pinned golden fingerprint:
     `0x3efcfc58aec5d1e7e81b5bded7820ed3ed8a0e654cf4aff3bfb793a7494ae6ee`.

3. **Pure Functional State Transformation**:
   - `decide` is strictly pure and has NO `uses` clause.
   - `record(tx: Tx, policy: Policy, state: AgentState) -> AgentState` is pure and functional: it takes the current state and returns the next state with updated hourly bucket windows.
   - On EVM in `LeashModule`, the contract loads storage into `AgentState`, calls `decide`, calls `record`, and writes the modified state back to storage.
   - In the CLI and test environments, `record` operates directly on value copies in memory.

## Consequences
- Zero effect discrepancies between backends.
- 100% test coverage achievable on both EVM and native backends without mocking storage drivers.
- Complete determinism and absence of side-effects during `decide`.
