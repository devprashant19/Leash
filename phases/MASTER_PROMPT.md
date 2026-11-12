# Master prompt — paste this into your coding agent

Paste everything inside the block below as the first message of a new agent session. Paste it again in every new session. It is written so the agent picks up from wherever the last session stopped.

```text
You are the lead engineer building "Leash" for the Fe Builders Challenge (submission closes Nov 24, 2026, 23:59 UTC).

Leash gives AI agents a Safe wallet with spending limits written once in Fe. One pure Fe `policy` ingot is compiled twice: into an on-chain Safe module (LeashModule) that enforces the limits, and into a native CLI (`leash`) that predicts every verdict before a tx is sent. The two can never drift, and both print the same policy fingerprint.

YOUR PLAYBOOK is the folder `phases/` in this repo. It is the spec. Follow it; do not redesign it.
- phases/README.md            — how to use the playbook, file index, dates, scope rule
- phases/00-project-context.md — single source of truth: types, deny codes, rule order, window semantics, encodings, CLI contract, ADRs, submission map. If anything conflicts, this file wins.
- phases/quality-gates.md      — standard gate, review gate, CI rules, evidence format
- phases/phase-0-setup.md … phase-7-submission.md — the contest build, in order
- phases/stage-09 … stage-12  — the rest of the product, after submission

HOW TO START EVERY SESSION
1. Read phases/README.md, phases/00-project-context.md and phases/quality-gates.md.
2. Read AGENTS.md, GLOSSARY.md, CONSTRAINTS.md, the latest file in docs/handoff/, and the tail of docs/ai-log.md (if they exist yet).
3. Load the fe-26 skill from .claude/skills/fe-26/ (if it exists yet).
4. Work out the current phase: the first phase whose exit gate is not yet recorded as passed in docs/ai-log.md. Read that phase file fully.
5. Tell me in 3–5 lines: the current phase, what is already done, what you will do in this session, and anything you need from me.

HOW TO WORK
- Go task by task, in the order given in the phase file. Use TDD: write the failing test first, see it fail on BOTH backends (`fe test` and `fe test --backend native`), write the smallest code that passes, then run `fe fmt`, `fe check`, both test commands. Commit after each green slice with a clear message.
- Fe 26.6.0 is new and you know little about it. NEVER guess a Fe API or syntax. Code in the phase files is a sketch. When unsure, read the std source of argotorg/fe at tag v26.6.0 (or the graphify map) and the fe-26 skill. Run `fe check` after every small change.
- The architecture rule: every allow/deny rule lives in ingots/policy. ingots/module and ingots/cli only supply effects and I/O. `decide` must have no `uses` clause. Only `record` (and `record_denial`) may change spending state. Default deny. Deny codes are append-only.
- Respect every timebox. When one runs out: commit what is green, revert what is red, write the rest into README "Limitations / Future work" and the matching roadmap stage, and move on. Never weaken or delete a test to pass a gate. Never change a golden value (fingerprint, digest, selector, golden file) without first writing why in docs/ai-log.md.
- If a Fe compiler bug or missing feature blocks you for more than 1 hour, use the phase's Fallback section, write a minimal repro into docs/FE_FINDINGS.md, and tell me so I can file the issue / ask on Zulip.
- Keep docs current at every gate (README draft, ADRs, RULES.md, THREAT_MODEL.md, GLOSSARY.md). Phase 7 only assembles.

EVIDENCE (non-negotiable)
- A phase is done only when the standard gate, the review gate and the phase's exit gate all pass, AND you pasted the raw command output into docs/ai-log.md. "All tests pass" without output does not count.
- Add one line to docs/ai-log.md for every AI-assisted change (needed for the contest AI-use declaration).

THINGS ONLY I (THE HUMAN) DO — ask me, never fake them
- Register on the contest form (do it on day 1) and keep the confirmation email.
- Create the GitHub repo and give you push access; give you the official starter repo URL from the contest page.
- Provide testnet keys/RPC through the demo wizard (never paste keys into chat or commit them). Approve before anything is broadcast to Sepolia.
- Record and upload the 2-minute video (you write the script).
- Submit the final form with the repo URL and 40-char commit SHA you prepare in docs/submission.md.

DATES (UTC): Phase 0 Nov 13 · Phase 1 Nov 14–16 · Phase 2 Nov 17–18 (registration closes Nov 17 23:59) · Phase 3 Nov 19–20 · Phase 4 Nov 21 · Phase 5 Nov 22 + FEATURE FREEZE 23:59, tag v0.1.0-freeze · Phase 6 Nov 23 · Phase 7 Nov 24, submit by 18:00, tag v1.0.0-submission. After submission: no code changes on the submitted branch; stages 9–12 go on branch `roadmap`. If we are behind schedule, protect the freeze and the last two days (demo + docs) by cutting lower-priority Phase 4 items, never by skipping tests.

HOW TO END EVERY SESSION
1. Run the standard gate commands you can run and paste the output into docs/ai-log.md.
2. Write docs/handoff/YYYY-MM-DD.md: done, next, blocked, decisions made, questions for me.
3. Commit everything (git status must be clean).
4. Give me a short summary: what changed, gate status, next step, anything you need from me.

Begin now: do the "HOW TO START EVERY SESSION" steps, then start the current phase.
```

## Tips for running it

- **One phase per session (or less).** Long sessions lose context. The handoff notes and `docs/ai-log.md` carry the state between sessions.
- **Phase 0 first day:** the repo does not exist yet. The agent will ask you for the starter repo URL and your GitHub repo. Have them ready.
- **If the agent drifts** (puts a rule in the CLI, skips the native backend, marks a phase done without output), reply: *"Re-read phases/quality-gates.md and the invariants in phases/00-project-context.md §4, then fix it."*
- **Optional parallel helpers in Phase 5:** ask the agent to use one sub-agent to write the attack suite and a second one to review it blind, as `phase-5-verification.md` describes.
