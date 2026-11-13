# AGENTS.md — Leash Engineering Guidelines

## 1. Core Principles (Karpathy Rules)
1. **Think Before Coding**: Clarify the contract, understand data flow, review types, and verify the Fe std implementation before typing.
2. **Simplicity First**: Write the smallest correct implementation. No speculative abstractions, no premature optimizations, no boilerplate bloat.
3. **Surgical Changes**: Make changes minimal and focused. Every commit should be single-purpose and green.
4. **Goal-Driven Execution**: TDD first. Write a failing test, see it fail on both backends (`fe test` and `fe test --backend native`), write minimal code to pass, format, check, and commit.

---

## 2. The Core Architecture Rule
- **Every policy rule lives in `ingots/policy`**.
- The `module` (EVM) and `cli` (native) ingots only provide effects, storage, and I/O.
- If you find yourself writing an `if` condition deciding allow or deny anywhere outside `ingots/policy`, **stop and move it into policy**.
- `policy::decide` must have **no `uses` clause** — it is pure and deterministic.
- Only `policy::record` (and `record_denial` for breaker) may mutate spending state.

---

## 3. Project Invariants
1. `decide` has no `uses` clause.
2. Only `record` writes ledger state.
3. No file under `ingots/cli/` or `ingots/module/` contains rule logic. They only import the public API of `policy`.
4. **Default deny**: anything not explicitly allowlisted is denied. No match arm returns `Allow` as a fall-through.
5. A denied transaction never changes the ledger. `decide` never panics or reverts on any input (malformed calldata produces `Deny(MalformedCalldata)`).
6. Checks-effects-interactions: `record` runs before any external call to the Safe in `LeashModule`.
7. The guardian can only pause — never unpause, raise limits, or add agents.
8. Deny codes are append-only. Codes are never renumbered or reused.
9. All token and ETH amounts are strictly typed.

---

## 4. How to Start Every Session
1. Load `AGENTS.md`, `GLOSSARY.md`, `CONSTRAINTS.md`.
2. Load the `fe-26` skill from `.claude/skills/fe-26/`.
3. Read `phases/00-project-context.md` (the shared contracts).
4. Read the current phase file from `phases/`.
5. Read `phases/quality-gates.md`, the latest file in `docs/handoff/`, and the tail of `docs/ai-log.md`.
6. Confirm the current phase and state the 3–5 line plan.

---

## 5. How to Work
1. **Never guess a Fe API**: Fe 26.6.0 is new. Before using any std feature, read the `ingots/std` source of argotorg/fe v26.6.0 (reference clone) or the graphify map. <!-- check-docs: ignore -->
2. Run `fe check` after every small change.
3. Follow TDD: red on both backends -> green on both -> `fe fmt` -> `fe check` -> commit.
4. Respect timeboxes and document fallbacks in `docs/FE_FINDINGS.md`.

---

## 6. How to End Every Session
1. Run the standard gate commands and paste the raw output into `docs/ai-log.md`.
2. Add one line per AI-assisted change to `docs/ai-log.md`.
3. Write a handoff note in `docs/handoff/`, named by date (for example `2026-11-13.md`).
4. Commit all changes (working tree must be clean) and push.
