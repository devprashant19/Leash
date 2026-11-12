# Phase 1 Implementation Plan — Policy Core Ingot

## Objective
Build a pure, self-contained `policy` ingot in `ingots/policy/` implementing features A1–A7 and A12 rule order, with 100% test coverage and parity across both EVM and Native targets.

---

## Tasks & Steps

### Step 1: Types & Constants (`T1`)
- **Files**: `ingots/policy/src/types.fe`, `ingots/policy/src/config.fe`
- Implement `MAX_TARGETS = 8`, `MAX_SELECTORS = 8`, `MAX_TOKENS = 4`, `BUCKETS = 24`, `BUCKET_LEN = 3600`.
- Implement `TokenAmount` (newtype over `u256`).
- Implement `Operation { Call, DelegateCall }` with conversion from `u8`.
- Implement `DenyReason` (variants 1..10) with exhaustive `reason_code` and `reason_name`.
- Implement `Verdict { Allow, Deny(DenyReason) }`.
- Implement `TargetKind { Generic, Erc20, UniswapRouter, AavePool }`.
- Implement `TargetRule`, `TokenRule`, `Policy`.
- Implement `Window` and `AgentState`.
- Implement `DEFAULT_POLICY` in `config.fe`.
- Add test in `test/policy/test_types.fe`.

### Step 2: Calldata Decoding & Helper Utilities (`T4`, `T7`)
- **File**: `ingots/policy/src/decode.fe`
- Extract 4-byte selector safely from calldata without panicking on short slices.
- Decode ERC-20 functions: `transfer(address,uint256)`, `approve(address,uint256)`, `transferFrom(address,address,uint256)`.
- Enforce strict 32-byte word padding and address high-byte zero checks.
- Add test in `test/policy/test_decode.fe`.

### Step 3: Rules A1–A7 & Evaluation Order A12 (`T2–T9`)
- **File**: `ingots/policy/src/rules.fe`
- Implement pure rule functions:
  1. `check_paused`
  2. `check_session_expired`
  3. `check_delegatecall`
  4. `check_target_allowlist`
  5. `check_selector_and_calldata`
  6. `check_per_tx_cap`
  7. `check_window_cap`
  8. `check_erc20_guard` (transfer/transferFrom caps, approval hygiene)
- Implement pure `decide(tx, policy, state) -> Verdict` with strict rule order A12.
- Write tests:
  - `test/policy/test_rules_basic.fe` (DelegateCall, Target, Selector, Per-Tx cap)
  - `test/policy/test_rules_erc20.fe` (Token cap, Unlimited approval, Revoke approval)
  - `test/policy/test_rule_order.fe` (Multi-violation precedence tests)

### Step 4: Rolling Window Ledger & `record` (`T6`, `T10`)
- **File**: `ingots/policy/src/ledger.fe`
- Implement 24-bucket sliding window computation: `spent_in_window(now)`, `record_spend(now, amount)`.
- Implement `record(tx, policy, state) -> AgentState` (pure functional state transition).
- Add test in `test/policy/test_ledger.fe` (hourly bucket expiry, rollover boundary, 25h gap reset).

### Step 5: Robustness: Malformed Input Never Panics (`T11`)
- **File**: `test/policy/test_malformed.fe`
- Test truncated calldata (1, 2, 3 bytes), odd lengths, dirty address high bytes, overflow values (`u256::MAX`).
- Verify all return `Deny` and never panic/revert.

### Step 6: Canonical Policy Encoding & Fingerprint (`T12`)
- **Files**: `ingots/policy/src/encoding.fe`, `ingots/policy/src/fingerprint.fe`
- Implement canonical 32-byte word encoding of `Policy`.
- Implement `fingerprint(policy)` using `keccak256("LEASH_POLICY_V1" || enc(policy))`.
- Pin golden vector test in `test/policy/test_fingerprint.fe`.
- Implement `encode_state` and `decode_state` round-trip.

### Step 7: Phase 1 Exit Gate & Documentation
- Run `fe fmt --check ingots`, `fe check`, `fe test`.
- Verify test counts and update `docs/RULES.md`, `docs/FE_FINDINGS.md`, `docs/adr/005-policy-representation.md`.
- Record gate output in `docs/ai-log.md` and handoff in `docs/handoff/`.
- Commit and push.
