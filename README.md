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

## Project Status
**Current Phase**: Phase 0 Complete — Workspace setup, 5 Fe compiler spikes verified, CI configured, documentation baselined.
Building towards final submission deadline: **November 24, 2026, 23:59 UTC**.
