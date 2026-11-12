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

## Limitations / Future Work

Items prioritized for post-freeze extended roadmap (Stages 9–12):
1. **Trading Hours Schedule (A11)**: Scheduled for Stage 9 (DeFi & Execution Guards).
2. **Asymmetric Limit Timelock (B4)**: Lowering limits applies instantly; raising limits will queue through a 24h Safe timelock in Stage 10.
3. **TOML Configuration Parsing (D4)**: Parsing arbitrary offline TOML policy manifests in Stage 12.

---

## Project Status
**Current Phase**: Phase 4 Complete — Rich Policies & Agent Guardrails (Compile-time validation, Recipient allowlist, Rate limit, Per-agent isolation, Cooldown, Circuit breaker, and JSON CLI budget output all verified and tested).
Building towards final submission deadline: **November 24, 2026, 23:59 UTC**.
