# Leash — Drift-Proof Safe Guardrails for AI Agents in Fe

[![CI](https://github.com/devprashant19/Leash/actions/workflows/ci.yml/badge.svg)](https://github.com/devprashant19/Leash/actions/workflows/ci.yml)
[![Fe Version](https://img.shields.io/badge/Fe-26.6.0-blue)](https://github.com/argotorg/fe/releases/tag/v26.6.0)
[![License](https://img.shields.io/badge/License-Apache_2.0-green.svg)](LICENSE)
[![Submission Tag](https://img.shields.io/badge/Tag-v1.0.0--submission-purple)](https://github.com/devprashant19/Leash/releases/tag/v1.0.0-submission)

> **Pitch:** Leash gives AI agents a Safe wallet with spending limits written once in Fe — the same code enforces them on-chain and pre-checks them off-chain, so the two can never drift.
>
> **Fe-Specific Highlight:** Every policy rule is an effect-checked function, so a reviewer can read from signatures alone which code can move funds, and the identical source builds for both the EVM and native targets.

---

## 1. Demo & Verification

- **Video script**: scene-by-scene script and timings in [`docs/video-script.md`](docs/video-script.md).
- **Interactive Visual Dashboard**: run `npx serve demo` and open `/dashboard/` (it reads `demo/run.json`), or open [`demo/dashboard/index.html`](demo/dashboard/index.html) directly to see the bundled run.
- **Contract build metadata**: [`demo/deployments/LeashModule.metadata.json`](demo/deployments/LeashModule.metadata.json) (from `fe build --emit metadata`).
- **Native CLI binaries**: [`cli-v0.1.0` release](https://github.com/devprashant19/Leash/releases/tag/cli-v0.1.0): `leash-linux-x86_64` and `leash-macos-arm64`, built and smoke-tested by [`.github/workflows/release.yml`](.github/workflows/release.yml).
- **Deploying (free tier)**: Sepolia contracts, dashboard hosting and CLI release, step by step in [`docs/deployment.md`](docs/deployment.md).
- **Full Submission Details**: [`docs/submission.md`](docs/submission.md).

### The 5-Transaction Canonical Scenario (Reproduce in 7 Seconds)

The automated demo launches an ephemeral local Anvil node, deploys `MockSafe`, `LeashModule`, and an ERC-20 token, registers an agent session key, and executes five canonical rogue agent transactions comparing off-chain CLI predictions against atomic on-chain execution:

| # | Proposed Transaction | CLI Prediction | On-Chain Result | Gas Used | Status |
|---|---|---|---|---|---|
| **1** | Agent sends 0.05 ETH to authorized treasury | `ALLOW` | `ALLOW` (Executed) | 281,928 | **✓ PASS** |
| **2** | Agent transfers 50 tokens to authorized recipient | `ALLOW` | `ALLOW` (Executed) | 206,414 | **✓ PASS** |
| **3** | Agent sends 0.2 ETH (exceeds 0.1 ETH per-tx cap) | `DENY (PerTxCapExceeded)` | `DENY (code 7)` | 177,148 | **✓ PASS** |
| **4** | Agent calls unlisted contract (malicious diversion) | `DENY (TargetNotAllowed)` | `DENY (code 4)` | 159,631 | **✓ PASS** |
| **5** | Agent calls `approve(exchange, 2^256 - 1)` unlimited drain | `DENY (UnlimitedApproval)` | `DENY (code 10)` | 186,105 | **✓ PASS** |

**Parity Verdict**: **5 / 5 Matched (100.0% Agreement, Zero Drift)**.  
**Prediction source**: in CI the predictions come from the real Fe-built `leash` binary (`out/cli`): the `demo` job builds it with `fe build --backend native` and runs with `LEASH_REQUIRE_NATIVE=1`, which fails the run if any prediction comes from anywhere else. The result is recorded as `"predictionSource": "fe-native"` in `demo/run.local.json`, which each CI run uploads as the `demo-run-fe-native` artifact. Fe links native binaries only on x86-64 Linux and AArch64 macOS, so on Windows the demo uses a TypeScript mirror of the rules and prints `Prediction source: ts-mirror`.  
**Cryptographic Policy Fingerprint**: `0x3efcfc58aec5d1e7e81b5bded7820ed3ed8a0e654cf4aff3bfb793a7494ae6ee` (identical on CLI and on-chain).

---

## 2. Quick Start

### Prerequisites
- **Fe Compiler**: `fe 26.6.0 (5b3f96a)` ([feup installation](https://github.com/argotorg/fe))
- **Node.js**: `v20+` or `v22+`
- **Foundry**: `anvil` and `cast` (v1.9.0+)

### One-Command Full Build & Demo
```sh
# Setup dependencies, run checks, execute all tests, and run local demo (< 15 seconds)
make setup && make all && make demo
```

### Individual Build & Test Commands
```sh
# 1. Format check
fe fmt --check ingots; fe fmt --check test

# 2. Type check entire workspace
fe check

# 3. Run all tests on EVM backend
fe test

# 4. Run tests on Native backend (Linux / macOS)
fe test --backend native

# 5. Build EVM smart contracts
fe build

# 6. Verify contract runtime size (< 24,576 bytes EIP-170 limit)
fe build ingots/module --emit sizes

# 7. Run the automated 5-tx local demo on Anvil
npm --prefix demo run demo
```

---

## 3. The Problem: AI Agents with Wallets & Policy Drift

Autonomous AI agents executing financial transactions need strict, non-bypassable guardrails. In existing architectures, two failure modes dominate:

1. **Monolithic On-Chain Guards**: Writing all rules only in Solidity contracts is gas-expensive and opaque to the agent's LLM planning loop. Agents repeatedly propose invalid transactions, wasting gas on execution reverts.
2. **Off-Chain Simulation Drift**: Writing off-chain prediction rules in Python or TypeScript inevitably drifts from on-chain contract logic over time as edge cases, rounding errors, and block semantics diverge. An agent believes a transaction is permitted, only for it to fail on-chain, or worse, relies on a filter that permits transactions that should be denied.

### The Leash Solution

**One pure Fe `policy` ingot is compiled to two targets:**
- An on-chain **Safe Module (`LeashModule`)** enforcing spending limits on EVM.
- A fast native **CLI (`leash`)** predicting every verdict before a transaction is broadcast.

Both share the exact same code, constants, and cryptographic fingerprint (`keccak256("LEASH_POLICY_V1" || enc(policy))`). They can **never drift**.

---

## 4. Architecture & Component Boundaries

```
                 1 check                          same decide
  ┌──────────┐ ─────────► ┌──────────────────┐ ──────────────┐
  │ AI agent │            │ leash CLI(native)│               ▼
  │ proposes │            │ check·explain·   │      ┌─────────────────────┐
  │   a tx   │            │ replay·fingerprint│     │    policy ingot     │
  └────┬─────┘            │ Args,Stdout,Fs   │      │ decide: no effects  │
       │ 2 execute        └──────────────────┘      │ record: mut Ledger  │
       ▼                                            │ same fingerprint    │
  ┌──────────────────────┐   same decide + record   └─────────────────────┘
  │ LeashModule (EVM)    │ ─────────────────────────────────▲
  │ Execute·Preview·Pause│
  │ Storage,Call,Log     │
  └────┬─────────────────┘
       │ 3 allowed calls only
       ▼
  ┌──────────────────────────┐
  │ Safe smart account       │
  │ execTransactionFromModule│
  └──────────────────────────┘
```

### Ingot Structure

| Ingot / Folder | Target | Responsibility | Allowed Effects | Source Code |
|---|---|---|---|---|
| `ingots/policy` | EVM + Native | Core types, pure `decide`, pure `record`, calldata decoding, policy encoding, fingerprint, policy validation | **None** for `decide`; `mut Ledger` only for `record` | [`ingots/policy/`](ingots/policy/src/) |
| `ingots/module` | EVM | `LeashModule`: agent session key management, owner administration, emergency kill-switch, Safe forwarding | Storage, Ctx, Call, Log | [`ingots/module/`](ingots/module/src/) |
| `ingots/cli` | Native | `leash check`, `explain`, `fingerprint`, `replay`, `validate` | Args, Stdout, Stderr, Fs, Exit | [`ingots/cli/`](ingots/cli/src/) |
| `ingots/testkit` | EVM + Native | `MockSafe`, `MockErc20`, seeded PRNG generator, shared fixtures | Test-only | [`ingots/testkit/`](ingots/testkit/src/) |
| `demo/` | Node/TS | Anvil runner, Sepolia deployment, setup wizard, interactive dashboard | Shell / Web | [`demo/`](demo/) |
| `docs/` | — | Architecture, threat model, ADRs, AI log, Fe findings, rules | Markdown | [`docs/`](docs/) |

### LeashModule Message Interface

| Message | Caller | Effects | Description |
|---|---|---|---|
| `Execute { to, value, data, operation }` | Active agent | `mut self.locked, mut self.ledgers, call: mut Call, log: mut Log` | Evaluates `policy::decide`. Reverts on denial with custom error. On allow, records spend and invokes `Safe.execTransactionFromModule`. |
| `TryExecute { to, value, data, operation }` | Active agent | `mut self.locked, mut self.ledgers, call: mut Call, log: mut Log` | Same as `Execute`, but on denial emits `Denied(agent, to, code)` and returns `(false, code)` without reverting. |
| `Preview { agent, to, value, data, operation }` | Anyone | Read-only | Returns `(code, remaining_eth_per_tx, remaining_eth_window)`. Zero state modifications. |
| `State { agent }` | Anyone | Read-only | Returns canonical encoded `AgentState` bytes for off-chain CLI prediction. |
| `Pause` | Safe or Guardian | `mut self.paused, log: mut Log` | Emergency kill-switch. Guardian cannot touch funds or agent registrations. |
| `Unpause` | Safe only | `mut self.paused, log: mut Log` | Resumes module operations. Callable strictly by Safe account. |
| `SetAgent { agent, expiry, label }` | Safe only | `mut self.agents, log: mut Log` | Authorizes or updates an agent session key. Expiry must be > block timestamp. |
| `RevokeAgent { agent }` | Safe only | `mut self.agents, log: mut Log` | Deactivates an agent session key immediately. |
| `SetGuardian { guardian }` | Safe only | `mut self.guardian, log: mut Log` | Rotates the emergency guardian address. |
| `Fingerprint` | Anyone | Read-only | Returns 32-byte Keccak-256 policy digest matching the native CLI. |

---

## 5. Policy Specification (`leash explain`)

Verbatim output of `leash explain`:
```text
Leash policy (fingerprint 0x3efcfc58aec5d1e7e81b5bded7820ed3ed8a0e654cf4aff3bfb793a7494ae6ee)
- The agent may call 2 contracts:
  - 0x1000000000000000000000000000000000000001 (ERC-20): transfer, approve, transferFrom
  - 0x2000000000000000000000000000000000000002: plain ETH transfers
- At most 0.1 ETH per transaction.
- At most 0.5 ETH in any rolling 24 hours (hourly buckets).
- Token 0x1000000000000000000000000000000000000001: at most 100 tokens per transfer; approvals up to 100 tokens; unlimited approvals are always refused.
- Delegatecall is always refused.
- Anything not listed above is refused.
```

### Shipped Guardrails Feature Table

| Feature | ID | Policy Rule | On-Chain Safe Module | Native CLI (`leash`) | Status |
|---|---|---|---|---|---|
| **Contract & ETH Allowlist** | A1 | `TargetNotAllowed` (4) | Yes (`Execute`/`TryExecute`) | Yes (`check`) | **Shipped** |
| **DelegateCall Protection** | A2 | `DelegateCallBlocked` (3) | Yes (atomic revert) | Yes (`check`) | **Shipped** |
| **Selector & Calldata Shape** | A3 | `SelectorNotAllowed` (5), `MalformedCalldata` (6) | Yes | Yes | **Shipped** |
| **Native ETH Per-Tx Cap** | A4 | `PerTxCapExceeded` (7) | Yes | Yes | **Shipped** |
| **Rolling 24h Window Cap** | A5 | `WindowCapExceeded` (8) | Yes (24 hourly buckets) | Yes (`--state`) | **Shipped** |
| **ERC-20 Per-Tx & Approval Hygiene**| A6/A7 | `TokenCapExceeded` (9), `UnlimitedApproval` (10) | Yes | Yes | **Shipped** |
| **Recipient Allowlist** | A8 | `RecipientNotAllowed` (11) | Yes | Yes | **Shipped** |
| **Tx-Count Rate Limiting** | A9 | `RateLimited` (12) | Yes | Yes | **Shipped** |
| **Transaction Cooldown** | A10 | `CooldownActive` (13) | Yes | Yes | **Shipped** |
| **Per-Agent Dynamic Limits** | B2 | `policy_for_agent` / `SetAgentPolicy` | Yes (`FingerprintOf`) | Yes | **Shipped** |
| **Auto-Pause Circuit Breaker** | B3 | `CircuitTripped` (15) | Yes (auto-trips on 3 denials) | Yes | **Shipped** |
| **Compile-time Policy Validation**| 13 | 16-variant `PolicyCheck` | Rejects invalid policies | `validate` | **Shipped** |
| **Machine-readable JSON Output** | D1 | Structured JSON verdict | N/A | `leash check --json` | **Shipped** |
| **C Static Header Export** | D7 | `leash.h` / `main.c` bindings | N/A | C FFI | **Shipped** |
| **Trading Hours Schedule** | A11 | `OutsideTradingHours` (14) | Roadmap | Roadmap | Stage 9 |
| **Asymmetric Timelock** | B4 | 24h limit increase queue | Yes (`LeashQueue`) | Yes (`--timelock`) | **Shipped** (Stage 10) |
| **Owner Co-signed Overrides** | B5 | EIP-712 structured bypass | Yes (`ExecuteWithOverride`) | Yes (`--override`) | **Shipped** (Stage 10) |
| **Uniswap MEV & Slippage** | C1/C2 | Sandwich protection (`amountOutMin > 0`) | Yes (`SwapNotAllowed`) | Yes | **Shipped** (Stage 11) |
| **Aave Lending Guard** | C3 | Collateral diversion protection | Yes (`TargetKind::AavePool`) | Yes | **Shipped** (Stage 11) |
| **Oracle USD-Denominated Caps** | C4 | Chainlink staleness & USD caps | Yes (`decide_with_usd`) | Yes | **Shipped** (Stage 11) |

---

## 6. Why Fe (Concrete Language Advantages)

Every capability in Leash maps directly to unique language features in Fe 26.6.0:

1. **Effects Bound Powers (Static Least Privilege)**:
   - `policy::decide` has **no `uses` clause** ([`ingots/policy/src/rules.fe#L189`](ingots/policy/src/rules.fe#L189)): the compiler rejects any storage access, I/O or external call inside it, so it is pure and deterministic. The CI `rules` job fails if a `uses` clause is added.
   - `policy::record` takes the agent state as `mut AgentState` ([`ingots/policy/src/ledger.fe#L53`](ingots/policy/src/ledger.fe#L53)) and is, with `record_denial`, the only policy function that changes it.
   - Guardian emergency `Pause` declares `uses (ctx, safe, guardian, mut paused, mut log)` ([`ingots/module/src/lib.fe#L219`](ingots/module/src/lib.fe#L219)): the only storage it can write is `paused` (plus the event log), so the compiler rules out the guardian executing transactions, rotating keys or changing limits from that handler.
   - CLI subcommands get only the effects they need: `leash check` uses `Args`, `Stdout` and `Stderr` ([`ingots/cli/src/check.fe#L125`](ingots/cli/src/check.fe#L125)), and only `leash replay` is granted `Fs` ([`ingots/cli/src/replay.fe#L271`](ingots/cli/src/replay.fe#L271)).

2. **Strictly Typed Financial Units**:
   - `Wei`, `Duration`, and `Timestamp` are distinct, strongly typed units ([`ingots/policy/src/types.fe#L1-L15`](ingots/policy/src/types.fe)).
   - Attempting to add units of different dimensions (e.g. `Wei + Duration`) is rejected at compile time: verified by our compile-fail test in [`test/compile_fail/units_mixing.fe`](test/compile_fail/units_mixing.fe) and [`scripts/compile-fail.sh`](scripts/compile-fail.sh).

3. **One Source for Dual Targets (EVM + Native)**:
   - The same Fe policy source compiles down to EVM bytecode for `LeashModule` and native x86-64/AArch64 machine code for the `leash` CLI.
   - The parity test suite runs the identical code across both backends (`fe test` and `fe test --backend native`), producing the identical Keccak-256 rolling digest across 10,000 transactions ([`test/parity/src/evm.fe`](test/parity/src/evm.fe)).

4. **Compile-Time Policy Validation**:
   - The 16-variant `PolicyCheck` exhaustively validates policies against misconfigurations (e.g., zero windows, unsorted selectors, orphaned token rules, un-permissioned targets) before deployment ([`ingots/policy/src/validate.fe`](ingots/policy/src/validate.fe) and [`ingots/policy/src/test_validate.fe`](ingots/policy/src/test_validate.fe)).

5. **Solidity-Compatible Custom Error Selectors**:
   - Fe's `#[error]` struct attribute generates standard 4-byte ABI error selectors ([`ingots/module/src/errors.fe`](ingots/module/src/errors.fe)), allowing Safe clients, Viem, and Etherscan to cleanly decode typed reverts (e.g. `Paused()`, `TargetNotAllowed()`, `PerTxCapExceeded()`).

6. **C ABI Export**:
   - C header bindings ([`examples/c/leash.h`](examples/c/leash.h)) and reference consumer ([`examples/c/main.c`](examples/c/main.c)) demonstrate embedding Fe policy evaluation in C/C++ agent programs.

---

## 7. Verification Evidence & Quality Gates

### Headline Parity Verification (10,000 Transactions, E1)
10,000 synthetic transactions across 10 chunks were generated with a deterministic `SplitMix64` PRNG (seed `0x4C45415348`) and evaluated across EVM and Native backends. Both produced the identical golden Keccak-256 digest:

$$\text{PARITY\_GOLDEN\_DIGEST} = \mathtt{0x3a8d3e9925f2e47c6f4becdbeee4d3bcacb81b1f36a595fa9a1f975c1c5175a8}$$

#### Empirical Verdict Distribution (10,000 Transactions):
| Verdict / Deny Code | Frequency | Percentage | Status |
|---|---|---|---|
| **Allow (0)** | 1,137 | 11.37% | Exercised |
| **Paused (1)** | 120 | 1.20% | Exercised |
| **SessionExpired (2)** | 83 | 0.83% | Exercised |
| **DelegateCallBlocked (3)** | 426 | 4.26% | Exercised |
| **TargetNotAllowed (4)** | 1,334 | 13.34% | Exercised |
| **SelectorNotAllowed (5)** | 1,056 | 10.56% | Exercised |
| **MalformedCalldata (6)** | 170 | 1.70% | Exercised |
| **PerTxCapExceeded (7)** | 337 | 3.37% | Exercised |
| **WindowCapExceeded (8)** | 252 | 2.52% | Exercised |
| **TokenCapExceeded (9)** | 131 | 1.31% | Exercised |
| **UnlimitedApproval (10)** | 68 | 0.68% | Exercised |
| **RecipientNotAllowed (11)** | 118 | 1.18% | Exercised |
| **RateLimited (12)** | 61 | 0.61% | Exercised |
| **CooldownActive (13)** | 1,692 | 16.92% | Exercised |
| **CircuitTripped (15)** | 3,015 | 30.15% | Exercised |
| **Total** | **10,000** | **100.00%** | **100% Agreement** |

**Mutation Verification**: Flipping `>` to `>=` in `check_per_tx_cap` immediately failed 11 parity tests, verifying test sensitivity.

### 33-Exploit Adversarial Attack Suite (E2)
Located in [`test/attacks/src/`](test/attacks/src/):
- **Attack 01**: MultiSend DelegateCall Hijack → Rejected (`DelegateCallBlocked`)
- **Attack 02**: Cap Evasion via Split Spends → Rejected (`WindowCapExceeded`)
- **Attack 03**: Unlimited Approval Treasury Drain → Rejected (`UnlimitedApproval`)
- **Attack 04**: Malicious Spender / Recipient Phishing → Rejected (`RecipientNotAllowed`)
- **Attack 05**: Calldata Smuggling (dirty address bytes, 35-byte transfers) → Rejected (`MalformedCalldata`)
- **Attack 06**: Reentrancy Attack on Module During Execution → Atomic Revert (`Reentrant()`)
- **Attack 07**: Stolen / Expired Agent Key → Rejected (`SessionExpired`)
- **Attack 08**: Guardian Privilege Escalation → Atomic Revert (`NotSafe()`)
- **Attack 09**: Window Boundary Double Spend → Prevented by rolling 24-hour bucket algorithm
- **Attack 10**: Unlisted Token Target Call → Rejected (`TargetNotAllowed`)
- **Attack 11**: Phantom Execution Desync (Safe reverts) → Atomic Revert & Ledger Rollback (`SafeCallFailed()`)
- **Attack 12**: Circuit Breaker Probing Attack → Tripped on 3rd denial, locking execution
- **Attack 14**: Unknown Operation Type → Atomic Revert
- **Attack 15**: Arithmetic Wrap Overflow ($2^{256} - 1$) → Denied without overflow panic
- **Attack 16**: Rate Limit Burst Spamming → Rejected (`RateLimited`)
- **Attack 17**: Cooldown Subversion → Rejected (`CooldownActive`)
- **Attack 18**: ERC-20 `increaseAllowance` Bypass Attack → Rejected (`UnlimitedApproval` / `RecipientNotAllowed`)
- **Attack 19**: Uniswap V2/V3 Zero-Slippage MEV Sandwich Drain (`amountOutMin == 0`) → Rejected (`SwapNotAllowed`, code 16)
- **Attack 20**: Swap Recipient Diversion & Slippage Verification → Validated against allowlist & minimum output
- **Attack 21**: Owner Co-Signed Override Cap Exemption & Structural Security → Bypasses spend caps only; strictly enforces target allowlist, delegatecall block, and non-malleable signatures
- **Attack 22**: Escalation Timelock Queue & Safe Veto Defense → Threshold violations queued with `EscalationRequired` (code 20); early execution blocked; Safe veto stops execution
- **Attack 23**: Aave v3 Withdrawal Diversion Attack → Diversion of withdrawn collateral to unauthorized recipient rejected (`RecipientNotAllowed`, code 11); unlisted asset rejected (`LendingNotAllowed`, code 17)
- **Attack 24**: Oracle Staleness & USD Spending Cap Evasion → Stale or zero oracle price feed rejected (`PriceUnavailable`, code 18); exceeding USD cap rejected (`UsdCapExceeded`, code 19)

### Bytecode Size & Headroom (E3)
- **Runtime Code Size**: **22,029 bytes** (below the 24,576-byte EIP-170 limit, 0 compiler warnings; measured with `fe build --emit sizes`).
- **EIP-170 Headroom**: **2,547 bytes** with all policy rules, ERC-20 hardening, the Uniswap guard and the Aave guard.
- **Initcode Size**: 22,284 bytes (< 49,152 bytes EIP-3860 limit).
- Gas profiling details available in [`docs/GAS.md`](docs/GAS.md).

---

## 8. Limitations and Future Work

Known limits of this release, each with where it is handled:

1. **Hourly Bucket Approximation**: The 24-hour rolling window uses 24 discrete 1-hour buckets. Spend within the current hour rolls over cleanly, but timestamps within the same 60-minute bucket are grouped together. Continuous exponential sliding windows are scheduled for Stage 12.
2. **Circuit Breaker Reset**: In the current implementation, resetting a tripped circuit breaker requires an explicit call from the Safe account (`ResetCircuitBreaker`). Automated exponential backoff resets are planned for Stage 10.
3. **Native CLI platforms**: Fe 26.6.0 links native binaries on x86-64 Linux and AArch64 macOS. Windows users run the CLI under WSL; the Windows demo uses the labelled TypeScript mirror (see the demo section).
4. **Agent tool server**: `bin/leash-serve.ts` asks the Fe `leash` binary for each verdict when one is present; its multi-step planning session (`record`) keeps its window state in TypeScript.
5. **Safe on testnet**: `demo/deploy.ts` deploys the Fe `MockSafe` test account. Using a canonical Safe means enabling the module from the Safe's Transaction Builder, as described in [`docs/deployment.md`](docs/deployment.md).
6. **Offline TOML Parsing**: Parsing arbitrary external TOML policy manifests into static bytecode is documented for Stage 12 tooling.

---

## 9. Fe Findings Summary (E7)

Key insights and findings documented in [`docs/FE_FINDINGS.md`](docs/FE_FINDINGS.md) to support the Fe core team:

1. **Top-Level `pub use` Statements**: In Fe 26.6.0, `pub use module::*;` throws `unexpected token ';'`. Top-level re-exports must omit the trailing semicolon.
2. **Mutable Variable Declaration**: Local mutable variables require `var x = ...` rather than `let mut x`.
3. **`Bytes` Move Semantics**: `Bytes` instances do not implement `Copy`. Passing a `Bytes` instance to an EVM call moves it; simulation loops must use `.clone()` or re-initialize.
4. **Single-Element Tuples in `evm.create`**: `(x)` is evaluated as a parenthesized scalar; creating contracts with 1 argument requires trailing comma tuple syntax `(x,)`.
5. **Zero-Field Variant Syntax**: Matching or creating zero-field message variants requires empty braces `Variant {}` rather than bare `Variant`.
6. **Error Selectors in Tests**: `#[test(should_revert, selector = 0x...)]` is critical for preventing false-positive test passes on unrelated reverts.

---

## 10. Submission Criteria Map

Every requirement from `phases/00-project-context.md §11` is fulfilled and linked below:

| Contest Requirement | Leash Deliverable | Phase | Proof in Repository |
|---|---|---|---|
| **Core contribution in Fe** | `policy`, `module`, `cli`, `testkit` ingots are 100% pure Fe | 1–4 | [`fe.toml`](fe.toml), [`ingots/`](ingots/) |
| **Public GitHub repo, OSI licence** | Apache-2.0 | 0 | [`LICENSE`](LICENSE), [GitHub Repo](https://github.com/devprashant19/Leash) |
| **Commit SHA & exact Fe version** | Pinned `fe 26.6.0 (5b3f96a)` | 0, 7 | [`.github/workflows/ci.yml`](.github/workflows/ci.yml), [`docs/submission.md`](docs/submission.md) |
| **Reproducible build instructions** | `make setup && make all && make demo` | 0, 7 | [`Makefile`](Makefile), [Quick Start](#2-quick-start) |
| **Appropriate automated tests** | 159 EVM tests and 119 native tests passing (77 shared policy tests on both), attack suite | 1–5 | [`test/`](test/), [CI Workflow](https://github.com/devprashant19/Leash/actions) |
| **README: approach, architecture, limitations** | Complete technical report adhering to contest structure | 7 | This document ([README.md](README.md)) |
| **Short pitch + Fe highlight** | Pitch and Fe highlight defined in context §1 | 7 | [Pitch Header](#leash--drift-proof-safe-guardrails-for-ai-agents-in-fe) |
| **Demo or reproducible example** | 2-min video script + local Anvil demo runner | 6 | [`docs/video-script.md`](docs/video-script.md), [`demo/local.ts`](demo/local.ts) |
| **Declaration of pre-existing work & AI use** | Starter cited; Safe interfaces noted; full AI log | 0–7 | [`DECLARATION.md`](DECLARATION.md), [`docs/ai-log.md`](docs/ai-log.md) |
| **All commits in contest window** | Commits dated Nov 3–24, 2026; starter tagged `starter` | 0 | `git log starter..HEAD` |

---

## 11. Declarations & Attributions

- **Starter Template**: Based on `https://github.com/fe-lang/builders-challenge-starter` (commit `f9d9aa9`), tagged in git as `starter`.
- **Safe Smart Account Interface**: Standard `ModuleManager.execTransactionFromModule` selector (`0x468721a7`) and calling convention.
- **ERC-20 Interface**: Standard selectors for `transfer`, `approve`, `transferFrom`, `balanceOf`, `allowance`.
- **Standard Library**: Fe standard library modules (`core`, `std`) from `argotorg/fe` tag `v26.6.0`.
- **AI Assistance Declaration**: Development was assisted by agentic AI engineering workflows (Google DeepMind Antigravity / Claude Code) following strict engineering rules (`AGENTS.md`). Every AI-assisted code change, test execution, architectural decision, and raw compiler output is permanently logged in [`docs/ai-log.md`](docs/ai-log.md) (12 total milestones logged). Full details in [`DECLARATION.md`](DECLARATION.md).

---

## 12. License

Licensed under the Apache License, Version 2.0. See [`LICENSE`](LICENSE) for details.
