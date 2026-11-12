# Phase 1 — Policy core ingot

| | |
|---|---|
| **Dates** | Nov 14–16, 2026 (3 days) |
| **Roadmap stage** | 2 — features A1–A7, A12 |
| **Depends on** | Phase 0 gate green (spikes 1 and 4 especially) |
| **Goal** | A pure `policy` ingot where `decide` returns the right `Verdict` for every rule, proven by the **same** test suite on the EVM and native backends. |
| **Skills** | superpowers writing-plans → test-driven-development (one failing test per rule first), domain-modeling (keep `GLOSSARY.md` names in code), `/caveman` during long test loops, superpowers requesting-code-review at the end |

Reference: types, deny codes, rule order, window and encoding rules are in [00-project-context.md](00-project-context.md) §5–§8. Follow them exactly.

---

## Working method (TDD, one slice at a time)

For every task below:

1. Write the failing test(s) in `test/policy/<rule>.fe` (shared suite, so it runs on both backends).
2. Run `fe test` and `fe test --backend native`. Both must fail for the expected reason.
3. Write the smallest code that makes it pass.
4. Run `fe fmt`, `fe check`, `fe test`, `fe test --backend native`.
5. Commit: `feat(policy): <rule> + tests`. Add one AI-log line.

Use `writing-plans` first to turn the task list into a numbered plan in `docs/plans/phase-1.md`, then run it with `executing-plans`.

---

## Module layout inside `ingots/policy/src/`

| File | Contents | Effects |
|---|---|---|
| `lib.fe` | Public API re-exports only: `Tx`, `Operation`, `Policy`, `TargetRule`, `TokenRule`, `TargetKind`, `Verdict`, `DenyReason`, `AgentState`, `Window`, `Ledger`, `decide`, `record`, `fingerprint`, `encode_policy`, `encode_state`, `decode_state`, `reason_code`, `reason_name`, `explain_reason`, `DEFAULT_POLICY`, selector constants | — |
| `types.fe` | All types, `MAX_*` constants, `TokenAmount` newtype | none |
| `decode.fe` | Calldata helpers: `selector_of(data)`, `decode_erc20(data) -> Erc20Call` (`Transfer{to,amount}`, `Approve{spender,amount}`, `TransferFrom{from,to,amount}`, `Unknown`, `Malformed`) | none |
| `rules.fe` | One small pure function per rule, each returning `Option<DenyReason>` (or the Fe equivalent), plus `decide` which calls them in rule order | none |
| `ledger.fe` | `Window<const N: usize>` with `spent(now)`, `would_exceed(now, amount, cap)`, `add(now, amount)`; `Ledger` effect target; `record` | `record`: `mut Ledger` only |
| `fingerprint.fe` / `encoding.fe` | `encode_policy`, `fingerprint`, `encode_state`, `decode_state` | none |
| `config.fe` | `DEFAULT_POLICY` constant used by tests, the module (Phase 2) and the CLI (Phase 3) | none |

Rule helpers in `rules.fe` are **private**. Only `decide` and `record` are public. This is what the CI "no rule logic outside policy" check relies on.

---

## Tasks

### T1 — Types (2–3 h)

- [ ] `Operation { Call, DelegateCall }` with conversion from the ABI `u8` (0 → Call, 1 → DelegateCall, anything else → treated as invalid, which `decide` denies as `DelegateCallBlocked`. Unknown operations must never be allowed).
- [ ] `Tx`, `Verdict`, `DenyReason` (codes 1–10 from context §6 now; later codes are appended in later phases). Write `reason_code(r) -> u8` and `reason_name(r) -> String` with an **exhaustive** `match`, so adding a variant breaks the build until it is mapped.
- [ ] `Policy`, `TargetRule`, `TokenRule`, `TargetKind` with the fixed-capacity sorted arrays from context §5.
- [ ] `AgentState` with `paused`, `expiry`, `eth_window`, `token_windows` (present now, used for per-token windows in Phase 4), and the other fields as zero/unused placeholders, or add them in Phase 4. Pick one approach and note it in `docs/RULES.md`.
- [ ] Typed units everywhere: `Wei` for ETH, `Duration` for windows/cooldowns, `Timestamp` for `now`/`expiry`, `TokenAmount` (your newtype) for ERC-20 amounts. **Add a compile-fail test** in `test/compile_fail/units_mixing.fe` showing that `Wei + Duration` (or comparing `Wei` with `TokenAmount`) does not compile. The test runner for compile-fail cases is a script `scripts/compile-fail.sh` that runs `fe check` on each file and expects failure.
- [ ] Selector constants via `sol("…")`: `SEL_TRANSFER = sol("transfer(address,uint256)")`, `SEL_APPROVE = sol("approve(address,uint256)")`, `SEL_TRANSFER_FROM = sol("transferFrom(address,address,uint256)")`. Test that they equal `0xa9059cbb`, `0x095ea7b3`, `0x23b872dd`.
- [ ] `DEFAULT_POLICY` in `config.fe`, for example: targets = { demo ERC-20 token (kind Erc20, selectors transfer/approve/transferFrom), a treasury EOA (allow_eth_transfer) }; `max_per_tx = 0.1 ETH`; `max_per_window = 0.5 ETH`; `window = 24 h`; token cap per tx = 100 tokens (18 decimals), `max_approve = 100 tokens`. Addresses are placeholders that Phase 6 replaces through `leash.toml` / `SetAgent` (Phase 4) or by rebuilding. Note this in the handoff.
- [ ] Fixtures in `ingots/testkit/src/fixtures.fe`: `policy_basic()`, `addr_token()`, `addr_treasury()`, `addr_attacker()`, `t0()` (a fixed Timestamp, e.g. 1_763_000_000), calldata builders `erc20_transfer(to, amt)`, `erc20_approve(sp, amt)`, `erc20_transfer_from(f, t, amt)`.

### T2 — Rule 1: block `DelegateCall` (A2) (0.5 h)

Any `op == DelegateCall` → `Deny(DelegateCallBlocked)`, unless the target's `delegate_ok == true` (false by default and in `DEFAULT_POLICY`). Use an exhaustive `match` on `Operation`.

### T3 — Rule 2: target allowlist, default deny (A1) (1 h)

`to` not in `policy.targets[0..n_targets]` → `Deny(TargetNotAllowed)`. The zero address is never allowed (even if it were listed, `validate` in Phase 4 rejects it; for now, test that an unlisted zero address is denied). An empty policy (`n_targets = 0`) denies everything.

### T4 — Rule 3: selector allowlist per target + calldata shape (A3) (1.5 h)

- `data.len() == 0`: a plain ETH transfer. Allowed only if the target has `allow_eth_transfer`; otherwise `SelectorNotAllowed`.
- `1 ≤ data.len() < 4` → `Deny(MalformedCalldata)`.
- The 4-byte selector is not in that target's `selectors` → `Deny(SelectorNotAllowed)`.
- Never index past the end of `data`. Write `selector_of` so it returns an option/flag instead of panicking.

### T5 — Rule 4: per-transaction ETH cap (A4) (0.5 h)

`tx.value > policy.max_per_tx` → `Deny(PerTxCapExceeded)`. The comparison is only between `Wei` values.

### T6 — Rule 5: rolling-window ETH cap with hourly buckets (A5) (3 h)

- Implement `Window<const N: usize>` exactly as described in context §7 (it is reused for tokens, rate limits and the breaker in Phase 4).
- `state.eth_window.spent(now) + tx.value > policy.max_per_window` → `Deny(WindowCapExceeded)`. Use checked addition. On overflow, deny instead of wrapping.
- `record` adds `tx.value` to the current bucket.
- Handle the rollover boundary exactly as the context file specifies. A 25-hour gap resets everything.

### T7 — Rule 6: ERC-20 calldata decode + per-token per-tx cap (A6, C1 basics) (3 h)

- Only for targets with `kind == Erc20`: decode `transfer(address,uint256)`, `approve(address,uint256)`, `transferFrom(address,address,uint256)`.
- ABI rules: each argument is a 32-byte word. An address word must have 12 zero high bytes; otherwise → `MalformedCalldata`. `data.len()` must be exactly `4 + 32·nargs`. Shorter → `MalformedCalldata`. **Longer → `MalformedCalldata` too** (strict; this blocks "extra bytes" tricks. Document it in RULES.md).
- Token rule lookup: the target must have a `TokenRule`. If it does not, there is no token cap configured → `Deny(TokenCapExceeded)` (default deny; document it).
- `transfer` / `transferFrom` amount `> max_per_tx` → `Deny(TokenCapExceeded)`.
- Use the decoder from std if it exists (the plan says "ABI decoding in std"; look in std for an ABI decoder before writing one by hand. If you write it by hand, record why in `FE_FINDINGS.md`).

### T8 — Rule 7: approval hygiene (A7) (1 h)

- `approve(spender, 0)` is **always allowed** (revoke), even if the caps are 0.
- `approve(spender, type(uint256).max)` → `Deny(UnlimitedApproval)`.
- `approve(spender, amount > max_approve)` → `Deny(UnlimitedApproval)`. (Both cases use the approval-hygiene reason. Write this choice into RULES.md.)

### T9 — Rule order (A12) (1 h)

- [ ] `decide` calls the rule helpers in the order from context §6. **The first failure wins.**
- [ ] Write `docs/RULES.md`: one section per rule with its inputs, deny reason, code, edge cases, and why it sits at that point in the order.
- [ ] **Order-dependence test:** build a tx that breaks three rules at once (for example DelegateCall + unlisted target + value over the cap) and assert that the reason is the earliest in the order (`DelegateCallBlocked`). Add two more such combination tests.

### T10 — `record` (1.5 h)

- [ ] `pub fn record(tx: Tx, policy: Policy) uses (ledger: mut Ledger)` — adds `tx.value` to the ETH window. Phase 4 adds the token windows, action counter and last-action time.
- [ ] `record` must only be called after `decide` returned `Allow`. Document this as a precondition. Add a property-style test: for a sequence of txs where each is `decide`d and `record`ed on Allow, total spent in any window ≤ `max_per_window`.
- [ ] Confirm in a test that `decide` has no `uses` clause (the CI grep). Also run the grep locally.
- [ ] How `Ledger` is provided: on native and in tests it is a plain in-memory struct provided with `with (…)`; in the module (Phase 2) it is backed by contract storage. Check the std patterns for providing an effect from storage. **If storage-backed effects are awkward, `record` may instead be `fn record(tx, policy, state: AgentState) -> AgentState` (pure, returns the new state) and the module writes it back.** Pick one, write `docs/adr/005-policy-representation.md` (also covering fixed-capacity arrays), and keep the "only record changes spending state" rule either way.

### T11 — Malformed input never panics (1 h)

- [ ] Tests: empty data on a token target, 3-byte data, 4-byte unknown selector, `transfer` with 35 bytes, `transfer` with 100 bytes, address word with a dirty high byte, amount = `u256::MAX`, value = `u256::MAX` (overflow in the window sum).
- [ ] Each must return a `Deny(...)` and never panic or revert, on both backends.

### T12 — Encoding and fingerprint (2 h)

- [ ] Implement `encode_policy` and `fingerprint` exactly as in context §8. Implement `encode_state` / `decode_state` for `AgentState`.
- [ ] Test vectors: compute `fingerprint(DEFAULT_POLICY)` and pin it in `test/policy/fingerprint_vectors.fe`. Assert it on both backends. Cross-check one encoding by hand with `cast keccak` and paste the command into the AI log.
- [ ] `decode_state(encode_state(s)) == s` round-trip test.
- [ ] `explain_reason(reason, policy, state, tx) -> String` gives a plain-English message for each reason (used by the CLI `--json` in Phase 3/4). Keep the message text in policy only. If `String`/`format!` is native-only, put this function behind `#[cfg(target = "native")]` and note it.

---

## Tests required (each row runs on both backends)

| Rule | Allow case | Deny case | Edge case |
|---|---|---|---|
| DelegateCall | `Call` op passes | `DelegateCall` op | unknown op value 2 → denied |
| Target allowlist | listed target | unlisted target | zero address; empty policy denies all |
| Selector allowlist | listed selector | unlisted selector | calldata < 4 bytes → `MalformedCalldata`; empty data with/without `allow_eth_transfer` |
| Per-tx cap | value = cap | value = cap + 1 wei | value 0 |
| Window cap | spend up to cap (several txs) | cap + 1 wei | spend at the exact window rollover (context §7); 25-hour gap resets |
| Token cap | transfer = cap; transferFrom = cap | transfer = cap + 1 | malformed amount word; extra trailing bytes; token with no `TokenRule` |
| Unlimited approval | approve = cap | approve max uint; approve cap + 1 | approve 0 (revoke) is allowed |
| Rule order | — | 3 multi-violation txs | — |
| Determinism | same input twice → same verdict | — | — |
| Fingerprint | pinned vector equal on both backends | — | changing any field changes the hash (test 3 fields) |

**Coverage rule:** every `DenyReason` variant that exists so far has at least one deny test **and** one allow test of the same rule.

---

## Exit gate

- [ ] `fe fmt --check`, `fe check`, `fe test`, `fe test --backend native` all pass. **Both backends report the same test count** (`scripts/count-tests.sh`).
- [ ] Every `DenyReason` variant has at least one deny test and one allow test.
- [ ] `decide` has no `uses` clause (CI grep job is green).
- [ ] Compile-fail test for unit mixing passes (`scripts/compile-fail.sh`).
- [ ] Fingerprint vector pinned and equal on both backends.
- [ ] `docs/RULES.md` and ADR-005 written; `GLOSSARY.md` matches code names.
- [ ] Code review (superpowers requesting-code-review) finds no critical issues; findings logged in `docs/ai-log.md`.
- [ ] Standard + review gate output pasted; handoff note; commit `chore: phase 1 complete`.

## Fallbacks

- **`Window<const N>` generics do not work on one backend:** write a concrete `Window24` struct now; record the gap in FE_FINDINGS and revisit.
- **`Bytes` / dynamic data is awkward on one backend:** use a bounded byte array (`[u8; MAX_CALLDATA]` + length, for example 4 + 32·8 = 260 bytes) in `Tx`. Calldata longer than the bound → `MalformedCalldata` (safe default deny).
- **Running behind by the end of Nov 15:** cut nothing from T1–T9 (they are Must). Shrink T12 to the fingerprint only and move `explain_reason` to Phase 3.
