---
name: leash
description: Comprehensive engineering guidelines and workflow rules for developing, testing, and verifying the Leash Safe policy system.
---

# Leash Engineering & Extension Skill

## 1. Core Architecture Principles
1. **Rule Isolation**: Every policy check deciding allow or deny lives strictly in `ingots/policy/src/rules.fe`.
   - `ingots/module` and `ingots/cli` only supply effects, EVM storage, and CLI I/O.
   - If you write an `if` statement deciding allow/deny outside `ingots/policy`, move it into `policy`.
2. **Pure Decide Invariant**: `policy::decide` has **NO `uses` clause**. It is pure and deterministic.
3. **State Mutation**: Only `policy::record_spend` may mutate ledger state. A denied transaction never changes the ledger.
4. **Append-Only Deny Codes**: Deny codes are never renumbered or reused. New reasons are appended with sequential codes (1..20+).
5. **Zero Drift**: The identical pure Fe policy compiles to Native CLI (`leash`) and On-Chain Safe Module (`LeashModule`), sharing the same Keccak-256 fingerprint (`0x3efcfc58aec5d1e7e81b5bded7820ed3ed8a0e654cf4aff3bfb793a7494ae6ee`).

---

## 2. How to Add a Policy Rule or ActionGuard
Follow the strict TDD cycle:

### Step 1: Types & Deny Code
- Add reason variant to `DenyReason` in `ingots/policy/src/types.fe`.
- Add mapping to `reason_code` and `reason_from_code` in `types.fe`.
- Add human explanation to `explain_reason` in `fingerprint.fe`.
- If custom error is needed for EVM reverts, add `#[error] pub struct NewError {}` in `ingots/module/src/errors.fe`.

### Step 2: Implement Rule in Pure Policy
- Write failing unit test in `ingots/policy/src/test_*.fe`.
- Add rule evaluation check in `ingots/policy/src/rules.fe` within `decide`.
- If protocol-specific (e.g. Uniswap or Aave), create an `ActionGuard` struct implementing the `ActionGuard` trait in `ingots/policy/src/guard.fe`.

### Step 3: Run Quality Gates
```bash
fe fmt --check ingots
fe fmt --check test
fe check
fe test
fe build ingots/module --emit sizes
```
- Ensure `LeashModule` runtime code remains strictly below 24,576 bytes (EIP-170).

---

## 3. Adversarial Testing Discipline
Every new rule must have a dedicated attack file in `test/attacks/src/attack_*.fe`:
- Test at the exact boundary ($cap$, $cap - 1$, $cap + 1$).
- Test evasion attempts (calldata smuggling, dirty address words, zero slippage).
- Verify both native execution and EVM revert codes.

---

## 4. Standard Pre-Flight Commands
```bash
# Verify formatting
fe fmt ingots test

# Type and effect checking
fe check

# Run all 159+ tests across workspaces
fe test

# Check bytecode headroom
fe build ingots/module --emit sizes
```

