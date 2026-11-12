# Stage 12 — Agent tooling, WASM simulator, leash skill, multi-chain, audit, release

| | |
|---|---|
| **When** | Last stage |
| **Depends on** | Stage 4 (Phase 3) and stage 9 |
| **Exit check** | External reviewer sign-off; published ingot release |
| **Skills** | skill-creator (leash skill), superpowers TDD, addy security-and-hardening, mattpocock code-review |

---

## D6 — Agent tool mode: `leash serve --stdio`

- [ ] Line-delimited JSON over stdin/stdout. Each request is one line; each response is one line with the same `id`.
  - `{"id":1,"method":"check","params":{"to":"0x…","value_wei":"…","data":"0x…","op":"call","now":1763…,"state":"0x…"}}` → the same object as `check --json` plus `id`.
  - `{"id":2,"method":"explain"}`, `{"id":3,"method":"fingerprint"}`, `{"id":4,"method":"record","params":{…}}` (updates an in-memory session state, so an agent can simulate a plan of several txs).
  - Bad JSON → `{"id":null,"error":{"code":1,"message":"…"}}`, and the server keeps running.
- [ ] A JSON parser in cli (I/O only; or a Fe JSON ingot if one exists). All verdicts still come from `policy::decide`.
- [ ] Scripted session test: a fixed input file → golden output file.
- [ ] Example: `examples/agent-tool/` showing how an LLM agent framework registers `leash serve --stdio` as a tool (a short TS or Python wrapper). Optional: an MCP server wrapper.

## D7 follow-up — Rust example

- [ ] `examples/rust/` links `libleash.a` through `extern "C"` and checks the same cases as the C example. `make example-rust`.

## D8 — Browser simulator (WASM, experimental)

- [ ] Build `policy` with the experimental `--backend wasm` (from a Fe source build; record the exact Fe commit used). Export a `check`-like function.
- [ ] `demo/simulator/index.html`: edit a tx (to, value, data, op) and see the verdict and the plain-English reason instantly, using the same policy code.
- [ ] Node test: load the wasm module and compare its verdicts against the golden CLI cases.
- [ ] If the wasm backend cannot build the policy ingot, write the finding in FE_FINDINGS and stop. It is experimental.

## D9 — Fe skills for agents

- [ ] Update `.claude/skills/fe-26/` with everything learned (verified snippets only).
- [ ] New `.claude/skills/leash/`: how to add a rule (policy only, TDD on both backends, append the deny code, update encoding/explain/RULES.md/parity generator), how to add an `ActionGuard`, how to run the gates, the invariants.
- [ ] Evaluate both skills with skill-creator's eval flow (a fresh agent adds a toy rule using only the skill; record the result).

## E5 — Multi-chain deploy

- [ ] Deploy the same module on **Sepolia and Base Sepolia** with the same policy → the **same fingerprint** on both (and the same address if deterministic CREATE2 helpers from `std::evm` are used; a salt per version).
- [ ] `demo/deploy.ts --network base-sepolia`; `run.json` per network; the dashboard shows both fingerprints.

## Gas comparison vs Zodiac Roles (from the extended backlog)

- [ ] Implement one equivalent rule (for example "ERC-20 transfer to listed recipients, amount ≤ cap") in the Zodiac Roles Modifier on Anvil, and compare gas for the same tx against LeashModule. Add the table to `docs/GAS.md` and answer "which abstractions are free?" plainly.

## Audit-style review and release

- [ ] Internal audit pass: addy security-and-hardening over the whole repo, mattpocock code-review in a fresh context, `/ponytail-audit`. Fix or document every finding.
- [ ] **External reviewer** (a human the user picks) reviews `ingots/policy` and `ingots/module` against `docs/THREAT_MODEL.md`. Record their sign-off and findings in `docs/audit/`.
- [ ] Publish the `policy` ingot as a reusable release (tag `policy-v1.0.0`, release notes, install instructions for other Fe projects).
- [ ] Final README refresh: feature table all ✓ or explicitly future work.

## Exit check

- [ ] External reviewer sign-off recorded.
- [ ] Published ingot release.
- [ ] All gates green on both backends; parity digest unchanged or regenerated with a reason.
