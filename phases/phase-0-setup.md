# Phase 0 — Setup, registration, toolchain spikes

| | |
|---|---|
| **Date** | Nov 13, 2026 (one day) |
| **Roadmap stage** | 1 |
| **Depends on** | nothing |
| **Goal** | By the end of day 1 the project is registered, CI is green on both backends, and five 30-minute spikes prove that every risky Fe feature works before anything depends on it. |
| **Skills** | skill-creator (build `fe-26`), grill-with-docs (lock design decisions), addy `/constraints`, `/graphify`, karpathy rules in `AGENTS.md` |

---

## 0. Things only the human can do (agent: remind the user, do not fake these)

- [ ] **Register on the contest form** with name "Leash", the pitch sentence ([00-project-context.md §1](00-project-context.md)), team and contact email. Keep the confirmation email that has the **project ID** and the **private submission link**. Registration closes Nov 17, 23:59 UTC, but do it today.
- [ ] Create the public GitHub repository (for example `leash`) and give the agent push access.
- [ ] Decide the **guardian** address and the **Safe owner** key for the testnet demo (Phase 6). Never commit these.

The agent must list these items in its first handoff note and ask the user to confirm each one.

---

## 1. Toolchain

- [ ] Install Fe 26.6.0: `feup --version v26.6.0`. If `feup` is missing, install it first (see the Fe 26.6.0 release notes / `argotorg/fe` README).
- [ ] Confirm `fe --version` prints `26.6.0`. Paste the output into `docs/ai-log.md`.
- [ ] Install the demo tooling now, so Phase 6 does not stall: Node 20+ (with `pnpm` or `npm`) and Foundry (`anvil`, `cast`). Record their versions in `docs/ai-log.md`.

## 2. Repository from the starter

- [ ] Clone the official starter repo (its URL is on the contest page; do not guess it). Point `origin` at the user's new GitHub repo. Keep the starter's history.
- [ ] Tag the starter's last commit: `git tag starter <sha>` and push the tag. This proves what was pre-existing.
- [ ] Keep the starter's `LICENSE` (Apache-2.0). Do not change its licence.
- [ ] Keep the starter's `SUBMISSION.md` template. Phase 7 builds the README from it.
- [ ] Check that every new commit's date is inside Nov 3–24 (the system clock must be correct).

## 3. Workspace layout

- [ ] Convert `fe.toml` into a **workspace** with four ingots: `ingots/policy`, `ingots/module`, `ingots/cli`, `ingots/testkit`. Set `target = "native"` for `cli`. Read the starter's `fe.toml` and the Fe docs for the exact workspace syntax.
- [ ] Create every ingot with a minimal `src/lib.fe` (or `main.fe` for cli) that compiles. Wire dependencies: `module → policy`, `cli → policy`, `testkit → policy`.
- [ ] Create empty folders with a `.gitkeep`: `test/{policy,module,parity,attacks,cli/golden,compile_fail}`, `docs/{adr,handoff}`, `demo/`, `examples/c/`, `scripts/`.

## 4. Makefile

Targets (each must work on a clean clone):

| Target | Runs |
|---|---|
| `setup` | Checks `fe --version` equals 26.6.0 (fails with install instructions if not); `npm ci` in `demo/` once it exists |
| `fmt` | `fe fmt` |
| `check` | `fe fmt --check && fe check` |
| `test` | `fe test` |
| `test-native` | `fe test --backend native` |
| `build` | `fe build && fe build --backend native && fe build --emit sizes` |
| `golden` | CLI golden tests (Phase 3; a no-op until then) |
| `parity` | Parity tests (Phase 5; a no-op until then) |
| `demo` | Local Anvil demo (Phase 6; prints "not yet" until then) |
| `all` | `check test test-native build golden` (+ `parity` from Phase 5, + `demo` from Phase 6) |

## 5. CI

- [ ] Update `.github/workflows/ci.yml` to Fe **26.6.0** with the jobs `fmt`, `check`, `test-evm`, `test-native`, `build` (see [quality-gates.md](quality-gates.md)). The other jobs are added in later phases.
- [ ] Add the `rules` job now with the `decide`-has-no-`uses` grep. It passes trivially until `decide` exists. That is fine, because it guards from the first line.
- [ ] Add the CI badge to the README draft.

## 6. Project docs (skeletons today, kept current at every gate)

| File | Content now |
|---|---|
| `AGENTS.md` | The karpathy rules (think before coding, simplicity first, surgical changes, goal-driven execution) + **"every rule lives in `ingots/policy`"** + the invariants from [00-project-context.md §4](00-project-context.md) + "load these files at session start" + "end each session with handoff + ai-log" + "never guess a Fe API; read std source" |
| `CLAUDE.md` | One line: "Read AGENTS.md." (so every agent picks up the same rules) |
| `GLOSSARY.md` | Policy, Rule, Verdict, DenyReason, Ledger, Window, Bucket, Agent (session key), Guardian, Safe, Module, Fingerprint, Preview, Execute, TryExecute, Breaker, Guard, Session, Target, Selector, Recipient |
| `CONSTRAINTS.md` (addy `/constraints`) | Fe 26.6.0 only; contract runtime < 24,576 bytes; 100% Fe in policy/module/cli; no rule outside policy; `decide` is pure; deny codes append-only; all amounts typed; no secrets in repo; commits dated Nov 3–24 |
| `DECLARATION.md` | Headings: Pre-existing work (starter repo, tag `starter`), Reused code and interfaces (Safe `ModuleManager.execTransactionFromModule` interface, ERC-20 selectors, any std code copied), AI use (summary + link to `docs/ai-log.md`) |
| `docs/ai-log.md` | Format from [quality-gates.md](quality-gates.md). First entry today. |
| `docs/FE_FINDINGS.md` | Headings: Spikes, Bugs filed, Missing std pieces, Native-backend notes, Syntax surprises |
| `docs/ARCHITECTURE.md` | Copy of §3 of the context file (diagram + components + transaction path) |
| `docs/THREAT_MODEL.md` | Heading only (Phase 2 writes the first draft) |
| `docs/RULES.md` | The rule order from context §6 (Phase 1 fills in details) |
| `README.md` | Title, pitch, highlight, "Fe 26.6.0", CI badge, "Work in progress" |

## 7. The `fe-26` custom skill (the biggest quality lever)

Build it with **skill-creator**, store it in `.claude/skills/fe-26/`, and commit it. It must contain:

- [ ] A **Fe 26.6 syntax cheat sheet**, each item with a tiny verified example that passes `fe check`: `msg` / `recv` blocks, `uses (…)` effects, `with (…)` providers, `var` vs `let`, `own` / `ref` / `mut`, `#[test]`, `#[test(should_revert, selector = …)]`, `#[error]`, `#[cfg(target = "native")]`, `sol("…")` selectors, `const fn` + `static_assert`, generics with const params (`Window<const N: usize>`), `StorageMap`, `match` on enums with data, typed units `Wei` / `Duration` / `Timestamp`, `core::hash` keccak, `core::text` (`parse_uint`, `decode_hex`), `UFixed::parse`, `format!`, native `main` with `Args`.
- [ ] **The exact commands:** `fe check`, `fe fmt --check`, `fe test`, `fe test --backend native`, `fe build`, `fe build --backend native`, `fe build --emit sizes`, `fe build --emit metadata`, `fe build --backend native --emit staticlib`.
- [ ] **26.5 → 26.6 breaking changes:** non-Copy `DynString`, lossless `as`, native `main` uses `Args`. Read the 26.6.0 release notes and add anything else they list.
- [ ] The rule: **"When unsure about an API, read `ingots/std` source or the graphify map before guessing. Run `fe check` after every edit."**
- [ ] Links: Fe docs, `argotorg/fe` at `v26.6.0`, Zulip office hours.

Every example in the skill must be copied from code that compiled in this repo (the spikes are a good source). Do not include anything unverified.

## 8. Knowledge graph

- [ ] Clone `argotorg/fe` at tag `v26.6.0` **outside** the repo (for example `../fe-src`) and run `/graphify` on its `ingots/std` (or wherever std lives). Write the map location into the `fe-26` skill.
- [ ] Record in `docs/FE_FINDINGS.md` where the std APIs used by Leash live (units, hash, text, Args/Stdout/Fs effects, evm call, storage map).

## 9. Design grilling → ADRs

Run one **grill-with-docs** session (the user answers, the agent records) and write:

- [ ] `docs/adr/001-module-not-guard.md` — The agent is a module, not a Safe owner. Guards only see owner transactions; a module gives the agent its own entry point and keeps owners in full control (they can disable the module).
- [ ] `docs/adr/002-hourly-bucket-window.md` — Content from context §7, including the 2× worst-case approximation.
- [ ] `docs/adr/003-default-deny.md`
- [ ] Record any open question the grilling raised in `docs/handoff/` and ask the user.

---

## 10. Spikes (30 minutes each; write each result into `docs/FE_FINDINGS.md`)

Put each spike in `spikes/NN-name/` (excluded from the workspace build, or deleted after the result is recorded — your choice; keep the finding).

| # | Spike | Pass condition | Needed by |
|---|---|---|---|
| 1 | One function in `policy` called from an EVM test **and** a native test | Same result on both; both `fe test` and `fe test --backend native` pass | Everything (parity claim) |
| 2 | A contract making an external call to another address, in the shape module → Safe: `execTransactionFromModule(address,uint256,bytes,uint8) returns (bool)` | A test contract receives the call with the right args; the return bool is read | Phase 2 |
| 3 | Native `main` with `uses (args: Args, out: mut Stdout)` decoding a hex argument with `decode_hex` | `out/…` binary prints the decoded byte length; bad hex gives exit code 1 | Phase 3 |
| 4 | `core::hash` Keccak-256 of the same bytes on both targets | Equal output; also equal to `cast keccak` for the same bytes | Fingerprint, parity digest |
| 5 | An `#[error]` struct reverting with its selector, checked by `#[test(should_revert, selector = …)]` | Selector equals `cast sig "Name()"` | Phase 2 typed errors |

Extra checks worth 10 minutes each if time allows (they reduce risk later): (6) `Window<const N: usize>` generic struct compiles on both backends; (7) `StorageMap<Address, Struct>` in a contract; (8) can `fe test` set `block.timestamp`? (decides how Phase 5 parity runs on EVM); (9) can a test print to stdout on the EVM backend? (decides the parity digest reporting).

### Fallbacks

- **Spike 1 or 4 fails:** keep native parity for `decide` only, and compute the fingerprint off-chain in the CLI. Say so in README Limitations. File an issue.
- **Any spike fails:** file a GitHub issue on `argotorg/fe` with a minimal example, ask in Zulip office hours, write the fallback in `docs/FE_FINDINGS.md`, and continue.
- **Spike 8 fails (no time control in `fe test`):** Phase 5 runs the EVM side of parity through a test harness contract that calls `policy::decide/record` with an explicit `now` (still EVM-compiled policy code). Write this down now.

---

## Exit gate

- [ ] `make all` passes locally, and the GitHub Actions run is green on **both** backends (link the run in the AI log).
- [ ] All five spikes pass, **or** each failing one has a filed issue, a Zulip question and a written fallback.
- [ ] Registration confirmation email received (the user confirms).
- [ ] `fe-26` skill committed; graphify map exists; ADR-001..003 committed.
- [ ] Standard + review gate output pasted into `docs/ai-log.md`.
- [ ] Handoff note written; commit `chore: phase 0 complete`.

## Deliverables checklist

`fe.toml` (workspace), `ingots/*` skeletons, `Makefile`, `.github/workflows/ci.yml`, `AGENTS.md`, `CLAUDE.md`, `GLOSSARY.md`, `CONSTRAINTS.md`, `DECLARATION.md`, `README.md` (draft), `docs/{ai-log,FE_FINDINGS,ARCHITECTURE,THREAT_MODEL,RULES}.md`, `docs/adr/001..003`, `.claude/skills/fe-26/`, tag `starter`.
