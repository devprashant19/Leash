# Phase 4 — Extra features

| | |
|---|---|
| **Date** | Nov 21, 2026 (one day; spill-over allowed only into the morning of Nov 22 if Phase 5 is not put at risk) |
| **Roadmap stage** | 5 — A8–A11, A6 token windows, B2 per-agent policies, B3, B4, D1 `--json`, D4, Tier-A explanations |
| **Depends on** | Phases 2 and 3 gates green |
| **Goal** | Add the features that raise the originality and usefulness scores, **in priority order, each timeboxed**. Anything unfinished moves to the extended roadmap (stages 9–12) and to README "Limitations / Future work". Nothing is silently dropped. |
| **Skills** | mattpocock improve-codebase-architecture first (a **30-minute survey before adding code**), superpowers TDD per feature, `/ponytail-review` after each feature |

## Rules for this phase

1. **Start with the 30-minute architecture survey** (improve-codebase-architecture). Write the result in `docs/handoff/` (what to tidy before adding, what is fragile). Fix only what blocks the features below.
2. **Work strictly in the order below.** Start each feature's timer. When the timebox ends: commit what is green, revert what is red, write the remainder into README "Limitations / Future work" and the roadmap, and move on.
3. Every feature: tests on **both backends** (policy rules) + module tests (if on-chain) + golden CLI cases (if visible in the CLI) + a line in `leash explain` + a row in the README feature table.
4. New deny codes are **appended** (context §6). New policy fields are **appended** to `Policy` and to the encoding (context §8). Update the pinned fingerprint vector **once per feature**, with a one-line reason in the AI log.
5. After every feature, rerun `fe build --emit sizes`. The module must stay < 24,576 bytes.

---

## Priority list

| Order | Feature | IDs | Timebox | Done when |
|---|---|---|---|---|
| 1 | Compile-time policy validation | (13) | 1.5 h | A deliberately bad policy in `test/compile_fail/` fails `fe check` with a clear message |
| 2 | Recipient allowlist + tx-count rate limit | A8, A9 | 1.5 h | Allow/deny/edge tests on both backends |
| 3 | Per-agent policies | B2 | 2 h | Two agents with different caps in one module test |
| 4 | Machine-readable CLI output + agent-friendly deny explanations | D1, Tier A | 1 h | Golden JSON tests |
| 5 | Cooldown between transactions | A10 | 0.5 h | Exactly-at-cooldown-end test |
| 6 | Per-token rolling windows | A6 | 1.5 h | Token window tests on both backends |
| 7 | Auto-pause circuit breaker | B3 | 1.5 h | K−1 denials stay live, K trips |
| 8 | Trading hours | A11 | 1 h | Boundary and weekend tests |
| 9 | Asymmetric limit changes | B4 | 2 h | Early apply reverts; cancel works |
| 10 | TOML policy files | D4 | 3 h | Valid, invalid and diff golden tests |
| 11 | *Could:* Escalation queue | B6 | 2 h | → otherwise [stage 10](stage-10-override-escalation.md) |
| 12 | *Could:* Uniswap `exactInputSingle` guard | C2 | 2 h | → otherwise [stage 9](stage-09-defi-guards.md) |

Realistically, items 1–4 are the target for the day, and items 5–10 are done only if time allows. Items not finished before the freeze (Nov 22, 23:59 UTC) are **not** in the submission.

---

## 1. Compile-time policy validation (1.5 h)

**Fe design:** `pub const fn validate(p: Policy) -> PolicyCheck` in `ingots/policy/src/validate.fe`, returning an enum (`Ok`, `ZeroWindow`, `WindowMismatch`, `EmptyTargets`, `UnsortedOrDuplicateTargets`, `ZeroAddressTarget`, `TargetWithNoPermissions`, `UnsortedOrDuplicateSelectors`, `PerTxAboveWindow`, `ZeroWindowCap`, `TokenRuleWithoutErc20Target`, `Erc20TargetWithoutTokenRule`, `DirtyUnusedSlot`, `UnsortedOrDuplicateRecipients`, `EmptyRecipientsWithErc20`, `InvalidSchedule`, …). Then:

```fe
// SKETCH
const _: () = static_assert(validate(DEFAULT_POLICY) == PolicyCheck::Ok, "DEFAULT_POLICY is invalid");
```

- [ ] The **same** `validate` runs at runtime: in the module (`SetAgent` with a policy → `InvalidPolicy()`) and in the CLI (`leash validate`). One function, three uses. This is a strong Fe talking point; say it in the README.
- [ ] `test/compile_fail/`: one file per bad case (zero window, empty allowlist, duplicate targets, per-tx cap above the window cap, zero address target). `scripts/compile-fail.sh` expects `fe check` to fail **and** greps for the message.
- [ ] Runtime tests: `validate` returns the right variant for each bad policy (both backends).
- **Fallback:** if `static_assert` cannot evaluate a `const fn` over a struct, assert the individual fields instead (`static_assert(DEFAULT_POLICY.window > 0)` …) and record the gap in FE_FINDINGS.

## 2. Recipient allowlist (A8) + rate limit (A9) (1.5 h)

**A8 — `RecipientNotAllowed` (code 11).**
- [ ] `Policy.recipients` (sorted, ≤ `MAX_RECIPIENTS`). For ERC-20 targets: `transfer.to`, `transferFrom.to` and `approve.spender` must be in `recipients`. **Exception:** `approve(spender, 0)` (revoke) is always allowed.
- [ ] ETH recipients: plain ETH transfers already require the target to be listed with `allow_eth_transfer` (A1/A3), which covers "ETH recipients must be listed".
- [ ] Order within the ERC-20 guard: recipient → approval hygiene → cap (context §6). So "approve max to an attacker" → `RecipientNotAllowed`.
- [ ] Update `DEFAULT_POLICY` and fixtures (treasury, exchange). Update earlier tests that now need a listed recipient. Do not delete them.
- [ ] Tests: listed recipient (allow), unlisted (deny), **spender attack** (approve to attacker → deny), **self-transfer** (the Safe is not in the list → deny, unless listed; document it).

**A9 — `RateLimited` (code 12).**
- [ ] `Policy.max_actions_per_window: u32` (0 = off). `AgentState.action_window: Window<24>` counts allowed actions. `record` adds 1.
- [ ] `count(now) + 1 > max` → `RateLimited`. Tests: N allowed, N+1 denied, allowed again after rollover.

## 3. Per-agent policies (B2) (2 h) — ADR-007

- [ ] `AgentConfig` gains `policy: Policy` (or an encoded policy + fingerprint, whichever stores best in Fe; check the size).
- [ ] `SetAgent { agent, expiry, label, policy_bytes }`: `policy::decode_policy` → `validate` → store. Invalid → `InvalidPolicy()`.
- [ ] `Execute` uses the caller's own policy. `Fingerprint { agent }` returns that agent's fingerprint. Add `PolicyOf { agent }` → encoded policy bytes (so the CLI can load the exact policy: `leash check --policy-hex 0x…`).
- [ ] Optional generic form `decide<P: PolicyLike>` (the docx mentions it). Only do it if it does not add complexity. A single concrete `Policy` is fine; note the choice in ADR-007.
- [ ] Ledger is per agent (already true from Phase 2).
- [ ] Tests: two agents with different caps in one module test (A may send 0.1, B only 0.01; B is denied at 0.05, A is allowed); different allowlists; a policy update keeps the ledger (see 9 for how loosening is delayed).
- [ ] **Remap rule:** if an agent's token list changes, the token windows are remapped by token address through a pure `policy::remap_state(old, new, state)`. Test it.

## 4. `leash check --json` + agent-friendly explanations (D1, Tier A) (1 h)

- [ ] Output schema exactly as in context §9. `remaining` comes from a pure `policy::remaining(policy, state, now) -> Budget`. `window_resets_at` = the time the oldest non-empty bucket expires.
- [ ] `message` from `policy::explain_reason` (plain English, includes numbers with units, for example "This would bring spending in the last 24 h to 0.55 ETH; the limit is 0.5 ETH. 0.02 ETH is still available until 14:00 UTC.").
- [ ] Golden JSON tests: one allow, one deny per reason reachable via the CLI. JSON key order is fixed (golden diff).
- [ ] Also add `--json` to `replay` (an array of row results + summary). Optional.

## 5. Cooldown (A10) (0.5 h)

- [ ] `Policy.cooldown: Duration` (0 = off), `AgentState.last_action: Timestamp` (0 = never). `now - last_action < cooldown` → `CooldownActive` (code 13). Uses typed `Timestamp - Timestamp -> Duration`.
- [ ] Tests: first action allowed; at `last + cooldown - 1` denied; **exactly at `last + cooldown` allowed**.

## 6. Per-token rolling windows (A6) (1.5 h)

- [ ] `TokenRule.max_per_window` + `AgentState.token_windows[i]` (the same `Window<24>` type, which is the reuse point for the Fe-generics story).
- [ ] `transfer` / `transferFrom` amounts count toward the window; approvals do not (they do not move funds; document it). Over → `TokenCapExceeded`.
- [ ] Tests: window cap, rollover, two tokens independent, each selector, malformed amount.

## 7. Auto-pause circuit breaker (B3) (1.5 h)

- [ ] `Policy.breaker_threshold: u32` (0 = off). `AgentState.denials: Window<24>`, `AgentState.tripped: bool`.
- [ ] `policy::record_denial(tx, policy) uses (ledger: mut Ledger)`: adds 1 to `denials`; if `count ≥ threshold`, set `tripped = true`. This lives in **policy**, so the rule "only policy writes state" holds.
- [ ] The module calls `record_denial` in **`TryExecute` only** (ADR-004: a reverting `Execute` cannot keep state). Emit `CircuitTripped(agent)`. `decide` returns `CircuitTripped` (code 15) when `tripped`.
- [ ] `ResetBreaker { agent }` — Safe only.
- [ ] Tests: K−1 denials keep the agent live, the K-th trips it, then even a valid tx is denied; reset restores it; denials outside the window do not count.
- [ ] THREAT_MODEL: say clearly that reverted `Execute` denials do not count, so a hostile agent can avoid the breaker by using `Execute`. It still cannot move funds, and it pays gas. Future work: count denials on `Execute` too by not reverting.

## 8. Trading hours (A11) (1 h)

- [ ] `Schedule { days_mask: u8 /* bit0 = Monday … bit6 = Sunday */, start_hour: u8, end_hour: u8 }`, UTC. All-open = `0x7F, 0, 24` (rule off).
- [ ] Weekday: `((now / 86400) + 3) % 7` with 0 = Monday (1970-01-01 was a Thursday). Hour: `(now % 86400) / 3600`. Allowed if the day bit is set and `start_hour ≤ hour < end_hour`.
- [ ] `validate`: `start_hour < end_hour ≤ 24`, `days_mask != 0`, `days_mask ≤ 0x7F`. No overnight ranges in v1 (document).
- [ ] Deny: `OutsideTradingHours` (code 14). Tests: the first and last allowed second, the first denied second, a weekend day, a Thursday known timestamp.

## 9. Asymmetric limit changes (B4) (2 h) — ADR-008

- [ ] `policy::is_stricter_or_equal(old: Policy, new: Policy) -> bool` (pure): each cap ≤ old, each allowlist a subset of old, cooldown ≥ old, schedule a subset, `delegate_ok` not newly enabled, threshold not loosened.
- [ ] Module: `SetPolicy { agent, policy_bytes }` (Safe only). Stricter or equal → applies at once. Otherwise store `PendingChange::Raise { new_policy, ready_at: now + TIMELOCK }` (`TIMELOCK` = 24 h, a constructor parameter so the local demo can use a short one).
- [ ] `ApplyPending { agent }` (anyone, after `ready_at`) → else `TimelockActive()`. `CancelPending { agent }` (Safe only).
- [ ] `PendingChange` is an enum state machine `{ None, Raise { new, ready_at } }`.
- [ ] Residual risk (THREAT_MODEL): adding a **brand-new** agent applies immediately (the Safe already holds full power). Re-adding a revoked address goes through the asymmetric path. Test both.
- [ ] Tests: lower applies instantly; raise queued; early apply reverts; apply after delay works; cancel works; a mixed change (one stricter, one looser field) counts as a raise.

## 10. TOML policy files (D4) (3 h) — ADR-009

- [ ] `leash.toml` format (example, commit it as `examples/leash.toml`):

```toml
version = 1
max_per_tx = "0.1 ETH"
max_per_window = "0.5 ETH"
window = "24h"
cooldown = "0s"
max_actions_per_window = 20
breaker_threshold = 5

[schedule]
days = ["mon", "tue", "wed", "thu", "fri"]
start_hour = 0
end_hour = 24

[[target]]
address = "0x…token"
kind = "erc20"
selectors = ["transfer(address,uint256)", "approve(address,uint256)", "transferFrom(address,address,uint256)"]

[[target]]
address = "0x…treasury"
allow_eth_transfer = true

[[token]]
address = "0x…token"
max_per_tx = "100"          # whole tokens …
decimals = 18               # … converted with decimals
max_per_window = "500"
max_approve = "100"

recipients = ["0x…treasury", "0x…exchange"]
```

- [ ] Parse with the **lutz** Fe ingot as a dependency of `cli` (native). If lutz does not build on 26.6, write a small TOML-subset parser for exactly this format in `cli` and record the finding. Parsing is I/O, so it is allowed in cli. **Validation is `policy::validate`.** Selectors in text are hashed with keccak at runtime (`policy::selector_from_signature`), and a test checks it equals `sol("…")`.
- [ ] Commands: `leash validate leash.toml`, `leash encode leash.toml` (hex for `SetAgent`/`SetPolicy`), `leash diff old.toml new.toml` (lists changed fields and says "stricter" or "looser (timelock applies)" using `is_stricter_or_equal`), plus `--policy leash.toml` on `check`/`explain`/`fingerprint`/`replay`.
- [ ] The fingerprint of `leash encode` output equals the module's `Fingerprint { agent }` after `SetAgent` (a test, through the shared encoding).
- [ ] Golden tests: valid, each invalid class, diff stricter, diff looser.

## 11–12. Could items

Only if items 1–10 are done and green with time left before the freeze. Build them from the full specs in [stage-10-override-escalation.md](stage-10-override-escalation.md) (B6) and [stage-09-defi-guards.md](stage-09-defi-guards.md) (C2).

---

## Exit gate

- [ ] All previous gates still green (**full regression on both backends**).
- [ ] Every shipped feature appears in `leash explain` output **and** in the README feature table.
- [ ] Cut features are listed honestly in README "Limitations / Future work", each with its roadmap stage.
- [ ] Contract size < 24,576 bytes; `docs/GAS.md` updated.
- [ ] `docs/RULES.md`, `GLOSSARY.md`, ADR-007/008/009 (for what shipped) and THREAT_MODEL updated.
- [ ] `/ponytail-review` after each feature: no rule logic outside policy.
- [ ] Standard + review gate output pasted; handoff; commit `chore: phase 4 complete`.

## Fallbacks

- **Contract size over the limit:** first lower `MAX_*` capacities (fewer storage slots and loops), then move rarely used admin features out (asymmetric changes, breaker). Record what was cut and why.
- **Storing a full `Policy` per agent is too expensive or awkward:** store `encode_policy` bytes + fingerprint and decode on each `Execute` (more gas, simpler storage), or keep one shared policy and per-agent caps only. Document the choice in ADR-007.
