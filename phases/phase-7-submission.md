# Phase 7 — Documentation and submission

| | |
|---|---|
| **Date** | Nov 24, 2026. **Submit by 18:00 UTC (23:30 IST)**, six hours before the 23:59 UTC deadline. |
| **Roadmap stage** | 8 — README, ADRs, E7 Fe findings, submission |
| **Depends on** | Phase 6 gate green |
| **Goal** | Submit with every checklist item from the submission map ([00-project-context.md §11](00-project-context.md)) ticked and linked. |
| **Skills** | addy documentation-and-adrs; `/graphify . --wiki` for the architecture section; mattpocock code-review (a **fresh-context** pass over the whole repo); superpowers finishing-a-development-branch. **Turn `/caveman` off for all writing.** |

Phase 7 only **assembles**. If a section needs new research, something went wrong earlier. Write the section with what exists and list the gap under Limitations.

---

## README.md structure (built from the starter's `SUBMISSION.md` template)

Keep every heading the template requires. Fill them in this order:

1. **Title + pitch + Fe-specific highlight** (exact sentences from context §1). Badges: CI, licence, Fe 26.6.0.
2. **Demo:** video link, the five Sepolia tx hashes (Etherscan links), dashboard screenshot, Sourcify link.
3. **Quick start:**
   ```sh
   # requires Fe 26.6.0 (feup --version v26.6.0), Node 20+, Foundry
   make setup && make all && make demo
   ```
   Include the exact Fe version line and the expected run time.
4. **Problem:** AI agents with wallets, and policy drift between on-chain and off-chain checks.
5. **Approach and architecture:** the diagram (from `docs/ARCHITECTURE.md`, optionally refreshed with `/graphify . --wiki`), the ingot table, the transaction path, the message/effects table.
6. **Policy:** the verbatim `leash explain` output, plus the feature table (shipped ✓ / roadmap stage).
7. **Why Fe** (each point links to the exact lines of code):
   - effects bound powers: the `decide` signature (no `uses`), `record` (`mut Ledger` only), the guardian `Pause` handler (`mut paused` only), `check` vs `replay` (`Fs`);
   - typed units: `Wei` / `Duration` / `Timestamp` + the compile-fail test;
   - one source for two targets: `fe test` and `fe test --backend native` on the same suite + the parity digest;
   - compile-time validation: `const fn validate` + `static_assert` + compile-fail tests (if shipped);
   - `#[error]` deny reasons with Solidity-compatible selectors;
   - C export (if shipped).
8. **Evidence:** test counts per backend (paste `scripts/count-tests.sh` output), the parity digest result + verdict distribution, the attack table with results, the gas and size numbers from `docs/GAS.md`, the claim → test map.
9. **Limitations and future work:** an honest list, including the hourly-bucket approximation, the ADR-004 breaker gap, anything cut in Phase 4, and stages 9–12 of the roadmap.
10. **Fe findings:** a summary of `docs/FE_FINDINGS.md` (bugs filed with links, missing std pieces, native-backend notes). Useful to the Fe team.
11. **Declaration:** starter repo (tag `starter`), Safe interfaces, any reused code, an AI-use summary linking `docs/ai-log.md`. Mirror `DECLARATION.md`.
12. **Licence:** Apache-2.0.

## Other docs to finish

- [ ] `DECLARATION.md` final (pre-existing work, reused code and interfaces, AI use with a count of AI-assisted changes from the log).
- [ ] `docs/adr/` — all ADRs have Status filled in.
- [ ] `docs/FE_FINDINGS.md` final (E7).
- [ ] `docs/ARCHITECTURE.md`, `docs/RULES.md`, `docs/THREAT_MODEL.md`, `docs/GAS.md` consistent with the code.
- [ ] `GLOSSARY.md` matches code names.

## Fresh-context review

- [ ] Run mattpocock **code-review** in a fresh session that has not seen the build. Fix only real defects (each with a failing test first) and documentation errors. Log the findings.
- [ ] Check every README link (relative links, video, Etherscan, Sourcify, CI badge).

---

## Submission steps

- [ ] **Fresh clone** on a clean machine or container (for example a `docker run` with only git, Fe 26.6.0, Node and Foundry). Run the Quick start **exactly as written**. Paste the output into the AI log. Fix the README, not the machine, if a step is missing.
- [ ] Confirm the licence, `fe.toml`, and the Fe version line.
- [ ] `git status --porcelain` empty. **Tag `v1.0.0-submission`**, push the tag, and copy the **full 40-character commit SHA** (`git rev-parse HEAD`).
- [ ] Confirm every commit is dated Nov 3–24 (`git log --format='%ad %h %s' --date=iso starter..HEAD`).
- [ ] **The human submits** through the private link: repo URL, SHA, pitch, highlight, demo link, declaration. The agent prepares a `docs/submission.md` with every field ready to paste.
- [ ] Check the automated-checks email. If anything fails, fix it, re-tag (`v1.0.1-submission`) and resubmit before 23:59 UTC. The latest valid submission counts.
- [ ] After submitting, **make no code changes** on the submitted branch. Answer any judge question within 48 hours. Post-contest work (stages 9–12) happens on a new branch `roadmap`.

---

## Exit gate

- [ ] The confirmation email says the automated checks passed.
- [ ] Every row of the submission criteria map has a working link in the README.
- [ ] The fresh-clone Quick start passed and its output is in the AI log.
- [ ] Final standard gate output pasted.
