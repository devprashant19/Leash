# Phase 5 — Verification: parity, randomized and attack tests (FEATURE FREEZE)

| | |
|---|---|
| **Date** | Nov 22, 2026. **Feature freeze at 23:59 UTC (Nov 23, 05:29 IST).** |
| **Roadmap stage** | 6 — E1 parity suite, E2 attack suite, E3 gas and size report |
| **Depends on** | Phase 4 gate green |
| **Goal** | Hard evidence for the core claim: the on-chain module and the off-chain checker agree on every verdict. Plus an attack suite a security judge would expect. |
| **Skills** | superpowers dispatching-parallel-agents (one agent writes attacks, one reviews them **blind**), addy doubt-driven-development, `/ponytail-audit` (whole repo), superpowers verification-before-completion |

No new features today. Only tests, fixes found by tests, docs and the gas report.

---

## Layer 1 — Parity test (E1, the headline evidence)

### Generator — `ingots/testkit/src/gen.fe`

- [ ] **SplitMix64 PRNG** written in Fe (pure integer arithmetic with wrapping ops, so both backends produce the identical stream). The seed is a constant `PARITY_SEED = 0x4C45415348` ("LEASH").
- [ ] `gen_tx(rng, policy, prev_now) -> Tx` makes a mix of allowed and denied cases on purpose:
  - `to`: 70% a listed target, 20% an unlisted random address, 10% the zero address
  - `op`: 92% Call, 8% DelegateCall
  - `data`: for ERC-20 targets, 60% valid `transfer`/`approve`/`transferFrom` with amounts drawn around the caps (`cap−1`, `cap`, `cap+1`, `0`, `MAX_UINT`, random); 15% unlisted selector; 10% truncated; 5% extra bytes; 10% empty
  - recipients: 80% listed, 20% attacker
  - `value`: around `max_per_tx` (`cap−1`, `cap`, `cap+1`, `0`, random small)
  - `now`: `prev_now + rand(0 .. 2 h)`, sometimes `+25 h` (window reset), sometimes exactly a bucket boundary
- [ ] The sequence is **stateful**: each tx goes through `decide`, and on Allow through `record` (so windows, the rate limit, the cooldown and the breaker are all exercised).

### Digest

```
digest_0 = 0x00…00
digest_i = keccak256( digest_{i-1} || u32_be(i) || u8(verdict_code_i) )
```

### Two runners, one golden value

| Runner | Backend | How |
|---|---|---|
| `test/parity/native.fe` | native | loop 10,000 × (`gen_tx` → `policy::decide` → `record` on Allow) → digest |
| `test/parity/evm.fe` | EVM | Deploy `LeashModule` + `MockSafe` (+ MockErc20), loop through `TryExecute` with the module's real storage → digest. **If `fe test` cannot set `block.timestamp`** (Phase 0 spike 8), use a test harness contract `ParityHarness` that holds the ledger in storage and calls `policy::decide/record` with explicit `now`. That is still EVM-compiled policy code; say which runner was used in the README. |

- [ ] Both runners assert that their digest equals `PARITY_GOLDEN_DIGEST` committed in `test/parity/golden.fe`. The value is produced once by the native runner and **then checked by the EVM runner independently**, so the EVM run proves agreement.
- [ ] **Gas/time limits:** if 10,000 EVM iterations exceed `fe test` gas or time limits, split into 10 chunks of 1,000 (`chunk k` uses seed `PARITY_SEED + k`, fresh state), give each chunk its own golden digest, and combine: `final = keccak(d_0 || … || d_9)`. Both backends must produce the same 10 chunk digests.
- [ ] Both runners also print the digest (if printing works on the backend) and the counts per verdict code. Put the distribution in the README: it must show plenty of allows **and** every reachable deny code. If a code never appears, adjust the generator weights.
- [ ] CI job `parity` runs both on every push to `main` and fails if either differs from the golden value.
- [ ] **Mutation check (do once, by hand):** change one comparison in `rules.fe` (for example `>` to `>=` in the per-tx cap), run parity, confirm the golden digest check **fails** on both backends, then revert. Paste the evidence into the AI log. This proves the parity test has teeth.

## Layer 2 — Property tests (`test/policy/properties.fe`, both backends)

Each property runs over ≥ 500 random sequences from the generator (different seeds):

- [ ] **Window safety:** across any sequence, the ETH spent in the hourly-bucket window never exceeds `max_per_window` (checked after every `record`). Same for each token window and the action count.
- [ ] **Denied → no change:** for every denied tx, `encode_state` before and after is identical (`record` is not called; assert this holds even if someone calls `record_denial`, which may only change `denials`/`tripped`).
- [ ] **Determinism:** `decide(tx, p, s)` twice gives the same verdict.
- [ ] **Monotonic strictness:** if `is_stricter_or_equal(p_old, p_new)`, then any tx allowed under `p_new` is allowed under `p_old` (same state). (Only if B4 shipped.)
- [ ] **Encoding round-trip:** `decode_state(encode_state(s)) == s`; `decode_policy(encode_policy(p)) == p` for random valid policies.

## Layer 3 — Attack suite (E2) — `test/attacks/`, one file per attack

Write the attacks with one agent, then have a **second agent review them blind** (it gets only the threat model and the test files, not the implementation) and try to find a missing or weak test. Log both passes.

| File | Attack | Expected result |
|---|---|---|
| `01_multisend_delegatecall.fe` | Delegatecall to MultiSend to bundle many transfers | Denied: `DelegateCallBlocked` |
| `02_split_transfers.fe` | Split a large transfer into many small ones | Denied after the window cap (`WindowCapExceeded` / `TokenCapExceeded`) |
| `03_unlimited_approve.fe` | Unlimited approve, then transferFrom | Denied: `UnlimitedApproval` |
| `04_attacker_spender.fe` | Approve to an attacker spender | Denied: `RecipientNotAllowed` |
| `05_malformed_calldata.fe` | Truncated, extra bytes, dirty address word, wrong length | Denied (`MalformedCalldata`), no panic, on both backends |
| `06_reentrancy.fe` | Re-entrant target calling `Execute` again | Second call denied or reverts; ledger correct |
| `07_expired_key.fe` | Expired or rotated agent key | Denied: `SessionExpired` / `NotAgent()` |
| `08_guardian_escalation.fe` | Guardian tries to raise limits, add an agent, unpause | Reverts (`NotSafe()`) |
| `09_window_rollover.fe` | Spend at the window rollover second | Exactly the cap allowed, not double (context §7 definition) |
| `10_unlisted_token.fe` | Value sent via `transferFrom` on a token not in the list | Denied: `TargetNotAllowed` |
| `11_safe_call_fails.fe` | Target reverts inside the Safe | `SafeCallFailed()`; ledger rolled back |
| `12_breaker_evasion.fe` (if B3 shipped) | Many denials through `TryExecute` | Breaker trips at K; documented gap for `Execute` |
| `13_timelock_bypass.fe` (if B4 shipped) | Raise limits, then revoke + re-add the same agent | Raise still queued |
| `14_unknown_operation.fe` | `operation = 2` | Denied |
| `15_value_overflow.fe` | `value = MAX_UINT`, amount = `MAX_UINT` | Denied, no overflow |

Policy-level attacks run on both backends; module-level attacks on EVM.

## Gas and size report (E3) — `docs/GAS.md`

- [ ] `fe build --emit sizes` output: module runtime and init sizes, the margin to 24,576 bytes.
- [ ] Gas per path (from `fe test` gas reporting if available; otherwise from the Phase 6 Anvil run with `cast receipt`): an allowed ETH transfer, an allowed ERC-20 transfer, each deny path (reverting), Preview, Pause.
- [ ] Gas per rule: measure `decide` on a harness with only that rule active vs a baseline. Present it as a table ("which abstractions are free?"). Typed units and enums should cost nothing extra; say so if the numbers show it.
- [ ] The Zodiac Roles comparison is [stage 12](stage-12-tooling-audit.md) unless there is spare time today.

## Whole-repo audit

- [ ] `/ponytail-audit` over the whole repo. **"Must fix" list must be empty.** "Should fix" items are fixed or written into README Limitations.
- [ ] addy doubt-driven-development pass over `ingots/module` and `ingots/policy/src/rules.fe`: for each claim in the README draft ("only allowed calls reach the Safe", "decide is pure", "guardian can only pause"), find the test that proves it. Write the claim → test mapping into `docs/THREAT_MODEL.md`.
- [ ] Update THREAT_MODEL to final form.

## Fe compiler findings

- [ ] Any Fe compiler bug found is filed upstream with a minimal example and linked in `docs/FE_FINDINGS.md` (issue URL, workaround, status).

---

## Exit gate

- [ ] Parity digests match in CI on 10,000 cases (both backends equal the golden digest). The mutation check was done and failed as expected.
- [ ] All property and attack tests pass on both backends where applicable.
- [ ] `/ponytail-audit` "must fix" list is empty; "should fix" items are fixed or documented.
- [ ] `docs/GAS.md` complete; THREAT_MODEL final; claim → test map written.
- [ ] Any Fe compiler bug found is filed upstream and linked in `docs/FE_FINDINGS.md`.
- [ ] Standard + review gate output pasted.
- [ ] `git status --porcelain` empty → **tag `v0.1.0-freeze`** and push the tag. **No new features after this tag.** Phases 6–7 may change only: `demo/`, `docs/`, `README.md`, `DECLARATION.md`, `Makefile` demo targets, CI demo job, and bug fixes proven by a failing test (each logged).

## Fallbacks

- **EVM parity is too slow even in chunks:** run 10 × 1,000 on EVM and 10,000 on native, and show the EVM chunk digests matching the first 10,000 native txs split the same way. State the numbers honestly in the README.
- **A real policy bug is found today:** fix it (that is the point of this phase), add the failing test first, regenerate the golden digest **with a written reason**, and rerun the full suite.
