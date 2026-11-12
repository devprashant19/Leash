# Leash — Build Phases (agent playbook)

This folder turns *"Leash — Phase-wise Build Plan (Fe Builders Challenge).docx"* into step-by-step instructions a coding agent can carry out from an empty folder to a submitted contest entry, and then on through the full open-source roadmap.

**Leash in one sentence:** Leash gives AI agents a Safe wallet with spending limits written once in Fe. The same code enforces them on-chain and pre-checks them off-chain, so the two can never drift.

---

## How the agent must use this folder

1. **Work through the files in order.** Do not start a phase while the previous phase's exit gate is red.
2. **At the start of every session, load:**
   - `AGENTS.md`, `GLOSSARY.md`, `CONSTRAINTS.md` (created in Phase 0)
   - the `fe-26` skill (`.claude/skills/fe-26/`, created in Phase 0)
   - [00-project-context.md](00-project-context.md) (the shared contracts: types, codes, encodings)
   - the phase file you are working on
   - [quality-gates.md](quality-gates.md)
3. **At the end of every session:**
   - add one line per AI-assisted change to `docs/ai-log.md` (needed for the AI-use declaration),
   - write a handoff note (`docs/handoff/YYYY-MM-DD.md`: what is done, what is next, what is blocked),
   - commit.
4. **A phase is done only when** the standard gate and that phase's exit gate both pass, **and their command output is pasted** into `docs/ai-log.md`. A description of the output does not count.
5. **Fe syntax warning.** Code in these files is a *sketch*. Fe 26.6 is new and models know little about it. Before writing any Fe API call you are unsure about, read the `ingots/std` source from `argotorg/fe` at tag `v26.6.0` (or the graphify map built in Phase 0). Never guess an API. Run `fe check` after every small change.
6. **The architecture rule:** every policy rule lives in `ingots/policy`. The module and the CLI only supply effects and I/O. If you are about to write an `if` that decides allow or deny anywhere outside `ingots/policy`, stop and move it into policy.

---

## File index

| File | Covers | Dates (2026, UTC) | Roadmap stage |
|---|---|---|---|
| [MASTER_PROMPT.md](MASTER_PROMPT.md) | The prompt to paste into the coding agent at the start of every session | — | — |
| [00-project-context.md](00-project-context.md) | Shared reference: features, architecture, types, deny codes, encodings, ADRs, submission map | — | — |
| [quality-gates.md](quality-gates.md) | Standard gate, review gate, CI enforcement, the evidence format | every phase | all |
| [phase-0-setup.md](phase-0-setup.md) | Registration, toolchain, workspace, CI, skills, 5 spikes | Nov 13 | 1 |
| [phase-1-policy-core.md](phase-1-policy-core.md) | Pure `policy` ingot: types, rules A1–A7 and A12, ledger, fingerprint | Nov 14–16 | 2 |
| [phase-2-module.md](phase-2-module.md) | `LeashModule` contract, mock Safe and ERC-20, kill switch, session keys, errors and events | Nov 17–18 | 3 |
| [phase-3-cli.md](phase-3-cli.md) | Native `leash` CLI (check/explain/fingerprint/replay), golden tests, C static library | Nov 19–20 | 4 |
| [phase-4-extra-features.md](phase-4-extra-features.md) | Compile-time validation, A8–A11, per-agent policies, `--json`, B3, B4, D4, Could items | Nov 21 | 5 |
| [phase-5-verification.md](phase-5-verification.md) | Parity suite (10,000 tx), property tests, attack suite, gas/size report. **Feature freeze** | Nov 22 | 6 |
| [phase-6-demo.md](phase-6-demo.md) | Anvil `make demo`, Sepolia deploy, dashboard, Sourcify, video | Nov 23 | 7 |
| [phase-7-submission.md](phase-7-submission.md) | README, docs, clean-clone check, tag, submit | Nov 24 (submit by 18:00 UTC) | 8 |
| [stage-09-defi-guards.md](stage-09-defi-guards.md) | C1 ERC-20 hardening, C5 `ActionGuard` trait, C2 Uniswap guard | after submission | 9 |
| [stage-10-override-escalation.md](stage-10-override-escalation.md) | B5 owner co-signed override, B6 escalation queue | after submission | 10 |
| [stage-11-aave-usd.md](stage-11-aave-usd.md) | C3 Aave guard, C4 USD caps via Chainlink | after submission | 11 |
| [stage-12-tooling-audit.md](stage-12-tooling-audit.md) | D6 `serve --stdio`, D8 wasm simulator, D9 leash skill, E5 multi-chain, audit, release | after submission | 12 |

### Contest-critical vs roadmap

- **Phases 0–7 (stages 1–8)** are what the judges score. Only the commit submitted by **Nov 24, 23:59 UTC** counts.
- **Stages 9–12** complete the product. Pull a stage forward **only** if every gate up to Phase 5 is green and there is time left before the freeze (Nov 22, 23:59 UTC). Otherwise build them after the submission. Do not push any code to the submitted tag after submitting.

---

## Hard dates

| Milestone | UTC | IST |
|---|---|---|
| Registration closes (register on **Nov 13** anyway) | Nov 17, 23:59 | Nov 18, 05:29 |
| Feature freeze (tag `v0.1.0-freeze`) | Nov 22, 23:59 | Nov 23, 05:29 |
| Target submission time | Nov 24, 18:00 | Nov 24, 23:30 |
| Submission closes | Nov 24, 23:59 | Nov 25, 05:29 |
| Results (target) | Dec 1 | Dec 1 |

Only work dated **Nov 3–24** is judged. Every commit must fall inside that window, and the starter commit is tagged `starter`.

**Toolchain pin:** Fe **26.6.0** (any release from 26.5.0 is allowed by the rules, but this project pins 26.6.0). Put the exact version in the README and in CI.

---

## Scope rule (anti-scope-creep)

- **Must** features are required for a credible entry. **Should** features are planned. **Could** features happen only if a phase finishes early.
- Every feature in a phase file has a **timebox**. When the timebox runs out: stop, commit what is green, move the rest to "Limitations / Future work" in the README and to the matching roadmap stage, and continue.
- Never weaken a test to make a gate pass. If a test is wrong, fix the test and say why in `docs/ai-log.md`.
