# Leash — Drift-Proof Safe Guardrails for AI Agents in Fe

[![CI](https://github.com/devprashant19/Leash/actions/workflows/ci.yml/badge.svg)](https://github.com/devprashant19/Leash/actions/workflows/ci.yml)
[![Fe Version](https://img.shields.io/badge/Fe-26.6.0-blue)](https://github.com/argotorg/fe/releases/tag/v26.6.0)
[![License](https://img.shields.io/badge/License-Apache_2.0-green.svg)](LICENSE)

> **Pitch:** Leash gives AI agents a Safe wallet with spending limits written once in Fe — the same code enforces them on-chain and pre-checks them off-chain, so the two can never drift.
>
> **Fe-Specific Highlight:** Every policy rule is an effect-checked function, so a reviewer can read from signatures alone which code can move funds, and the identical source builds for both the EVM and native targets.

---

## Overview

Autonomous AI agents executing financial transactions need strict, non-bypassable guardrails. Existing architectures either rely on off-chain simulation (which drifts from on-chain logic) or monolithic on-chain contracts (costly and opaque to agent planning loops).

**Leash solves this with Fe's multi-target capability:**
- A single, pure Fe `policy` ingot is compiled to two targets:
  1. An on-chain **Safe Module (`LeashModule`)** enforcing spending limits on EVM.
  2. A fast native **CLI (`leash`)** predicting every verdict before a transaction is broadcast.
- Both share the exact same code, constants, and cryptographic fingerprint (`keccak256("LEASH_POLICY_V1" || enc(policy))`).
- Neither can drift from the other.

```
                 1 check                          same decide
  ┌──────────┐ ─────────► ┌──────────────────┐ ──────────────┐
  │ AI agent │            │ leash CLI(native)│               ▼
  │ proposes │            │ check·explain·   │      ┌─────────────────────┐
  │   a tx   │            │ replay·fingerprint│     │    policy ingot     │
  └────┬─────┘            │ Args,Stdout,Fs   │      │ decide: no effects  │
       │ 2 execute        └──────────────────┘      │ record: mut Ledger  │
       ▼                                            │ same fingerprint    │
  ┌──────────────────────┐   same decide + record   └─────────────────────┘
  │ LeashModule (EVM)    │ ─────────────────────────────────▲
  │ Execute·Preview·Pause│
  │ Storage,Call,Log     │
  └────┬─────────────────┘
       │ 3 allowed calls only
       ▼
  ┌──────────────────────────┐
  │ Safe smart account       │
  │ execTransactionFromModule│
  └──────────────────────────┘
```

---

## Quick Start

### Prerequisites
- **Fe Compiler**: `v26.6.0` (pinned)
- **Foundry**: `anvil`, `cast` (for testnet / local simulation)
- **Node.js**: `v20+`

### Build & Test
```sh
# Format check
fe fmt --check ingots

# Type check
fe check

# Run tests on EVM backend
fe test

# Run tests on Native backend
fe test --backend native

# Build EVM artifacts (LeashModule)
fe build

# Inspect contract bytecode sizes (must stay < 24,576 bytes)
fe build --emit sizes
```

---

## Native CLI (`leash`)

The `leash` binary compiles natively from the same pure Fe policy code:

```sh
# Predict verdict before submitting a transaction
leash check --to 0x2000000000000000000000000000000000000002 --value 0.05 --now 1700000000
# Output: ALLOW (exit code 0)

# Denied if limit exceeded
leash check --to 0x2000000000000000000000000000000000000002 --value 0.20 --now 1700000000
# Output: DENY PerTxCapExceeded: ETH per-tx cap exceeded (exit code 2)

# Inspect policy rules in plain English
leash explain

# Print cryptographic policy fingerprint
leash fingerprint
# Output: 0x3efcfc58aec5d1e7e81b5bded7820ed3ed8a0e654cf4aff3bfb793a7494ae6ee

# Audit historical CSV logs
leash replay agent_history.csv
```

# Machine-readable JSON output for AI Agent Planning Loops
leash check --to 0x2000000000000000000000000000000000000002 --value 0.05 --now 1700000000 --json
# Output:
# {
#   "verdict": "ALLOW",
#   "code": 0,
#   "reason": "None",
#   "message": "Transaction allowed by policy",
#   "remaining": {
#     "eth_per_tx_wei": "100000000000000000",
#     "eth_window_wei": "500000000000000000",
#     "actions_in_window": 0,
#     "tokens": [ ... ]
#   },
#   "window_resets_at": 1700000000,
#   "fingerprint": "0x3efcfc58aec5d1e7e81b5bded7820ed3ed8a0e654cf4aff3bfb793a7494ae6ee"
# }
```

### Policy Rules (`leash explain` verbatim)
```
Leash policy (fingerprint 0x3efcfc58aec5d1e7e81b5bded7820ed3ed8a0e654cf4aff3bfb793a7494ae6ee)
- The agent may call 2 contracts:
  - 0x1000000000000000000000000000000000000001 (ERC-20): transfer, approve, transferFrom
  - 0x2000000000000000000000000000000000000002: plain ETH transfers
- At most 0.1 ETH per transaction.
- At most 0.5 ETH in any rolling 24 hours (hourly buckets).
- Token 0x1000000000000000000000000000000000000001: at most 100 tokens per transfer; approvals up to 100 tokens; unlimited approvals are always refused.
- Delegatecall is always refused.
- Anything not listed above is refused.
```

---

## Shipped Guardrails & Features

| Feature | ID | Policy Rule | On-Chain Safe Module | Native CLI (`leash`) |
|---|---|---|---|---|
| **Contract & ETH Allowlist** | A1 | `TargetNotAllowed` (4) | Yes (`Execute`/`TryExecute`) | Yes (`check`) |
| **DelegateCall Protection** | A2 | `DelegateCallBlocked` (3) | Yes (atomic revert) | Yes (`check`) |
| **Selector & Calldata Shape** | A3 | `SelectorNotAllowed` (5), `MalformedCalldata` (6) | Yes | Yes |
| **Native ETH Per-Tx Cap** | A4 | `PerTxCapExceeded` (7) | Yes | Yes |
| **Rolling 24h Window Cap** | A5 | `WindowCapExceeded` (8) | Yes (24 hourly buckets) | Yes (`--state`) |
| **ERC-20 Per-Tx & Approval Hygiene**| A6/A7 | `TokenCapExceeded` (9), `UnlimitedApproval` (10) | Yes | Yes |
| **Recipient Allowlist** | A8 | `RecipientNotAllowed` (11) | Yes | Yes |
| **Tx-Count Rate Limiting** | A9 | `RateLimited` (12) | Yes | Yes |
| **Transaction Cooldown** | A10 | `CooldownActive` (13) | Yes | Yes |
| **Per-Agent Dynamic Limits** | B2 | `policy_for_agent` / `SetAgentPolicy` | Yes (`FingerprintOf`) | Yes |
| **Auto-Pause Circuit Breaker** | B3 | `CircuitTripped` (15) | Yes (auto-trips on 3 denials; Safe reset) | Yes |
| **Compile-time Policy Validation**| 13 | 16-variant `PolicyCheck` | Rejects invalid policies | `validate` |
| **Machine-readable JSON Output** | D1 | Structured JSON verdict | N/A | `leash check --json` |

---

## Verification Evidence (Phase 5 Feature Freeze)

### 1. Headline Cross-Backend Parity (E1)
10,000 transactions across 10 chunks were generated using a deterministic `SplitMix64` PRNG (seed `0x4C45415348`) and evaluated independently across both execution environments (EVM on-chain harness and Native CLI). Both backends produced the **identical rolling Keccak-256 digest**:

$$\text{PARITY\_GOLDEN\_DIGEST} = \mathtt{0x3a8d3e9925f2e47c6f4becdbeee4d3bcacb81b1f36a595fa9a1f975c1c5175a8}$$

#### Empirical Verdict Distribution across 10,000 Transactions:
| Verdict / Deny Code | Frequency | Percentage | Status |
|---|---|---|---|
| **Allow (0)** | 1,137 | 11.37% | Exercised |
| **Paused (1)** | 120 | 1.20% | Exercised |
| **SessionExpired (2)** | 83 | 0.83% | Exercised |
| **DelegateCallBlocked (3)** | 426 | 4.26% | Exercised |
| **TargetNotAllowed (4)** | 1,334 | 13.34% | Exercised |
| **SelectorNotAllowed (5)** | 1,056 | 10.56% | Exercised |
| **MalformedCalldata (6)** | 170 | 1.70% | Exercised |
| **PerTxCapExceeded (7)** | 337 | 3.37% | Exercised |
| **WindowCapExceeded (8)** | 252 | 2.52% | Exercised |
| **TokenCapExceeded (9)** | 131 | 1.31% | Exercised |
| **UnlimitedApproval (10)** | 68 | 0.68% | Exercised |
| **RecipientNotAllowed (11)** | 118 | 1.18% | Exercised |
| **RateLimited (12)** | 61 | 0.61% | Exercised |
| **CooldownActive (13)** | 1,692 | 16.92% | Exercised |
| **OutsideTradingHours (14)**| 0 | 0.00% | Roadmap Stage 9 |
| **CircuitTripped (15)** | 3,015 | 30.15% | Exercised |
| **Swap / Lending / USD (16–20)**| 0 | 0.00% | Roadmap Stages 9–11 |
| **Total** | **10,000** | **100.00%** | **100% Agreement** |

#### Mutation Verification (Sensitivity Proof):
A single-character operator mutation was injected into `ingots/policy/src/rules.fe` (`>` changed to `>=` in `check_per_tx_cap`). The parity suite immediately failed across 11 test assertions, proving that the parity digest check is strictly sensitive to any semantic discrepancy.

---

### 2. Adversarial Security Attack Suite (E2)
Sixteen dedicated exploit test scenarios in `test/attacks/src/` verify that all known attack vectors are neutralized:

| Attack ID | Vector | Attack Payload | Expected Result | Status |
|---|---|---|---|---|
| `01` | MultiSend Hijack | `Operation::DelegateCall` to batching contract | Denied: `DelegateCallBlocked` | **PASS** |
| `02` | Cap Evasion via Split Spends | Burst of 0.09 ETH spends under 0.1 ETH tx cap | Denied: `WindowCapExceeded` at 0.5 ETH window cap | **PASS** |
| `03` | Unlimited Approval Drain | `approve(spender, 2^256 - 1)` | Denied: `UnlimitedApproval` | **PASS** |
| `04` | Malicious Spender / Recipient | Transfer or approve to unlisted recipient | Denied: `RecipientNotAllowed` | **PASS** |
| `05` | Calldata Smuggling | 35-byte transfer, 70-byte transfer, dirty address word | Denied: `MalformedCalldata` without panic | **PASS** |
| `06` | Reentrancy Attack | Target contract calls `Execute` during subcall | Reverts: `Reentrant()` / `NotAgent()` | **PASS** |
| `07` | Stolen / Expired Key | Agent key used after timestamp expiry | Denied: `SessionExpired` / Reverts `NotAgent()` | **PASS** |
| `08` | Guardian Privilege Escalation | Guardian invokes `setAgent`, `unpause`, `resetBreaker` | Reverts: `NotSafe()` | **PASS** |
| `09` | Window Boundary Double Spend | Spends at exact `t0 + 24h` rollover boundary | Strictly 1x cap allowed across sliding window | **PASS** |
| `10` | Unlisted Token Target | `transferFrom` on unlisted ERC-20 contract | Denied: `TargetNotAllowed` | **PASS** |
| `11` | Phantom Execution Desync | Safe subcall fails (`execTransactionFromModule == false`)| Reverts: `SafeCallFailed()`, state rolled back | **PASS** |
| `12` | Policy Probing Evasion | Repeated denials through `TryExecute` | Circuit breaker trips after 3 denials | **PASS** |
| `14` | Unknown Operation Type | `operation = 2` | Reverts atomically | **PASS** |
| `15` | Arithmetic Wrap Overflow | `value = 2^256 - 1`, `amount = 2^256 - 1` | Denied without overflow panic | **PASS** |

---

### 3. Bytecode Size & Gas Benchmarks (E3)
- **Runtime Code Size**: **23,639 bytes** (18,513 code, 5,126 data).
- **EIP-170 Headroom**: **937 bytes below the 24,576-byte hard limit** (0 compiler warnings).
- **Gas**: Allowed ETH transfer ~48,000 gas; Allowed ERC-20 transfer ~51,000 gas; Policy denial event ~24,500 gas. Details in [`docs/GAS.md`](file:///c:/Users/u/OneDrive/Desktop/SayOnce/Leash/docs/GAS.md).

---

## Limitations / Future Work

Items prioritized for post-freeze extended roadmap (Stages 9–12):
1. **Trading Hours Schedule (A11)**: Scheduled for Stage 9 (DeFi & Execution Guards).
2. **Asymmetric Limit Timelock (B4)**: Lowering limits applies instantly; raising limits will queue through a 24h Safe timelock in Stage 10.
3. **TOML Configuration Parsing (D4)**: Parsing arbitrary offline TOML policy manifests in Stage 12.

---

## Project Status
**Current Phase**: Phase 4 Complete — Rich Policies & Agent Guardrails (Compile-time validation, Recipient allowlist, Rate limit, Per-agent isolation, Cooldown, Circuit breaker, and JSON CLI budget output all verified and tested).
Building towards final submission deadline: **November 24, 2026, 23:59 UTC**.
