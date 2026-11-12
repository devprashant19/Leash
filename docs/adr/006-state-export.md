# ADR-006: Canonical State Export and Off-Chain Prediction Parity

## Status
Accepted

## Context
Leash guarantees that an AI agent or operator can run `leash check` locally and know with 100% cryptographic certainty whether a proposed transaction will succeed on-chain or be denied, without broadcasting a transaction or risking on-chain gas failure.

Because spending limits enforce rolling 24-hour windows across 24 hourly buckets, predicting the outcome requires knowing the current agent state (active status, paused flag, expiry timestamp, and rolling bucket spends).

If the CLI were to scrape events, reconstruct state from logs, or maintain its own shadow ledger, drift between the off-chain model and on-chain storage would be inevitable due to reorgs, RPC latency, or algorithmic divergences.

## Decision

1. **On-Chain State Query (`State { agent }`)**:
   - `LeashModule` exposes a view message `State { agent: Address } -> Bytes` that loads the stored `AgentConfig` and `AgentLedger`, synthesizes `AgentState`, and exports it using `policy::encode_state(state)`.
   - `State` declares NO mutable storage effects (`uses` has no `mut` storage or external calls).
   - Anyone can call `State` off-chain via standard `eth_call`.

2. **Canonical State Encoding in `ingots/policy`**:
   - Both `encode_state` and `decode_state` are implemented in `ingots/policy/src/encoding.fe`.
   - The state is serialized into canonical 32-byte words:
     - Word 0: `active` flag (0 or 1)
     - Word 1: `paused` flag (0 or 1)
     - Word 2: `expiry` timestamp (Unix seconds)
     - Words 3..50: 24 hourly buckets of `(index: u256, amount: u256)`
     - Total: 51 words (1632 bytes).
   - Decoding performs strict bounds and boolean validation; any malformed input fails safely.

3. **CLI Direct Consumption**:
   - The native `leash check` command takes `--state <hex>` or queries the RPC via `State { agent }`.
   - The CLI feeds the decoded state directly into `policy::decide(tx, policy, state)`.
   - Neither the module nor the CLI reconstructs or mutates state outside of `policy::decide` and `policy::record`.

## Consequences
- Zero divergence between off-chain pre-flight checks and on-chain execution.
- No dependence on complex off-chain indexers or event scrapers.
- Safe, read-only inspection of agent budget state at any block height.
