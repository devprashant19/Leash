# ADR-011: Escalation Queue for High-Value Operations

## Status
Accepted

## Context
AI agents operating autonomous trading or settlement workflows occasionally need to execute transactions with amounts exceeding normal operational spending patterns but still within hard per-transaction safety ceilings. Direct execution of large amounts introduces risk if an agent is misled or compromised.

## Decision
We introduce an Escalation Queue mechanism (`DenyReason::EscalationRequired`, deny code 20) with pure policy transition logic and a modular execution architecture:
1. **Pure Policy Transition Modeling**:
   - `QueueState` (`Empty`, `Queued`, `Vetoed`, `Executed`), `QueueAction` (`Queue`, `Veto`, `Execute`).
   - `next_queue_state(state, action, now, ready_at) -> Result<QueueError, QueueState>` is a deterministic pure function tested on native and EVM targets.
   - `decide_with_escalation` checks if a transaction passes all normal policy rules but exceeds an `escalation_threshold`. If so, it returns `EscalationRequired` (code 20).
2. **Companion Module Architecture (`LeashQueue`)**:
   - Rather than bloating `LeashModule` beyond EIP-170 (24,576 byte runtime limit), `LeashQueue` is deployed as an authorized companion module enabled on the Safe.
   - Queued transactions record the agent, destination, value, data hash, and timelock expiry (`ready_at = now + delay_sec`).
   - The Safe owner can veto any queued transaction via `Veto { id }`.
   - After the delay expires, `ExecuteQueued` verifies calldata integrity (`keccak256(data) == data_hash`) and forwards the call through the Safe.

## Consequences
- High-value transactions cannot be executed impulsively by agents without human review or timelock visibility.
- Invariants remain strictly preserved: `decide` remains pure without `uses`, and spending caps are re-evaluated at execution time.

