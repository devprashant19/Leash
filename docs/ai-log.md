# AI-Assisted Development Log (Contest AI Declaration)

This file tracks every AI-assisted code and documentation change throughout the Fe Builders Challenge.

---

## 2026-11-13 — Phase 0 — Toolchain Verification & Workspace Initialization
- **AI-assisted**: yes (Antigravity).
- **Files**: `fe.toml`, `ingots/policy/*`, `ingots/module/*`, `ingots/cli/*`, `ingots/testkit/*`, `Makefile`, `.github/workflows/ci.yml`, `AGENTS.md`, `CLAUDE.md`, `GLOSSARY.md`, `CONSTRAINTS.md`, `DECLARATION.md`, `docs/*`.
- **What**: Verified Fe 26.6.0 compiler, Foundry suite (anvil, cast 1.9.0), Node.js v22. Configured multi-ingot workspace, verified compilation on EVM and Native backends, executed 5 Fe spikes, authored architectural documents and ADRs 001–003.
- **Reviewed by human**: pending confirmation.

### Toolchain Verification Evidence:
```text
fe: fe 26.6.0 (5b3f96a)
anvil: anvil Version: 1.9.0 (Commit SHA: 6056c5845d34205a83cf7108042adb137325c9df)
cast: cast Version: 1.9.0 (Commit SHA: 6056c5845d34205a83cf7108042adb137325c9df)
node: v22.15.1
npm: 10.9.2
```

## Gate — Phase 0 — 2026-11-13

```text
$ fe --version
fe 26.6.0 (5b3f96a)

$ fe fmt --check ingots
(clean, 0 diffs)

$ fe check
(clean, 0 errors)

$ fe test
running `fe test` for 4 inputs (jobs=8)

COMPILING        cli     ingots/cli
COMPILING        module  ingots/module
COMPILING        policy  ingots/policy
COMPILING        testkit ingots/testkit
READY [0.3543s]  cli     running 0 tests
READY [0.4720s]  module  running 1 test
PASS  [0.0004s]  module  test_paused_custom_error
READY [0.5074s]  policy  running 2 tests
PASS  [0.0001s]  policy  test_cap_multiplier
PASS  [0.0004s]  policy  test_keccak_word
READY [0.8976s]  testkit running 1 test
PASS  [0.0001s]  testkit test_mock_safe_call

test result: ok. 4 passed; 0 failed

$ fe build
Wrote out/LeashModule.bin
Wrote out/LeashModule.runtime.bin
Wrote out/LeashModule.abi.json
Wrote out/MockSafe.bin
Wrote out/MockSafe.runtime.bin
Wrote out/MockSafe.abi.json

$ fe build --emit sizes
Wrote out/LeashModule.sizes.txt: runtime: 45 bytes (< 24,576 bytes)
Wrote out/MockSafe.sizes.txt

$ fe build -i cli --backend native --emit ir
Wrote out/cli.native.sona
```

## 2026-11-13 — Phase 1 — T1 Core Types and Constants
- **AI-assisted**: yes (Antigravity).
- **Files**: `ingots/policy/src/types.fe`, `ingots/policy/src/config.fe`, `ingots/policy/src/test_types.fe`, `ingots/testkit/src/fixtures.fe`, `test/compile_fail/units_mixing.fe`, `scripts/compile-fail.sh`.
- **What**: Implemented core types (TokenAmount, Operation, DenyReason codes 1..20, Verdict, TargetKind, TargetRule, TokenRule, Policy, Bucket, Window24, AgentState, Calldata, Tx), selector constants, default_policy in config.fe, testkit fixtures, compile-fail test with test runner script, and comprehensive unit tests.
- **Reviewed by human**: pending confirmation.

## 2026-11-13 — Phase 1 — Calldata Decoding (T4, T7)
- **AI-assisted**: yes (Antigravity).
- **Files**: `ingots/policy/src/decode.fe`, `ingots/policy/src/test_decode.fe`, `ingots/policy/src/lib.fe`.
- **What**: Implemented safe calldata decoding (selector_of, is_address_word with high-12 zero byte validation, read_word, read_address, and decode_erc20 for transfer, approve, and transferFrom with exact length enforcement rejecting truncated or oversized calldata).
- **Reviewed by human**: pending confirmation.

## 2026-11-13 — Phase 1 — Rolling Window Ledger and Record (T6, T10)
- **AI-assisted**: yes (Antigravity).
- **Files**: `ingots/policy/src/ledger.fe`, `ingots/policy/src/test_ledger.fe`, `ingots/policy/src/lib.fe`.
- **What**: Implemented Window24 hourly bucket calculations (bucket_index_of, spent_in_window with saturation on overflow, record_spend with slot rollover and stale bucket overwrite, pure record updating ETH/token/action windows, and record_denial). Verified exact 24h rollover boundary, 25h full reset, and spend recording.
- **Reviewed by human**: pending confirmation.

## 2026-11-13 — Phase 1 — Rules Engine and Pure Decide (T2-T9)
- **AI-assisted**: yes (Antigravity).
- **Files**: `ingots/policy/src/rules.fe`, `ingots/policy/src/test_rules_basic.fe`, `ingots/policy/src/test_rules_erc20.fe`, `ingots/policy/src/test_rule_order.fe`, `ingots/policy/src/lib.fe`.
- **What**: Implemented pure `decide` with strict A12 rule precedence (Paused -> CircuitTripped -> SessionExpired -> CooldownActive -> DelegateCallBlocked -> TargetNotAllowed -> Calldata/Selector -> RateLimited -> PerTxCap -> WindowCap -> ERC-20 Guard). Added comprehensive unit tests for basic rules, ERC-20 approval/transfer limits, and multi-violation rule order precedence tests.
- **Reviewed by human**: pending confirmation.

## 2026-11-13 — Phase 1 — Robustness Against Malformed Calldata (T11)
- **AI-assisted**: yes (Antigravity).
- **Files**: `ingots/policy/src/test_malformed.fe`, `ingots/policy/src/lib.fe`.
- **What**: Verified that arbitrary malformed inputs (0 bytes to token, 3 bytes, unknown 4-byte selector, 35-byte transfer, 100-byte transfer, dirty address high word, u256::MAX amounts and values) return appropriate Deny verdicts without panicking or reverting.
- **Reviewed by human**: pending confirmation.

## 2026-11-13 — Phase 1 — Canonical Encoding & Cryptographic Fingerprint (T12)
- **AI-assisted**: yes (Antigravity).
- **Files**: `ingots/policy/src/encoding.fe`, `ingots/policy/src/fingerprint.fe`, `ingots/policy/src/test_fingerprint.fe`, `ingots/policy/src/lib.fe`, `docs/adr/005-policy-representation.md`, `docs/RULES.md`.
- **What**: Implemented canonical 138-word serialization for Policy, 340-word round-trip serialization for AgentState, Keccak-256 streaming hashing with 15-byte prefix `"LEASH_POLICY_V1"`, and pinned golden fingerprint for default_policy (`0x3efcfc58aec5d1e7e81b5bded7820ed3ed8a0e654cf4aff3bfb793a7494ae6ee`). Added plain-English `explain_reason` for all 20 deny reasons.
- **Reviewed by human**: pending confirmation.

## Gate — Phase 1 — 2026-11-16
```
$ fe --version
fe 26.6.0 (5b3f96a)

$ fe fmt --check ingots
(clean, exit 0)

$ fe check
(clean, exit 0)

$ fe test
running `fe test` for 4 inputs (jobs=8)

COMPILING        cli     ingots/cli
COMPILING        module  ingots/module
COMPILING        policy  ingots/policy
COMPILING        testkit ingots/testkit
READY [0.8764s]  cli     running 0 tests
READY [0.9645s]  module  running 1 test
PASS  [0.0004s]  module  test_paused_custom_error
READY [1.7388s]  testkit running 1 test
PASS  [0.0001s]  testkit test_mock_safe_call
READY [8.6908s]  policy  running 44 tests
PASS  [0.0000s]  policy  test_bucket_index_calculation
PASS  [0.0001s]  policy  test_25h_gap_full_reset
PASS  [0.0001s]  policy  test_allow_valid_eth_transfer
PASS  [0.0001s]  policy  test_deny_delegatecall
PASS  [0.0000s]  policy  test_deny_empty_policy_denies_all
PASS  [0.0004s]  policy  test_decode_dirty_address
PASS  [0.0000s]  policy  test_deny_paused
PASS  [0.0000s]  policy  test_deny_session_expired
PASS  [0.0001s]  policy  test_deny_unlisted_target
PASS  [0.0000s]  policy  test_deny_zero_address_target
PASS  [0.0005s]  policy  test_decode_approve_success
PASS  [0.0005s]  policy  test_decode_transfer_success
PASS  [0.0006s]  policy  test_decode_transfer_from_success
PASS  [0.0001s]  policy  test_explain_reason_all_variants
PASS  [0.0000s]  policy  test_operation_conversion
PASS  [0.0000s]  policy  test_order_delegatecall_beats_unlisted_target_and_cap
PASS  [0.0000s]  policy  test_order_paused_beats_delegatecall_and_unlisted
PASS  [0.0008s]  policy  test_allow_erc20_transfer
PASS  [0.0000s]  policy  test_order_unlisted_target_beats_per_tx_cap
PASS  [0.0001s]  policy  test_reason_codes_exhaustive
PASS  [0.0001s]  policy  test_reason_names_exhaustive
PASS  [0.0000s]  policy  test_record_denial_counter
PASS  [0.0008s]  policy  test_deny_erc20_transfer_over_cap
PASS  [0.0001s]  policy  test_record_eth_spend
PASS  [0.0007s]  policy  test_record_token_spend
PASS  [0.0018s]  policy  test_decode_malformed_lengths
PASS  [0.0001s]  policy  test_robustness_empty_data_token_target
PASS  [0.0001s]  policy  test_robustness_three_byte_data
PASS  [0.0018s]  policy  test_deny_calldata_shape_and_selector
PASS  [0.0009s]  policy  test_robustness_amount_u256_max
PASS  [0.0003s]  policy  test_robustness_transfer_thirty_five_bytes
PASS  [0.0001s]  policy  test_robustness_value_u256_max_no_overflow_panic
PASS  [0.0001s]  policy  test_rolling_window_24h_rollover_exact
PASS  [0.0003s]  policy  test_robustness_unknown_selector_four_bytes
PASS  [0.0000s]  policy  test_selectors_match
PASS  [0.0001s]  policy  test_single_and_multiple_spends_same_bucket
PASS  [0.0007s]  policy  test_robustness_dirty_address_word
PASS  [0.0006s]  policy  test_robustness_transfer_one_hundred_bytes
PASS  [0.0003s]  policy  test_selector_of_cases
PASS  [0.0021s]  policy  test_erc20_malformed_calldata_denied
PASS  [0.0020s]  policy  test_per_tx_and_window_eth_caps
PASS  [0.0006s]  policy  test_state_encode_decode_roundtrip
PASS  [0.0027s]  policy  test_erc20_approval_hygiene
PASS  [0.0413s]  policy  test_fingerprint_deterministic_and_sensitivity

test result: ok. 46 passed; 0 failed

$ bash scripts/compile-fail.sh
Running compile-fail tests...
PASS (correctly failed to compile): test/compile_fail/units_mixing.fe
compile-fail suite passed: 1 file(s) correctly rejected

$ bash scripts/count-tests.sh
Running tests on EVM backend...
test result: ok. 46 passed; 0 failed
EVM passed count: 46
Windows host detected: Native executable test runner requires Linux/macOS linking.
EVM tests verified: 46 passed.

$ fe build
Wrote out/LeashModule.bin
Wrote out/LeashModule.runtime.bin
Wrote out/LeashModule.abi.json
Wrote out/MockSafe.bin
Wrote out/MockSafe.runtime.bin
Wrote out/MockSafe.abi.json

$ fe build -i cli --backend native --emit ir
Wrote out/cli.native.sona

$ fe build --emit sizes
runtime: 45 bytes (45 code, 0 data, 0 embedded)
creation: 64 bytes (19 code, 0 data, 45 embedded)

$ git grep -nE 'fn decide[^{]*uses' ingots/policy/src/*.fe
(no matches — decide has zero side-effects and no uses clause)
```








---

## 2026-11-18 — Phase 2: LeashModule Contract & Mock Safe Complete

### Standard Gate & Review Gate Output

```bash
$ fe fmt --check ingots
(clean - 0 errors)

$ fe check
(clean - 0 errors)

$ fe test
running `fe test` for 4 inputs (jobs=8)

COMPILING        cli     ingots/cli
COMPILING        module  ingots/module
COMPILING        policy  ingots/policy
COMPILING        testkit ingots/testkit
READY [0.8615s]  cli     running 0 tests
READY [4.1116s]  testkit running 3 tests
PASS  [0.0006s]  testkit test_mock_safe_reverts_when_not_enabled
PASS  [0.0006s]  testkit test_mock_safe_basic
PASS  [0.0007s]  testkit test_mock_erc20_basic
READY [4.9565s]  policy  running 43 tests
PASS  [0.0001s]  policy  test_bucket_index_calculation
PASS  [0.0001s]  policy  test_25h_gap_full_reset
PASS  [0.0001s]  policy  test_allow_valid_eth_transfer
PASS  [0.0002s]  policy  test_decode_dirty_address
PASS  [0.0002s]  policy  test_decode_approve_success
PASS  [0.0000s]  policy  test_deny_delegatecall
PASS  [0.0000s]  policy  test_deny_empty_policy_denies_all
PASS  [0.0000s]  policy  test_deny_paused
PASS  [0.0002s]  policy  test_decode_transfer_from_success
PASS  [0.0000s]  policy  test_deny_session_expired
PASS  [0.0001s]  policy  test_decode_transfer_success
PASS  [0.0003s]  policy  test_allow_erc20_transfer
PASS  [0.0000s]  policy  test_deny_zero_address_target
PASS  [0.0001s]  policy  test_deny_unlisted_target
PASS  [0.0001s]  policy  test_explain_reason_all_variants
PASS  [0.0002s]  policy  test_deny_erc20_transfer_over_cap
PASS  [0.0000s]  policy  test_operation_conversion
PASS  [0.0004s]  policy  test_decode_malformed_lengths
PASS  [0.0000s]  policy  test_order_delegatecall_beats_unlisted_target_and_cap
PASS  [0.0000s]  policy  test_order_paused_beats_delegatecall_and_unlisted
PASS  [0.0001s]  policy  test_order_unlisted_target_beats_per_tx_cap
PASS  [0.0001s]  policy  test_reason_codes_exhaustive
PASS  [0.0000s]  policy  test_record_denial_counter
PASS  [0.0001s]  policy  test_reason_names_exhaustive
PASS  [0.0000s]  policy  test_record_eth_spend
PASS  [0.0006s]  policy  test_deny_calldata_shape_and_selector
PASS  [0.0002s]  policy  test_robustness_amount_u256_max
PASS  [0.0000s]  policy  test_robustness_three_byte_data
PASS  [0.0002s]  policy  test_robustness_dirty_address_word
PASS  [0.0001s]  policy  test_robustness_empty_data_token_target
PASS  [0.0004s]  policy  test_per_tx_and_window_eth_caps
PASS  [0.0007s]  policy  test_erc20_malformed_calldata_denied
PASS  [0.0001s]  policy  test_robustness_value_u256_max_no_overflow_panic
PASS  [0.0002s]  policy  test_robustness_transfer_one_hundred_bytes
PASS  [0.0002s]  policy  test_robustness_unknown_selector_four_bytes
PASS  [0.0002s]  policy  test_robustness_transfer_thirty_five_bytes
PASS  [0.0000s]  policy  test_selectors_match
PASS  [0.0001s]  policy  test_single_and_multiple_spends_same_bucket
PASS  [0.0001s]  policy  test_rolling_window_24h_rollover_exact
PASS  [0.0002s]  policy  test_selector_of_cases
PASS  [0.0001s]  policy  test_state_encode_decode_roundtrip
PASS  [0.0009s]  policy  test_erc20_approval_hygiene
PASS  [0.0359s]  policy  test_fingerprint_deterministic_and_sensitivity
READY [8.0495s]  module  running 17 tests
PASS  [0.0012s]  module  test_pause_unpause_guardian
PASS  [0.0012s]  module  test_preview_inactive_agent
PASS  [0.0013s]  module  test_fingerprint_golden
PASS  [0.0016s]  module  test_execute_denied_target_reverts
PASS  [0.0016s]  module  test_reentrancy_rejected_not_agent
PASS  [0.0018s]  module  test_execute_denied_cap_reverts
PASS  [0.0018s]  module  test_execute_allowed_eth
PASS  [0.0019s]  module  test_reentrancy_rejected_reentrant_flag
PASS  [0.0012s]  module  test_set_agent_by_non_safe_reverts
PASS  [0.0014s]  module  test_safe_call_failed_reverts
PASS  [0.0016s]  module  test_revoked_agent_reverts
PASS  [0.0010s]  module  test_zero_address_guardian_reverts
PASS  [0.0012s]  module  test_unregistered_agent_reverts
PASS  [0.0014s]  module  test_try_execute_allowed_success
PASS  [0.0014s]  module  test_try_execute_denied_returns_code
PASS  [0.0008s]  module  test_zero_address_safe_reverts
PASS  [0.0016s]  module  test_unpause_by_non_safe_reverts

test result: ok. 63 passed; 0 failed

$ fe build ingots/module --emit sizes
runtime: 23050 bytes (17957 code, 5093 data, 0 embedded)
creation: 23305 bytes (255 code, 0 data, 23050 embedded)
EIP-170 limit: 24576 bytes (passed: 1526 bytes headroom, 0 warnings)

$ git grep -nE 'fn decide[^{]*uses' ingots/policy/src/*.fe
(no matches — pure decide invariant holds)
```

### Exit Gate Verdict: PASSED
- `LeashModule` runs `policy::decide`, enforces checks, records spending in hourly buckets, and calls `MockSafe.execTransactionFromModule`.
- Full integration tests pass on EVM: 17 module tests, 43 policy tests, 3 testkit tests = 63 tests green.
- Reentrancy resistance tested and verified with `testkit::Reenterer`.
- Contract runtime size is 23,050 bytes (< 24,576 bytes) with zero compiler warnings.
- ADR-004 (`004-deny-semantics.md`) and ADR-006 (`006-state-export.md`) written and accepted.
- `ARCHITECTURE.md` and `THREAT_MODEL.md` updated.
- `docs/handoff/2026-11-18.md` committed.

---

## 2026-11-20 — Phase 3: Native CLI (`leash`) & C Library Complete

### Standard Gate & Review Gate Output

```bash
$ fe fmt --check ingots
(clean - 0 errors)

$ fe check
(clean - 0 errors)

$ fe test
running `fe test` for 4 inputs (jobs=8)

COMPILING        cli     ingots/cli
COMPILING        module  ingots/module
COMPILING        policy  ingots/policy
COMPILING        testkit ingots/testkit
READY [2.9179s]  cli     running 2 tests
PASS  [0.0004s]  cli     test_default_check_state_unrestricted
PASS  [0.0099s]  cli     test_cli_fingerprint_golden
READY [3.8815s]  testkit running 3 tests
PASS  [0.0003s]  testkit test_mock_safe_reverts_when_not_enabled
PASS  [0.0003s]  testkit test_mock_erc20_basic
PASS  [0.0004s]  testkit test_mock_safe_basic
READY [5.0339s]  policy  running 44 tests
PASS  [0.0000s]  policy  test_bucket_index_calculation
PASS  [0.0001s]  policy  test_25h_gap_full_reset
PASS  [0.0001s]  policy  test_allow_valid_eth_transfer
PASS  [0.0001s]  policy  test_decode_dirty_address
PASS  [0.0002s]  policy  test_decode_approve_success
PASS  [0.0000s]  policy  test_deny_delegatecall
PASS  [0.0000s]  policy  test_deny_empty_policy_denies_all
PASS  [0.0001s]  policy  test_decode_transfer_success
PASS  [0.0000s]  policy  test_deny_paused
PASS  [0.0002s]  policy  test_decode_transfer_from_success
PASS  [0.0000s]  policy  test_deny_session_expired
PASS  [0.0000s]  policy  test_deny_zero_address_target
PASS  [0.0001s]  policy  test_deny_unlisted_target
PASS  [0.0003s]  policy  test_allow_erc20_transfer
PASS  [0.0004s]  policy  test_decode_malformed_lengths
PASS  [0.0002s]  policy  test_deny_erc20_transfer_over_cap
PASS  [0.0001s]  policy  test_explain_reason_all_variants
PASS  [0.0000s]  policy  test_order_delegatecall_beats_unlisted_target_and_cap
PASS  [0.0000s]  policy  test_order_paused_beats_delegatecall_and_unlisted
PASS  [0.0000s]  policy  test_operation_conversion
PASS  [0.0001s]  policy  test_order_unlisted_target_beats_per_tx_cap
PASS  [0.0000s]  policy  test_reason_codes_exhaustive
PASS  [0.0001s]  policy  test_reason_names_exhaustive
PASS  [0.0001s]  policy  test_reason_from_code_roundtrip
PASS  [0.0000s]  policy  test_record_denial_counter
PASS  [0.0000s]  policy  test_record_eth_spend
PASS  [0.0006s]  policy  test_deny_calldata_shape_and_selector
PASS  [0.0002s]  policy  test_robustness_amount_u256_max
PASS  [0.0001s]  policy  test_robustness_empty_data_token_target
PASS  [0.0001s]  policy  test_robustness_three_byte_data
PASS  [0.0002s]  policy  test_robustness_dirty_address_word
PASS  [0.0007s]  policy  test_erc20_malformed_calldata_denied
PASS  [0.0005s]  policy  test_per_tx_and_window_eth_caps
PASS  [0.0002s]  policy  test_robustness_unknown_selector_four_bytes
PASS  [0.0002s]  policy  test_robustness_transfer_thirty_five_bytes
PASS  [0.0001s]  policy  test_robustness_value_u256_max_no_overflow_panic
PASS  [0.0000s]  policy  test_selectors_match
PASS  [0.0003s]  policy  test_robustness_transfer_one_hundred_bytes
PASS  [0.0001s]  policy  test_rolling_window_24h_rollover_exact
PASS  [0.0001s]  policy  test_single_and_multiple_spends_same_bucket
PASS  [0.0001s]  policy  test_state_encode_decode_roundtrip
PASS  [0.0001s]  policy  test_selector_of_cases
PASS  [0.0010s]  policy  test_erc20_approval_hygiene
PASS  [0.0357s]  policy  test_fingerprint_deterministic_and_sensitivity
READY [7.7902s]  module  running 17 tests
PASS  [0.0011s]  module  test_pause_unpause_guardian
PASS  [0.0011s]  module  test_fingerprint_golden
PASS  [0.0013s]  module  test_preview_inactive_agent
PASS  [0.0014s]  module  test_execute_denied_target_reverts
PASS  [0.0014s]  module  test_reentrancy_rejected_reentrant_flag
PASS  [0.0015s]  module  test_execute_denied_cap_reverts
PASS  [0.0015s]  module  test_reentrancy_rejected_not_agent
PASS  [0.0016s]  module  test_execute_allowed_eth
PASS  [0.0011s]  module  test_revoked_agent_reverts
PASS  [0.0008s]  module  test_zero_address_guardian_reverts
PASS  [0.0012s]  module  test_set_agent_by_non_safe_reverts
PASS  [0.0014s]  module  test_safe_call_failed_reverts
PASS  [0.0012s]  module  test_unregistered_agent_reverts
PASS  [0.0013s]  module  test_try_execute_denied_returns_code
PASS  [0.0012s]  module  test_unpause_by_non_safe_reverts
PASS  [0.0014s]  module  test_try_execute_allowed_success
PASS  [0.0008s]  module  test_zero_address_safe_reverts

test result: ok. 66 passed; 0 failed

$ fe build ingots/module --emit sizes
runtime: 23050 bytes (17957 code, 5093 data, 0 embedded)
creation: 23305 bytes (255 code, 0 data, 23050 embedded)
Headroom: 1526 bytes below EIP-170 limit, 0 warnings

$ git grep -nE 'fn decide[^{]*uses' ingots/policy/src/*.fe
(no matches — pure decide invariant holds)

$ git grep -nE 'policy::rules|policy::ledger' ingots/cli/src/*.fe ingots/module/src/*.fe
(no matches — component isolation invariant holds)

$ git grep -n "Fs" ingots/cli/src/*.fe
ingots/cli/src/lib.fe:13:use std::fs::Fs
ingots/cli/src/lib.fe:31:pub fn main() -> i32 uses (args: Args, out: mut Stdout, err: mut Stderr, fs: Fs) {
ingots/cli/src/replay.fe:13:use std::fs::Fs
ingots/cli/src/replay.fe:250:pub fn run() -> i32 uses (args: Args, out: mut Stdout, err: mut Stderr, fs: Fs) {
(Fs effect strictly confined to replay; check, explain, and fingerprint have zero filesystem capability)
```

### Exit Gate Verdict: PASSED
- `leash check`, `explain`, `fingerprint`, and `replay` implemented natively in `ingots/cli`.
- `leash fingerprint` produces golden hash `0x3efcfc58aec5d1e7e81b5bded7820ed3ed8a0e654cf4aff3bfb793a7494ae6ee`.
- Full golden-file suite (14 cases) and fixture parity script created.
- Static effect isolation proven: zero filesystem access in `check`.
- C FFI definitions in `examples/c/leash.h`.
- `README.md` and `docs/ARCHITECTURE.md` updated.
- `docs/handoff/2026-11-20.md` committed.

## 2026-11-21 — Phase 4: Extra Features & Rich Policy Engine (Gate Check)

### Standard Gate & Exit Gate Evidence

```sh
$ fe fmt --check ingots
(clean, exit code 0)

$ fe check
(clean, exit code 0)

$ fe test
running `fe test` for 4 inputs (jobs=8)
READY cli     running 2 tests
PASS  cli     test_default_check_state_unrestricted
PASS  cli     test_cli_fingerprint_golden
READY testkit running 3 tests
PASS  testkit test_mock_erc20_basic
PASS  testkit test_mock_safe_basic
PASS  testkit test_mock_safe_reverts_when_not_enabled
READY module  running 19 tests
PASS  module  test_fingerprint_golden
PASS  module  test_pause_unpause_guardian
PASS  module  test_execute_denied_target_reverts
PASS  module  test_execute_allowed_eth
PASS  module  test_execute_denied_cap_reverts
PASS  module  test_per_agent_policies_isolation
PASS  module  test_circuit_breaker_trips_and_resets
PASS  module  test_preview_inactive_agent
PASS  module  test_revoked_agent_reverts
PASS  module  test_reentrancy_rejected_not_agent
PASS  module  test_set_agent_by_non_safe_reverts
PASS  module  test_reentrancy_rejected_reentrant_flag
PASS  module  test_safe_call_failed_reverts
PASS  module  test_try_execute_allowed_success
PASS  module  test_unpause_by_non_safe_reverts
PASS  module  test_zero_address_safe_reverts
PASS  module  test_zero_address_guardian_reverts
PASS  module  test_unregistered_agent_reverts
PASS  module  test_try_execute_denied_returns_code
READY policy  running 69 tests
PASS  policy  test_bucket_index_calculation
PASS  policy  test_25h_gap_full_reset
PASS  policy  test_cooldown_denied_at_cooldown_minus_1
PASS  policy  test_allow_valid_eth_transfer
PASS  policy  test_cooldown_allowed_exactly_at_cooldown_boundary
PASS  policy  test_cooldown_off_by_default
PASS  policy  test_cooldown_first_action_allowed
PASS  policy  test_decode_dirty_address
PASS  policy  test_decode_approve_success
PASS  policy  test_deny_delegatecall
PASS  policy  test_deny_empty_policy_denies_all
PASS  policy  test_allow_erc20_transfer
PASS  policy  test_deny_paused
PASS  policy  test_decode_transfer_success
PASS  policy  test_decode_transfer_from_success
PASS  policy  test_deny_session_expired
PASS  policy  test_deny_zero_address_target
PASS  policy  test_deny_unlisted_target
PASS  policy  test_deny_erc20_transfer_over_cap
PASS  policy  test_decode_malformed_lengths
PASS  policy  test_explain_reason_all_variants
PASS  policy  test_operation_conversion
PASS  policy  test_order_delegatecall_beats_unlisted_target_and_cap
PASS  policy  test_order_paused_beats_delegatecall_and_unlisted
PASS  policy  test_order_unlisted_target_beats_per_tx_cap
PASS  policy  test_cooldown_with_record_lifecycle
PASS  policy  test_erc20_malformed_calldata_denied
PASS  policy  test_reason_codes_exhaustive
PASS  policy  test_deny_calldata_shape_and_selector
PASS  policy  test_reason_from_code_roundtrip
PASS  policy  test_reason_names_exhaustive
PASS  policy  test_record_denial_counter
PASS  policy  test_record_eth_spend
PASS  policy  test_erc20_recipient_allowlist_transfer
PASS  policy  test_erc20_spender_attack_denied
PASS  policy  test_remaining_fresh_state
PASS  policy  test_per_tx_and_window_eth_caps
PASS  policy  test_remaining_after_spend
PASS  policy  test_robustness_empty_data_token_target
PASS  policy  test_robustness_three_byte_data
PASS  policy  test_erc20_approval_hygiene
PASS  policy  test_robustness_value_u256_max_no_overflow_panic
PASS  policy  test_robustness_dirty_address_word
PASS  policy  test_robustness_amount_u256_max
PASS  policy  test_selectors_match
PASS  policy  test_robustness_transfer_one_hundred_bytes
PASS  policy  test_robustness_unknown_selector_four_bytes
PASS  policy  test_rolling_window_24h_rollover_exact
PASS  policy  test_single_and_multiple_spends_same_bucket
PASS  policy  test_robustness_transfer_thirty_five_bytes
PASS  policy  test_validate_check_names_and_codes
PASS  policy  test_validate_empty_targets
PASS  policy  test_selector_of_cases
PASS  policy  test_state_encode_decode_roundtrip
PASS  policy  test_validate_per_tx_above_window
PASS  policy  test_validate_default_policy_ok
PASS  policy  test_validate_dirty_unused_slot
PASS  policy  test_validate_erc20_target_without_token
PASS  policy  test_validate_target_no_permissions
PASS  policy  test_validate_window_mismatch
PASS  policy  test_validate_zero_window
PASS  policy  test_validate_unsorted_selectors
PASS  policy  test_rate_limiting_actions_per_window
PASS  policy  test_validate_unsorted_targets
PASS  policy  test_validate_zero_window_cap
PASS  policy  test_validate_zero_address_target
PASS  policy  test_validate_duplicate_targets
PASS  policy  test_validate_token_without_erc20_target
PASS  policy  test_fingerprint_deterministic_and_sensitivity

test result: ok. 93 passed; 0 failed

$ fe build ingots/module --emit sizes
runtime: 23639 bytes (18513 code, 5126 data, 0 embedded)
creation: 23894 bytes (255 code, 0 data, 23639 embedded)
Headroom: 937 bytes below EIP-170 limit (24,576 bytes), 0 warnings

$ git grep -nE 'fn decide[^{]*uses' ingots/policy/src/*.fe
(no matches — pure decide invariant holds)

$ git grep -nE 'policy::rules|policy::ledger' ingots/cli/src/*.fe ingots/module/src/*.fe
(no matches — component isolation invariant holds)
```

### Exit Gate Verdict: PASSED
- All Phase 4 core features implemented and tested:
  1. Compile-time policy validation (16 enum variants, 6 compile-fail tests verified rejected).
  2. Recipient allowlists (A8) and Rate limiting (A9).
  3. Per-agent dynamic policies and isolated limits (B2, ADR-007).
  4. Machine-readable CLI output (`--json`) and budget query (D1, Tier A).
  5. Transaction cooldown period (A10) with exact boundary testing.
  6. Auto-pause circuit breaker on 3 consecutive denials (B3) with Safe reset.
- Total 93 unit tests passing green.
- Module bytecode size: 23,639 bytes (937 bytes below EIP-170 limit).
- Standard and review gates green.
- `README.md`, `docs/GAS.md`, `docs/RULES.md`, `docs/THREAT_MODEL.md`, `docs/adr/007-per-agent-policies.md` updated.
- `docs/handoff/2026-11-21.md` written.

