# THREAT_MODEL.md — Leash Security and Threat Model

*Status: Comprehensive Threat Model (Updated for Phase 2)*

## 1. Assets and Trust Boundaries

- **Safe Funds & Allowances**: Primary treasury assets (ETH, ERC-20 tokens, protocol positions) held by the Safe smart contract.
- **Module Authorization**: `LeashModule` operates as an authorized Safe module (`isModuleEnabled == true`), giving it execution authority over Safe assets via `execTransactionFromModule`.
- **Policy Storage & Ledgers**: On-chain storage tracking per-agent spending windows, session keys, and kill-switch state.
- **Off-chain Agent Environment**: Autonomous agent runtime (LLM reasoning loops, tool-calling frameworks). This environment is considered **untrusted** due to vulnerabilities like prompt injection, goal misalignment, model hallucinations, and key leakage.

---

## 2. Actors & Permissions Matrix

| Actor | Trust Level | Capabilities & Bounds |
|---|---|---|
| **Safe Owners (Multisig)** | Fully Trusted | Can enable/disable module, unpause module, add/rotate session keys (`SetAgent`), revoke agents (`RevokeAgent`), rotate guardian (`SetGuardian`). |
| **Guardian** | Minimally Trusted | Emergency kill-switch operator. Can ONLY invoke `Pause`. Cannot unpause, cannot modify agents, cannot execute or route transactions. |
| **Authorized Agent** | Semi-Trusted | Holds a temporary session key. Authorized to propose transactions through `Execute` or `TryExecute`. Strictly bound by compiled policy limits and expiry. |
| **Compromised Agent** | Hostile / Adversarial | Possesses valid agent session key. Attempts to drain funds, bypass limits, call arbitrary contracts, or corrupt storage. |
| **Target Contract** | Untrusted / Adversarial | Destination contract of an agent call. May be malicious or re-enter `LeashModule` / `Safe`. |
| **Public Observer** | Untrusted | Can invoke `Preview`, `State`, and `Fingerprint`. Cannot alter any state or execute transactions. |

---

## 3. Entry Points & Mutation Scope

| Entry Point | Access Gate | State Mutated | External Calls | Threat Surface |
|---|---|---|---|---|
| `Execute` | `msg.sender == active agent` | `locked`, `ledgers` | `Safe.execTransactionFromModule` | Fund drain, limit bypass, reentrancy. Mitigated by `policy::decide`, CEI, and reentrancy lock. |
| `TryExecute` | `msg.sender == active agent` | `locked`, `ledgers` | `Safe.execTransactionFromModule` (only on Allow) | Reentrancy, silent denial exploitation. Mitigated by `policy::decide`, CEI, and reentrancy lock. |
| `Preview` | Public | None | None | Information disclosure (budget remaining). Read-only by design. |
| `State` | Public | None | None | Information disclosure (budget remaining). Read-only by design. |
| `Pause` | Safe or Guardian | `paused` | None | Denial of Service (griefing). Mitigated: Safe can immediately unpause or replace guardian. |
| `Unpause` | Safe only | `paused` | None | Unauthorized resumption. Reverts if `msg.sender != safe`. |
| `SetAgent` | Safe only | `agents` | None | Unauthorized agent registration. Reverts if `msg.sender != safe`. Validates `expiry > now`. |
| `RevokeAgent` | Safe only | `agents` | None | Unauthorized revocation. Reverts if `msg.sender != safe`. |
| `SetGuardian` | Safe only | `guardian` | None | Unauthorized guardian rotation. Reverts if `msg.sender != safe`. |
| `Fingerprint` | Public | None | None | None. Returns compile-time Keccak-256 digest. |

---

## 4. Known Attacks & Mitigations

### 4.1. DelegateCall Storage Hijack & MultiSend Bypass
- **Threat**: The Safe's `execTransactionFromModule` accepts an `operation` flag: `0 = Call`, `1 = DelegateCall`. If an agent executes a `DELEGATECALL`, code runs in the Safe's storage context, allowing immediate overwriting of Safe owner keys or module guards.
- **Mitigation**: Policy rule A2 (`deny_delegatecall`) strictly inspects `tx.operation`. Any `operation != Operation::Call` (i.e. `operation == 1`) is immediately denied with `DenyReason::DelegateCallBlocked` (code 3). MultiSend batching contracts that rely on delegatecalls are blocked by default.

### 4.2. Unlimited Approvals (`type(uint256).max`)
- **Threat**: An agent interacting with a DeFi protocol calls `approve(spender, 2^256 - 1)`. Even if the immediate tx spends 0 ETH, the approved spender can later drain the entire Safe treasury.
- **Mitigation**: Policy rule A7 decodes ERC-20 `approve` calldata. Any approval where `amount == u256::max` or `amount > token_cap` is denied with `DenyReason::UnlimitedApproval` (code 10). Zero-amount approvals (revocations) are always permitted.

### 4.3. Calldata Smuggling & Truncation
- **Threat**: An attacker supplies truncated calldata (e.g. 3 bytes, or 35 bytes for an ERC-20 transfer) hoping to exploit off-by-one errors or dirty bits in decoding.
- **Mitigation**: Strict length verification in `ingots/policy/src/decode.fe`. Calldata shorter than 4 bytes, or mismatched for standard selectors (e.g. `transfer` requiring exactly 68 bytes), fails with `DenyReason::MalformedCalldata` (code 6). Dirty address words (non-zero upper 12 bytes) are rejected with `DenyReason::MalformedCalldata`.

### 4.4. Reentrancy
- **Threat**: During `Safe.execTransactionFromModule`, the destination target is invoked and attempts to call `LeashModule.Execute` again before state updates or within the same transaction frame.
- **Mitigation**:
  1. **Checks-Effects-Interactions (CEI)**: `policy::record` updates the hourly ledger bucket *before* `execTransactionFromModule` is called.
  2. **Reentrancy Mutex (`locked`)**: `self.locked` is set to `true` at the entry of `Execute` / `TryExecute` and released only on exit. Any re-entrant call fails with `Reentrant()`.

### 4.5. Safe Execution Failure / Phantom Spends
- **Threat**: `Safe.execTransactionFromModule` returns `bool success` rather than reverting. If the external call fails and the module does not revert, the module records spending that never occurred.
- **Mitigation**: `LeashModule` asserts `success == true`. If `success == false`, it reverts with `SafeCallFailed()`, rolling back the internal ledger state modification.

### 4.6. Rolling Window Gaming & Bucket Boundary Leaks
- **Threat**: An agent spends the maximum 24h budget right before hour $H_0$ rolls off, and immediately spends again in hour $H_1$, temporarily consuming $2 \times$ budget within a short window.
- **Mitigation**: Hourly bucket windows (ADR-002) track exact timestamp hourly indices: `current_hour = timestamp / 3600`. The sum over the last 24 active buckets is enforced for every spend. Max leakage across boundary shifts is bounded to at most one hourly bucket resolution.

### 4.7. Revert Griefing vs. Circuit Breaker (ADR-004)
- **Threat**: If `Execute` reverts on denial, on-chain state cannot be written (EVM transaction rollback), meaning denial counters cannot be incremented to trigger a circuit breaker.
- **Mitigation**: `LeashModule` provides both `Execute` (standard atomic reverting execution) and `TryExecute` (non-reverting denial tracking). `TryExecute` writes denial events and increments the breaker state without reverting when a policy violation occurs.

---

## 5. Residual Risks & Out of Scope

1. **Direct Safe Owner Bypass**: Safe owners hold multi-sig authority and can remove `LeashModule` via `Safe.disableModule(...)` at any time. Leash is a constraint on semi-autonomous *agents*, not a lock on owners.
2. **Oracle & Price Volatility**: Pure Fe `policy` in Phase 1-2 enforces static token caps and raw amounts; dynamic USD-denominated pricing is deferred to Stage 9+ oracle integrations.
3. **EVM Gas Exhaustion**: If gas limit is insufficient, transactions revert cleanly without partial state corruption.

---

## 6. Formal Claim-to-Test Mapping Matrix

Every security invariant and threat mitigation asserted in the documentation is backed by automated tests:

| Claim ID | Security Invariant | Implementing Test File | Test Function | Backend | Expected Outcome |
|---|---|---|---|---|---|
| **C1** | **DelegateCall Blocked** | `test/attacks/src/attack_01_multisend_delegatecall.fe` | `test_attack_01_multisend_delegatecall`<br>`test_attack_01_evm_delegatecall_reverts` | Native & EVM | Denied: `DelegateCallBlocked`<br>Reverts: `DelegateCallBlocked()` |
| **C2** | **Window Cap Enforcement** | `test/attacks/src/attack_02_split_transfers.fe` | `test_attack_02_split_transfers_evading_window` | Native & EVM | Denied: `WindowCapExceeded` |
| **C3** | **Unlimited Approval Block** | `test/attacks/src/attack_03_unlimited_approve.fe` | `test_attack_03_unlimited_approve` | Native & EVM | Denied: `UnlimitedApproval` (tested at max, max+1, and 0) |
| **C4** | **Recipient Isolation** | `test/attacks/src/attack_04_attacker_spender.fe` | `test_attack_04_attacker_spender_or_recipient` | Native & EVM | Denied: `RecipientNotAllowed` |
| **C5** | **Malformed Calldata Guard** | `test/attacks/src/attack_05_malformed_calldata.fe` | `test_attack_05_malformed_calldata_robustness` | Native & EVM | Denied: `MalformedCalldata` (1-3 bytes, 35b, 70b, dirty high word) |
| **C6** | **Reentrancy Protection** | `test/attacks/src/attack_06_reentrancy.fe` | `test_attack_06_reentrancy_rejected` | EVM | Reverts: `Reentrant()` (`0xed3ba6a6`) |
| **C7** | **Session Expiry** | `test/attacks/src/attack_07_expired_key.fe` | `test_attack_07_expired_session_key` | Native & EVM | Denied: `SessionExpired` (tested at expiry, expiry+1, expiry-1) |
| **C8** | **Guardian & Admin Boundary** | `test/attacks/src/attack_08_guardian_escalation.fe` | `test_attack_08_*` (7 distinct tests) | EVM | Reverts: `NotSafe()`, `NotGuardian()`, `NotAgent()`, `InvalidExpiry()` |
| **C9** | **Exact Rollover Boundary** | `test/attacks/src/attack_09_window_rollover.fe` | `test_attack_09_window_rollover_no_double_spend` | Native & EVM | Strictly 1x cap allowed across 24h boundary |
| **C10** | **Unlisted Target Denial** | `test/attacks/src/attack_10_unlisted_token.fe` | `test_attack_10_unlisted_token_target_denied` | Native & EVM | Denied: `TargetNotAllowed` |
| **C11** | **Atomic Rollback on Failure** | `test/attacks/src/attack_11_safe_call_fails.fe` | `test_attack_11_safe_call_fails_rolls_back` | EVM | Reverts: `SafeCallFailed()` |
| **C12** | **Circuit Breaker Trips** | `test/attacks/src/attack_12_breaker_evasion.fe` | `test_attack_12_circuit_breaker_trips_and_blocks_probing` | EVM | Tripped: Code 15 (`CircuitTripped`) |
| **C13** | **Unknown Opcode Rejection** | `test/attacks/src/attack_14_unknown_operation.fe` | `test_attack_14_unknown_operation_rejected` | EVM | Reverts |
| **C14** | **Value Overflow Immunity** | `test/attacks/src/attack_15_value_overflow.fe` | `test_attack_15_value_overflow_attempts_denied` | Native & EVM | Denied without panic (`PerTxCapExceeded`, `TokenCapExceeded`) |
| **C15** | **Rate Limiting Burst Guard** | `test/attacks/src/attack_16_rate_limit_burst.fe` | `test_attack_16_rate_limit_burst` | Native & EVM | Denied: `RateLimited` |
| **C16** | **Cooldown Period Protection** | `test/attacks/src/attack_17_cooldown_subversion.fe` | `test_attack_17_cooldown_subversion` | Native & EVM | Denied: `CooldownActive` (tested at cd-1s and cd) |
| **C17** | **IncreaseAllowance Bypass Guard** | `test/attacks/src/attack_18_increase_allowance_bypass.fe` | `test_attack_18_increase_allowance_bypass` | Native & EVM | Denied: `UnlimitedApproval` / `RecipientNotAllowed` |
| **C18** | **MEV Zero-Slippage Sandwich Guard** | `test/attacks/src/attack_19_mev_zero_slippage_sandwich.fe` | `test_attack_19_mev_zero_slippage_sandwich` | Native & EVM | Denied: `SwapNotAllowed` (code 16 on `amountOutMin == 0`) |
| **C19** | **Swap Recipient Diversion Guard** | `test/attacks/src/attack_20_swap_recipient_diversion.fe` | `test_attack_20_swap_recipient_diversion` | Native & EVM | Denied: `SwapNotAllowed` / `TokenCapExceeded` |
| **C20** | **Pure Decide Invariant** | Static analysis / CI Grep | `git grep -nE 'fn decide[^{]*uses'` | Compiler | 0 occurrences |
| **C21** | **Component Isolation** | Static analysis / CI Grep | `git grep -nE 'policy::rules'` | Compiler | 0 occurrences |
| **C22** | **Owner Override Selective Bypass** | `test/attacks/src/attack_21_owner_override.fe` | `test_attack_21_*` (2 tests) | Native & EVM | Allows over-cap spends; strictly rejects delegatecall, unlisted targets, replay |
| **C23** | **Escalation Queue & Veto Defense** | `test/attacks/src/attack_22_escalation_veto.fe` | `test_attack_22_escalation_queue_and_veto_defense` | Native & EVM | Denied: `EscalationRequired` (code 20); rejects early exec; veto blocks |
| **C24** | **Aave Withdrawal Diversion Guard** | `test/attacks/src/attack_23_aave_withdraw_diversion.fe` | `test_attack_23_aave_withdraw_diversion` | Native & EVM | Denied: `RecipientNotAllowed` (code 11) / `LendingNotAllowed` (code 17) |
| **C25** | **Oracle Staleness & USD Caps** | `test/attacks/src/attack_24_oracle_staleness_and_usd_caps.fe` | `test_attack_24_oracle_staleness_and_usd_caps` | Native & EVM | Denied: `PriceUnavailable` (code 18) / `UsdCapExceeded` (code 19) |

---

## 7. Threat Analysis: Owner Co-signed Overrides

- **Risk**: A compromised agent key combined with a compromised Safe owner key can move funds above configured per-tx or window caps.
- **Why this is acceptable**: In a Safe multisig architecture, a Safe owner (or N-of-M quorum) already holds direct on-chain authority to move funds or execute transactions directly from the Safe. The override mechanism allows owners to co-sign an urgent or large agent transaction without having to manually assemble the transaction calldata or disable the module.
- **Safeguards Enforced**:
  - Even with a valid owner signature, `DelegateCallBlocked`, `TargetNotAllowed`, `Paused`, `SessionExpired`, and `CircuitTripped` are **never** bypassed.
  - Signatures are strictly bound to a single agent, destination, value, calldata hash, operation, chain ID, verifying contract, monotonically increasing nonce, and deadline.
  - High-`s` and invalid `v` malleable signatures are rejected at the precompile boundary.
- **Future Work**: Multi-owner threshold overrides requiring $M$-of-$N$ owner signatures for amounts exceeding critical treasury tiers.


