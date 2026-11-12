# ADR-002: Fixed 24 Hourly Buckets for Rolling Windows

## Context
Enforcing rolling time windows (e.g. 24-hour spending limits) on EVM smart accounts is notoriously gas-intensive. Storing timestamped transaction logs requires unbounded arrays and linear traversal (`O(N)` gas), risking out-of-gas griefing or excessive gas costs per transaction.

## Decision
We implement rolling windows as a fixed array of 24 hourly buckets (`Window<24>`):
- Bucket index: `bucket_index = now / 3600`.
- Slot index: `bucket_index % 24`.
- Spent amount in window: sum of all slots whose `bucket_index > current_index - 24`.
- Expiry rule: spend in bucket `b` expires at the very first second of bucket `b + 24`.

## Consequences
- **Positive**:
  - Predictable, bounded gas consumption: calculating rolling spend requires iterating over at most 24 slots (`O(1)` complexity relative to transaction count).
  - Canonical and simple memory layout for both EVM storage and native CLI execution.
  - Zero dynamic heap allocation.
- **Negative / Approximation**:
  - Because buckets are hourly, a true sliding 24-hour interval can allow up to `cap + (spend in one bucket)` in edge scenarios (at most 2 × cap if spent at 00:59 and again at 24:00 the next day).
  - This trade-off is accepted to ensure bounded on-chain execution cost, and is clearly documented in the threat model and user documentation.

## Status
Accepted.
