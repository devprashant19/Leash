# ADR-007: Per-Agent Policies and Storage Model

## Context
In a multi-agent environment, different AI agents operating from the same Safe wallet require different permission tiers. A high-trust settlement agent may be permitted to spend up to 0.5 ETH per transaction, while a routine micro-agent should be capped at 0.01 ETH per transaction.

Storing a full 138-word `Policy` struct per agent in EVM contract storage would consume excessive gas and bytecode during reads and writes, easily exceeding the EIP-170 limit of 24,576 bytes.

## Decision
1. **Per-Agent Policy Configuration in `AgentConfig`**:
   `AgentConfig` stores the agent's active status, expiry, label, and dedicated per-agent limits (`max_per_tx` and `max_per_window`).
2. **Safe Administration**:
   The Safe wallet can set or update an agent's policy limits via `SetAgentPolicy(agent, max_per_tx, max_per_window)`.
3. **Pure Policy Evaluation**:
   When evaluating transactions in `Execute`, `TryExecute`, and `Preview`, the module constructs the agent-specific `Policy` and passes it to the pure `policy::decide` function.
4. **Cryptographic Fingerprint Per Agent**:
   `FingerprintOf(agent)` dynamically computes the Keccak-256 policy fingerprint reflecting the agent's exact spending parameters, ensuring CLI and on-chain parity.
5. **Ledger Isolation**:
   Ledgers remain strictly isolated per agent (`ledgers: StorageMap<Address, AgentLedger>`), ensuring spend tracking cannot cross agent boundaries.

## Consequences
- **Security**: Strict isolation prevents compromised low-trust agents from exhausting higher-trust agent budgets.
- **Gas & Size**: Minimal storage footprint (<2 storage slots per agent configuration), keeping `LeashModule` well under the EIP-170 bytecode threshold.
- **Parity**: Identical fingerprint generation guarantees that `leash check` and `LeashModule` produce the exact same verdicts.

## Status
Accepted.
