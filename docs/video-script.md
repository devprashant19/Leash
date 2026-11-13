# 2-Minute Demo Video Script: Leash — Safe Wallet Agent Spending Guard

**Target Duration:** 120 seconds (2:00)  
**Submission Category:** Fe Builders Challenge 2026 (Fe Language Contest)  
**Audio / Narration Format:** Voiceover with terminal and browser screen recording  

---

## Timeline & Scene Breakdown

### Scene 1: The Problem — Autonomous Agents & Drift (0:00 – 0:15)
- **Visual:** Terminal showing an autonomous LLM agent tool call loop proposing transactions directly to a multisig or wallet.
- **Narration:**  
  *"Autonomous AI agents need wallets to pay for compute, APIs, and on-chain interactions. But giving an LLM direct access to treasury keys is dangerous: prompt injection, hallucinated slippage, or compromised session keys can drain a Safe instantly. Worse, when spending guards are written in two languages—Python off-chain and Solidity on-chain—they inevitably drift."*

---

### Scene 2: The Solution — Write Once, Compile Twice (0:15 – 0:35)
- **Visual:** Split-screen showing `ingots/policy/src/rules.fe` and `leash explain` in terminal.
- **Narration:**  
  *"Leash solves this by writing the spending policy once in pure Fe. One pure `policy` ingot is compiled twice: into a gas-optimized Safe smart contract module that enforces limits on-chain, and into a native CLI that predicts every verdict before a transaction is broadcast. Both share the exact same Keccak-256 policy fingerprint. They can never drift."*

---

### Scene 3: Live Verification Run — 5-Transaction Canonical Scenario (0:35 – 1:25)
- **Visual:** Full-screen terminal running `make demo` (`npx tsx demo/local.ts`). The 5 transactions evaluate one by one, showing the real-time CLI prediction alongside the on-chain verdict.
- **Narration:**  
  *"Let's watch Leash in action with five real transactions.  
  Transaction one: The agent sends 0.05 ETH to an authorized treasury. The CLI predicts ALLOW, and the on-chain Safe module executes it cleanly.  
  Transaction two: The agent transfers 50 demo tokens. Predicted ALLOW, executed on-chain.  
  Transaction three: The rogue agent tries sending 0.2 ETH—exceeding its 0.1 ETH per-transaction cap. The CLI predicts DENY with code 7 (`PerTxCapExceeded`). The module rejects it atomically.  
  Transaction four: The agent attempts to call an unlisted contract. The CLI flags it as `TargetNotAllowed` (code 4), and the on-chain Safe module denies execution.  
  Transaction five: The agent attempts an unlimited approval of 2^256 - 1 tokens. The CLI catches `UnlimitedApproval` (code 10), and the on-chain module halts it before any allowance is set.  
  Notice: 5 out of 5 transactions achieve 100% parity with zero drift!"*

---

### Scene 4: The Live Verification Dashboard & Fingerprint Parity (1:25 – 1:45)
- **Visual:** Browser switching to `demo/dashboard/index.html`. Hover over the Cryptographic Fingerprint badge, show the matching hashes `0x3efcfc58...`, and scroll through the transaction table.
- **Narration:**  
  *"Our live verification dashboard loads the on-chain execution run. Look at the cryptographic policy fingerprint: `0x3efcfc58aec5...`. The native CLI and the on-chain module report the exact same 32-byte digest down to the last bit. The dashboard tracks the agent's 24-hour sliding hourly budget, per-tx headroom, and token allowance meters in real-time."*

---

### Scene 5: Architectural Walkthrough in Pure Fe (1:45 – 2:00)
- **Visual:** VS Code highlighting `ingots/policy/src/rules.fe` lines 229 (`pub fn decide(...) -> Verdict` with no `uses` clause), and `ingots/module/src/lib.fe` lines 341 (`if locked { revert_error(Reentrant {}) }`).
- **Narration:**  
  *"Under the hood, Leash uses Fe's effect system to prove safety at compile time. The core `decide` rule function declares no effects at all. Only the stateful module handles I/O and storage. The compiled Safe module sits comfortably under the 24-kilobyte EIP-170 limit with zero warnings. Leash: autonomous agents on a cryptographically enforced leash."*

---

## Recording Checklist for Human Submitter:
- [ ] Screen resolution set to 1080p (1920x1080).
- [ ] Terminal font: JetBrains Mono or Menlo, legible size.
- [ ] Open `demo/dashboard/index.html` in Chrome or Brave.
- [ ] Run `npm --prefix demo run demo` in terminal.
- [ ] Total recorded video length <= 120 seconds.
- [ ] Upload video to YouTube (unlisted or public) and paste URL into `docs/submission.md`.

