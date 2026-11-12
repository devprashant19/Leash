# GLOSSARY.md — Leash Domain Glossary

Every term listed here must be used consistently across code, types, comments, documentation, and error messages.

| Term | Definition in Leash |
|---|---|
| **Policy** | The static rule specification for an agent: caps, target allowlists, selector allowlists, and window configurations. Defined in `ingots/policy/src/types.fe`. |
| **Rule** | An individual condition in the policy engine (e.g. PerTxCap, WindowCap, DelegateCallBlocked). Evaluated in deterministic order A12. |
| **Verdict** | The outcome of evaluating a transaction against a policy: `Allow` or `Deny(DenyReason)`. |
| **DenyReason** | An enum of typed reasons why a transaction was denied. Maps 1-to-1 to numeric deny codes and Solidity custom errors. |
| **Ledger** | The spending record tracking historical amounts spent within windows. Mutated only by `record`. |
| **Window** | A rolling time window partitioned into fixed buckets (e.g. 24 hourly buckets) used to track cumulative spend or frequency. |
| **Bucket** | A discrete time slot within a rolling window (`index = now / bucket_len`) holding cumulative spend in that interval. |
| **Agent** | The AI actor or external key authorized to propose transactions via a session key subject to policy constraints. |
| **Guardian** | An address authorized to trigger the kill switch (`pause`), but never unpause, alter limits, or add agents. |
| **Safe** | The Gnosis/Gevm Safe smart account holding treasury funds. Executes transactions forwarded by authorized modules. |
| **Module** | The on-chain contract (`LeashModule`) enabled on the Safe that authenticates agents, enforces policy, updates ledger, and calls `execTransactionFromModule`. |
| **Fingerprint** | The keccak-256 hash of `"LEASH_POLICY_V1"` concatenated with the canonical big-endian encoding of the policy. Shared identically between CLI and Module. |
| **Preview** | A view function on `LeashModule` (and CLI `check`) returning the predicted verdict and remaining limits without state changes. |
| **Execute** | An on-chain entrypoint on `LeashModule` that evaluates policy, reverts with custom error on Deny, or updates ledger and calls the Safe on Allow. |
| **TryExecute** | An on-chain entrypoint that returns `(bool ok, u8 code)` without reverting on Deny, recording denials for the circuit breaker. |
| **Breaker** | The circuit breaker that trips when consecutive denials exceed a threshold in a time window. |
| **Guard** | Protocol-specific calldata decoding and policy checks (e.g. ERC-20 transfer/approve limits, Uniswap swap caps). |
| **Session** | A temporary authorization window defined by a session key expiry timestamp. |
| **Target** | The destination address of a proposed transaction. Must be present in the target allowlist unless transferring ETH within general caps. |
| **Selector** | The 4-byte function selector of an EVM contract call. Checked against allowlisted selectors for that target. |
| **Recipient** | The counterparty address receiving tokens or approvals in an ERC-20 or DeFi interaction. |
