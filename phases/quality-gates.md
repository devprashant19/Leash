# Quality gates (run after every phase and every stage)

A phase is **done** only when all three pass:

1. the **standard gate** below,
2. the **review gate** below,
3. that phase's own **exit gate** (in its phase file).

Paste the raw output of every gate command into `docs/ai-log.md` under a heading `## Gate — Phase N — <date>`. A summary such as "all tests pass" does not count. Paste the output itself (superpowers *verification-before-completion*).

---

## Standard gate

```sh
fe --version                      # must print 26.6.0
fe fmt --check
fe check
fe test                           # EVM backend
fe test --backend native          # native backend; same test count as EVM for shared suites
fe build
fe build --backend native
fe build --emit sizes             # LeashModule runtime size must stay < 24,576 bytes (EIP-170)
make demo                         # from Phase 6 on
git status --porcelain            # must be empty before tagging
```

`make all` must run every line above except `make demo` and `git status`. From Phase 6 on, `make all` also runs `make demo`.

### Test-count parity rule

Suites that are shared (everything in `test/policy/` and `test/parity/`) must report the **same number of passing tests** on EVM and native. Module tests are EVM-only and CLI golden tests are native-only, so put them in separate directories so the counts stay comparable. Add a script `scripts/count-tests.sh` that prints both counts and fails if the shared counts differ. CI runs it.

---

## Review gate

| Step | Skill | Pass condition | Phases |
|---|---|---|---|
| Verify claims with evidence | superpowers verification-before-completion | Command output pasted, not described | all |
| Code review | superpowers requesting-code-review (Phases 1–4), mattpocock code-review (Phase 7, fresh context) | No critical findings open; findings logged in `docs/ai-log.md` | 1–4, 7 |
| Simplicity | /ponytail-review (Phases 3–5), /ponytail-audit (Phase 5, 7) | No rule logic outside policy; no unused code | 3–5, 7 |
| Security | addy security-and-hardening, doubt-driven-development | `docs/THREAT_MODEL.md` updated; every fund-moving path has a test | 2, 5 |
| Rubric check | [00-project-context.md §11](00-project-context.md) | The phase adds at least one row of evidence to the README draft | all |
| Docs current | — | README draft, ADRs, `GLOSSARY.md` and `docs/RULES.md` reflect what was built | all |

---

## CI must enforce (`.github/workflows/ci.yml`)

Jobs (all on Fe 26.6.0, installed with `feup --version v26.6.0`; cache the toolchain):

1. `fmt` — `fe fmt --check`
2. `check` — `fe check`
3. `test-evm` — `fe test`
4. `test-native` — `fe test --backend native`
5. `build` — `fe build`, `fe build --backend native`, `fe build --emit sizes`; fail if the module runtime size is ≥ 24,576 bytes or the build prints warnings
6. `rules` — grep checks:
   - `decide` has no `uses` clause. Example: fail if `grep -nE 'fn decide[^{]*uses' ingots/policy/src/*.fe` matches. Make the regex robust to multi-line signatures, or use a tiny script that reads the signature up to `{`.
   - No rule logic outside policy: fail if files under `ingots/cli/` or `ingots/module/` import anything from `policy::rules`, `policy::decode` or `policy::ledger` internals. Only the public `policy::` API (re-exported from `lib.fe`) is allowed. Keep an explicit allowlist of public names in `scripts/policy-api.txt`.
   - Test-count parity (`scripts/count-tests.sh`).
7. `parity` (from Phase 5) — runs the 10,000-tx parity tests on both backends and asserts that both digests equal the committed golden digest. Runs on every push to `main`.
8. `golden` (from Phase 3) — CLI golden tests (stdout and exit code).
9. `demo` (from Phase 6) — `make demo` on Anvil (Node + Foundry installed in CI).

The README CI badge points at this workflow.

---

## Evidence format for `docs/ai-log.md`

```md
## 2026-11-14 — Phase 1 — Rule 4 (per-tx cap)
- AI-assisted: yes (Claude Code). Files: ingots/policy/src/rules.fe, test/policy/per_tx_cap.fe
- What: added PerTxCapExceeded check + 3 tests (cap, cap+1 wei, 0)
- Reviewed by human: yes/no

## Gate — Phase 1 — 2026-11-16
<paste of every standard-gate command and its output>
```

---

## Stop rules

- If a gate fails, fix it **before** starting new work. A red gate is never carried into the next phase.
- If a fix needs more than 1 hour and blocks the gate, use the phase's **fallback** section, document it, and continue.
- Never edit an expected value (golden file, digest, selector) just to make a test pass. First explain in the AI log why the old value was wrong.
