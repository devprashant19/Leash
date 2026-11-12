# Phase 6 — Testnet deployment and demo

| | |
|---|---|
| **Date** | Nov 23, 2026 |
| **Roadmap stage** | 7 — E4 Sourcify verification, E6 dashboard (E5 multi-chain is optional here; see [stage 12](stage-12-tooling-audit.md)) |
| **Depends on** | `v0.1.0-freeze` tag (Phase 5) |
| **Goal** | A judge can reproduce the demo locally with **one command**, and can watch a 2-minute video of the same flow on Sepolia. |
| **Skills** | mattpocock wizard (interactive setup script for keys and RPC), design-taste-frontend for the dashboard page, addy `/ship` pre-launch checklist |

The code is frozen. This phase writes TypeScript under `demo/` (allowed: scripts and frontends need not be Fe) and fixes only bugs that a failing test proves.

---

## Secrets and safety (read first)

- Private keys and RPC URLs live in `demo/.env` (git-ignored). Commit `demo/.env.example` with placeholder names only: `SEPOLIA_RPC_URL`, `OWNER_PK`, `AGENT_PK`, `GUARDIAN_ADDRESS`.
- Use **fresh testnet-only keys**. Never ask the user to paste a mainnet key. The wizard script asks for values and writes `.env`; the agent never prints them.
- Before broadcasting anything to Sepolia, the agent shows the user what it will send (addresses, amounts) and waits for a yes.

---

## Shared demo code — `demo/`

```
demo/
├─ package.json            # viem, tsx, typescript; pinned versions
├─ lib/
│  ├─ artifacts.ts         # loads Fe build output (bytecode + ABI) from out/
│  ├─ safe.ts              # deploy/attach Safe, enableModule via owner-signed execTransaction
│  ├─ leash-cli.ts         # runs `out/leash check --json …` and parses the JSON
│  └─ scenario.ts          # the five transactions (shared by local and Sepolia)
├─ local.ts                # make demo: Anvil end to end
├─ deploy.ts               # Sepolia deploy
├─ agent.ts                # Sepolia scripted agent
├─ wizard.ts               # interactive .env setup
├─ run.json                # output of the last run (committed for Sepolia)
└─ dashboard/index.html    # static page reading run.json
```

### Safe on Anvil and Sepolia

- **Sepolia:** canonical Safe v1.4.1 deployments exist (SafeProxyFactory + Safe singleton). Get the addresses from the `@safe-global/safe-deployments` package (do not hard-code from memory). Create a 1-of-1 Safe with `OWNER_PK` as the owner, or reuse one from `.env`.
- **Anvil (local, no keys needed):** deploy the Safe singleton + proxy factory from the `@safe-global/safe-contracts` (or `safe-smart-account`) npm artifacts, then create a 1-of-1 Safe owned by Anvil account #0.
- **Enable the module:** an owner-signed `execTransaction` from the Safe to itself calling `enableModule(leashModule)`. With a 1-of-1 Safe where the owner sends the tx itself, the "pre-validated" signature form (`r = owner`, `s = 0`, `v = 1`) works. Verify against the Safe source before relying on it.
- **Set the agent:** an owner-signed `execTransaction` calling `LeashModule.SetAgent(agent, expiry, label[, policy_bytes])`. If per-agent policies shipped, use `leash encode examples/leash.toml` to produce `policy_bytes`, after replacing the placeholder token/treasury addresses with the deployed ones (generate `demo/leash.demo.toml`).
- **Fund:** send test ETH to the Safe; deploy `MockErc20` (the Fe testkit contract) as the demo token and mint to the Safe.

### The scenario — `demo/lib/scenario.ts` (five transactions)

| # | Agent proposes | CLI predicts | On-chain result |
|---|---|---|---|
| 1 | Send 0.05 ETH to the treasury | ALLOW | Executed; Safe balance −0.05 |
| 2 | Transfer 50 tokens to the exchange | ALLOW | Executed |
| 3 | Send 0.2 ETH to the treasury (over the 0.1 per-tx cap) | DENY `PerTxCapExceeded` | Denied on-chain too |
| 4 | Call an unlisted contract | DENY `TargetNotAllowed` | Denied on-chain too |
| 5 | `approve(exchange, MAX_UINT)` | DENY `UnlimitedApproval` | Denied on-chain too |

For each tx the agent script:

1. fetches `State { agent }` from the module and runs `leash check --json --state <hex> --now <block timestamp>` (the real prediction, using the agent's own on-chain state),
2. prints the prediction,
3. **sends it anyway in "rogue agent" mode** (otherwise denied txs would never reach the chain). It uses `TryExecute`, so the denial is a successful tx with a `Denied` event and a real hash. For tx 3 it **also** shows one `Execute` call reverting with the `PerTxCapExceeded()` selector (send with an explicit gas limit so viem does not refuse at simulation; capture the revert reason with `cast` or viem's error decoding),
4. reads the on-chain outcome (`Allowed`/`Denied` event + code, or the revert selector),
5. asserts **prediction == outcome**. A mismatch fails the script with a non-zero exit code,
6. appends `{ i, description, predicted, onchain, txHash, gasUsed }` to `run.json`.

`run.json` also stores `fingerprint_cli` (from `leash fingerprint --policy …`), `fingerprint_chain` (from `Fingerprint { agent }`), the remaining budget after each step, the network, the module address, the Safe address and the Fe version.

---

## Tasks

- [ ] **T1 — `demo/deploy.ts` (viem):** create or reuse a Sepolia Safe, deploy LeashModule (bytecode from `fe build` output; constructor args `safe, guardian[, timelock]`), enable it as a Safe module, set the agent, fund the Safe with test ETH and the mock token. Writes `demo/deployments/sepolia.json`.
- [ ] **T2 — `demo/agent.ts`:** the scripted agent proposes the five transactions. Before each send it runs `leash check --json`. Records hashes and verdicts in `demo/run.json`.
- [ ] **T3 — `make demo`** (`demo/local.ts`): the same five transactions on an **Anvil** node started by the script (and killed at the end), with no keys or RPC needed. Steps: `fe build` + native build → start anvil → deploy Safe contracts → deploy the module + token → enable → run the scenario → write `demo/run.local.json` → print a summary table → exit 0 only if all five predictions match. **It must finish in < 5 minutes on a clean clone.**
- [ ] **T4 — `demo/wizard.ts`** (mattpocock wizard): asks for the RPC URL, generates or accepts testnet keys, writes `.env`, prints the faucet links and the addresses to fund, and checks balances before deploying.
- [ ] **T5 — Dashboard** `demo/dashboard/index.html` (design-taste-frontend): one static page, no build step, reads `run.json` (or `run.local.json` via `?file=`). Shows:
  - a table of predicted vs on-chain verdicts with a ✓ per matching row, tx links to Sepolia Etherscan,
  - the policy fingerprint from both sides with a "match" badge,
  - a remaining-budget bar (ETH window and token window) after each step,
  - the `leash explain` text.
  It must work when opened from the file system and when served by `npx serve demo/dashboard`. It must be readable at phone width and in dark mode. Check it in a real browser. Take a screenshot for the README (`docs/img/dashboard.png`).
- [ ] **T6 — Sourcify verification (E4):** `fe build --emit metadata` and submit to Sourcify for Sepolia. Record the verification link in the README. If Sourcify does not accept Fe metadata yet, record the attempt and the error in FE_FINDINGS and publish the metadata + exact build command in the repo instead.
- [ ] **T7 — Sepolia run:** after the user approves, run `deploy.ts` then `agent.ts`. Commit `demo/run.json` and `demo/deployments/sepolia.json`. Add the five tx hashes to the README.
- [ ] **T8 — CI demo job:** install Node + Foundry, run `make demo`. Add `make demo` to `make all`.
- [ ] **T9 — Video (≤ 2 minutes; the human records it, the agent writes the script):** write `docs/video-script.md` with exact on-screen actions and narration per segment:
  - Problem (10 s): agents with wallets; off-chain checks drift from on-chain rules.
  - Policy file and `leash explain` (20 s).
  - Agent run with live CLI predictions (50 s): `agent.ts` output side by side with Etherscan.
  - Dashboard and matching fingerprints (25 s).
  - Code tour (15 s): the `decide` signature with no `uses`, and `record`'s `uses (ledger: mut Ledger)`; the guardian handler's effect list.
  Upload it (unlisted is fine) and link it in the README.
- [ ] **T10 — addy `/ship` pre-launch checklist** over the demo: secrets not committed, `.env.example` complete, README demo steps match the scripts, links work.

---

## Exit gate

- [ ] `make demo` runs end to end on a **clean clone** in under 5 minutes (time it; paste the output).
- [ ] All five Sepolia transactions behave exactly as the CLI predicted; hashes are listed in the README.
- [ ] The Sourcify verification link works (or the documented fallback is in place).
- [ ] Video uploaded (unlisted is fine) and linked.
- [ ] Dashboard screenshot in `docs/img/`; dashboard works offline from `run.json`.
- [ ] CI `demo` job green.
- [ ] Standard + review gate output pasted; handoff; commit `chore: phase 6 complete`.

## Fallbacks

- **Sepolia slips (faucet, RPC, Safe deployment issues):** the testnet deploy is optional under the rules. The Anvil `make demo` + mock-Safe tests carry the evidence. Record the video on Anvil with the dashboard, and say so in the README.
- **Safe deployment on Anvil is painful:** run Anvil as a fork of Sepolia (`anvil --fork-url $SEPOLIA_RPC_URL`), where the canonical Safe contracts exist. This needs an RPC URL, so keep the no-fork path as the goal and document which one `make demo` uses.
- **The video cannot be recorded in time:** an asciinema recording of `make demo` + a dashboard screenshot is the minimum.
