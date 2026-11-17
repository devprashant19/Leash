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

### Run it in the browser: [https://leash-project.vercel.app](https://leash-project.vercel.app)

The live interactive application ([`web/`](web/), a React + Framer Motion app, plus [`api/`](api/)) lets anyone run and verify Leash directly:
- **Live Demo & Plan Simulator**: [https://leash-project.vercel.app](https://leash-project.vercel.app)
- **Recorded Run Dashboard**: [https://leash-project.vercel.app/dashboard/](https://leash-project.vercel.app/dashboard/)

- **Run the 5-transaction demo**: each run deploys the Fe-compiled `MockSafe`, `LeashModule` and demo token into a fresh in-memory EVM, and the Fe-built `leash` binary predicts every verdict from the agent's on-chain state before the contract decides. The page then walks through each transaction step by step (the agent asks, the CLI predicts, the module decides, the outcome and why), followed by both policy fingerprints and the balances before and after.
- **Run the full feature tour**: 18 transactions in 5 chapters on one chain: allowed spending, every deny path (codes 1–10), the circuit breaker tripping and the owner resetting it, the rolling 24 h budget, a guardian pause and an expired session. Every prediction must match the on-chain decision.
- **Try your own transaction**: any target, value, calldata and operation; the Fe CLI's prediction and the contract's decision side by side.
- **Links that run on open**: `/?run` (the demo), `/?tour` (the feature tour), `/?try=1` (an over-cap transfer). API: `GET /api/demo`, `GET /api/tour`, `POST /api/check`, `POST /api/plan`, `GET /api/health`.

Verified on Amazon Linux 2023 with Node 22 (Vercel's function runtime): `npm run test:web` passes 17/17, with predictions from the bundled Fe binary (including all 18 tour transactions and the plan simulator). The CI `web` job repeats this on every push. Deploy steps: [`docs/deployment.md`](docs/deployment.md#0-vercel-the-page-judges-open).



- **Video script**: scene-by-scene script and timings in [`docs/video-script.md`](docs/video-script.md).
- **Recorded-run dashboard**: `/dashboard/` on the Vercel page, or `npx serve demo` and open `/dashboard/`. It reads `run.json` (the recorded Anvil run) and shows each prediction next to the on-chain decision.
- **Contract build metadata**: [`demo/deployments/LeashModule.metadata.json`](demo/deployments/LeashModule.metadata.json) (from `fe build --emit metadata`).
- **Native CLI binaries**: [`cli-v0.1.0` release](https://github.com/devprashant19/Leash/releases/tag/cli-v0.1.0): `leash-linux-x86_64` and `leash-macos-arm64`, built and smoke-tested by [`.github/workflows/release.yml`](.github/workflows/release.yml).
- **Deploying (free tier)**: Sepolia contracts, dashboard hosting and CLI release, step by step in [`docs/deployment.md`](docs/deployment.md).
- **Full Submission Details**: [`docs/submission.md`](docs/submission.md).

### More on the page
- **Plan simulator**: on the page and `POST /api/plan` (up to 12 steps). The server runs the whole plan on a fresh chain with the real contracts; each step is predicted by the Fe CLI from the agent's state at that point and then decided by `LeashModule`, so the 24 h budget and the circuit breaker carry over exactly as on-chain ([`api/_lib/plan.ts`](api/_lib/plan.ts)).
- **If the live server fails**: the page says so and offers to replay a run recorded earlier with the Fe binary ([`web/public/recorded/`](web/public/recorded/)), labelled as a recording. It never substitutes invented results.

### The 5-Transaction Canonical Scenario (Reproduce in 7 Seconds)

The automated demo launches an ephemeral local Anvil node, deploys `MockSafe`, `LeashModule`, and an ERC-20 token, registers an agent session key, and executes five canonical rogue agent transactions comparing off-chain CLI predictions against atomic on-chain execution:

| # | Proposed Transaction | CLI Prediction | On-Chain Result | Gas Used | Status |
|---|---|---|---|---|---|
| **1** | Agent sends 0.05 ETH to authorized treasury | `ALLOW` | `ALLOW` (Executed) | 299,218 | **✓ PASS** |
| **2** | Agent transfers 50 tokens to authorized recipient | `ALLOW` | `ALLOW` (Executed) | 264,283 | **✓ PASS** |
| **3** | Agent sends 0.2 ETH (exceeds 0.1 ETH per-tx cap) | `DENY (PerTxCapExceeded)` | `DENY (code 7)` | 192,947 | **✓ PASS** |
| **4** | Agent calls unlisted contract (malicious diversion) | `DENY (TargetNotAllowed)` | `DENY (code 4)` | 175,484 | **✓ PASS** |
| **5** | Agent calls `approve(exchange, 2^256 - 1)` unlimited drain | `DENY (UnlimitedApproval)` | `DENY (code 10)` | 201,701 | **✓ PASS** |

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
| **Rolling 24h Window Cap** | A5 | `WindowCapExceeded` (8) | Yes (24 hourly buckets for ETH) | Yes (`--state`) | **Shipped** |
| **ERC-20 Per-Tx & Approval Hygiene**| A6/A7 | `TokenCapExceeded` (9), `UnlimitedApproval` (10) | Yes (`max_per_tx`, `max_approve`) | Yes | **Shipped** |
| **ERC-20 24 h Token Cap** | A6 | `TokenWindowCapExceeded` (21) | Yes (per token rule, fixed 24 h periods, stored per agent) | Yes (`--state`) | **Shipped** |
| **Recipient Allowlist** | A8 | `RecipientNotAllowed` (11) | In `decide` (inactive in default policy: `n_recipients: 0`) | Yes | **Shipped** (Policy Rule) |
| **Tx-Count Rate Limiting** | A9 | `RateLimited` (12) | In `decide` (inactive in default policy: `max_actions: 0`) | Yes | **Shipped** (Policy Rule) |
| **Transaction Cooldown** | A10 | `CooldownActive` (13) | In `decide` (inactive in default policy: `cooldown: 0`) | Yes | **Shipped** (Policy Rule) |
| **Auto-Pause Circuit Breaker** | B3 | `CircuitTripped` (15) | Yes (tracked & tripped via `TryExecute`; `Execute` reverts atomically) | Yes | **Shipped** |
| **Pre-Deployment Policy Validation**| 13 | 16-variant `PolicyCheck` | Pure static verification (`validate`) rejects invalid policies | `validate` | **Shipped** |
| **Machine-readable JSON Output** | D1 | Structured JSON verdict | N/A | `leash check --json` | **Shipped** |
| **C Static Header Export** | D7 | `leash.h` / `main.c` bindings | N/A | C FFI Reference Header | **Shipped** |
| **Trading Hours Schedule** | A11 | `OutsideTradingHours` (14) | Roadmap (enum only, no evaluation logic) | Roadmap | Roadmap |
| **Uniswap Swaps** | C1/C2 | `SwapNotAllowed` (16) for every call to a listed router | In `decide` (refused: the recipient and token path lie past the 100 decoded calldata bytes) | Yes | Roadmap (checked swaps) |
| **Aave Lending Guard** | C3 | Collateral diversion protection | In `decide` (`check_aave_guard`) | Yes | **Shipped** |
| **Oracle USD-Denominated Caps** | C4 | Chainlink staleness & USD caps | Policy function only (`policy::decide_with_usd`) | Yes | **Shipped** (Policy Engine) |



---

## 6. Why Fe (Concrete Language Advantages)

Every capability in Leash maps directly to unique language features in Fe 26.6.0:

1. **Effects Bound Powers (Static Least Privilege)**:
   - `policy::decide` and `policy::decide_spend` have **no `uses` clause** ([`ingots/policy/src/rules.fe#L205`](ingots/policy/src/rules.fe#L205)): the compiler rejects any storage access, I/O or external call inside them, so they are pure and deterministic. The CI `rules` job fails if a `uses` clause is added.
   - `policy::record_allowed` takes the agent state as `mut AgentState` ([`ingots/policy/src/ledger.fe#L77`](ingots/policy/src/ledger.fe#L77)); with `record` (which calls it) and `record_denial`, it is the only policy function that changes it. It books exactly the token amount `decide_spend` reported, so the check and the ledger read the calldata once.
   - Guardian emergency `Pause` declares `uses (ctx, safe, guardian, mut paused, mut log)` ([`ingots/module/src/lib.fe#L180`](ingots/module/src/lib.fe#L180)): the only storage it can write is `paused` (plus the event log), so the compiler rules out the guardian executing transactions, rotating keys or changing limits from that handler.
   - CLI subcommands get only the effects they need: `leash check` uses `Args`, `Stdout` and `Stderr` ([`ingots/cli/src/check.fe#L124`](ingots/cli/src/check.fe#L124)), and only `leash replay` is granted `Fs` ([`ingots/cli/src/replay.fe#L270`](ingots/cli/src/replay.fe#L270)).

2. **Strictly Typed Financial Units**:
   - `Wei`, `Duration`, and `Timestamp` are distinct, strongly typed units ([`ingots/policy/src/types.fe#L1-L15`](ingots/policy/src/types.fe)).
   - Attempting to add units of different dimensions (e.g. `Wei + Duration`) is rejected at compile time: verified by our compile-fail test in [`test/compile_fail/units_mixing.fe`](test/compile_fail/units_mixing.fe) and [`scripts/compile-fail.sh`](scripts/compile-fail.sh).

3. **One Source for Dual Targets (EVM + Native)**:
   - The same Fe policy source compiles down to EVM bytecode for `LeashModule` and native x86-64/AArch64 machine code for the `leash` CLI.
   - The parity test suite runs the identical code across both backends (`fe test` and `fe test --backend native`), producing the identical Keccak-256 rolling digest across 10,000 transactions ([`test/parity/src/evm.fe`](test/parity/src/evm.fe)).

4. **Pre-Deployment Policy Validation & Compile-Time Safety**:
   - **Compile-Time Guarantees**: Fe's static type system rejects dimensional unit errors at compile time (`Wei + Duration` fails compilation, verified in [`test/compile_fail/units_mixing.fe`](test/compile_fail/units_mixing.fe) via [`scripts/compile-fail.sh`](scripts/compile-fail.sh)), and enforces pure effect boundaries (`decide` has no `uses` clause).
   - **Pre-Deployment Policy Invariant Validation**: The 16-variant pure `PolicyCheck` statically inspects configured policies before deployment, catching structural flaws (e.g., zero windows, unsorted selectors, orphaned token rules, un-permissioned targets) via `policy::validate` ([`ingots/policy/src/validate.fe`](ingots/policy/src/validate.fe), verified by 14 unit tests in [`ingots/policy/src/test_validate.fe`](ingots/policy/src/test_validate.fe)).

5. **Solidity-Compatible Custom Error Selectors**:
   - Fe's `#[error]` struct attribute generates standard 4-byte ABI error selectors ([`ingots/module/src/errors.fe`](ingots/module/src/errors.fe)), allowing Safe clients, Viem, and Etherscan to cleanly decode typed reverts (e.g. `Paused()`, `TargetNotAllowed()`, `PerTxCapExceeded()`).

6. **C ABI Export**:
   - C header bindings ([`examples/c/leash.h`](examples/c/leash.h)) and reference consumer ([`examples/c/main.c`](examples/c/main.c)) demonstrate embedding Fe policy evaluation in C/C++ agent programs.

---

## 7. Verification Evidence & Quality Gates

### Headline Parity Verification (10,000 Transactions, E1)
10,000 synthetic transactions across 10 chunks were generated with a deterministic `SplitMix64` PRNG (seed `0x4C45415348`).
- **EVM Parity Suite** ([`test/parity/src/evm.fe`](test/parity/src/evm.fe)): The EVM test suite executes all 10 chunks (1,000 txs each, total 10,000 transactions) live in EVM simulation, verifying dynamic ledger state transitions and rule verdicts.
- **Native Parity Suite** ([`test/parity/src/native.fe`](test/parity/src/native.fe)): The native suite dynamically executes chunk 0 (1,000 txs) live on the native engine, and validates all 10 chunks against stored golden chunk digests to assert complete convergence with the root Keccak-256 golden digest:

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

**Mutation check**: changing the per-transaction cap test in `decide_spend` (step 9) from `tx.value > policy.max_per_tx` to `>=` makes 12 tests fail: all 11 parity tests (the 10 EVM chunks and the native chunk) and `test_per_tx_and_window_eth_caps`. Re-run on 2026-11-17 with `fe test`.

### Adversarial Attack Suite (E2): 23 Scenarios, 31 Tests
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
- **Attack 19**: Zero-Slippage Sandwich Swap (V2 and V3) → Rejected (`SwapNotAllowed`, code 16): every call to a listed router is refused
- **Attack 20**: Swap Output Diverted to the Attacker → Rejected (`SwapNotAllowed`, 16) on a listed router, `TargetNotAllowed` (4) on an unlisted one
- **Attack 22**: Payment Above the Escalation Threshold → Rejected by `decide_with_escalation` (`EscalationRequired`, code 20); a payment below it passes
- **Attack 23**: Aave v3 Withdrawal Diversion Attack → Diversion of withdrawn collateral to unauthorized recipient rejected (`RecipientNotAllowed`, code 11); unlisted asset rejected (`LendingNotAllowed`, code 17)
- **Attack 24**: Oracle Staleness & USD Spending Cap Evasion → Stale or zero oracle price feed rejected (`PriceUnavailable`, code 18); exceeding USD cap rejected (`UsdCapExceeded`, code 19)
- **Attack 25**: Token Drip Under the Per-Transfer Cap → Sixth piece rejected (`TokenWindowCapExceeded`, code 21); `transferFrom` counts too

### Bytecode Size & Headroom (E3)
- **Runtime Code Size**: **18,892 bytes** (well below the 24,576-byte EIP-170 limit, 0 compiler warnings; measured with `fe build --emit sizes`, and checked in CI).
- **EIP-170 Headroom**: **5,684 bytes (23.1%)** with all policy rules, the ERC-20 guard and per-token ledger, the Aave guard, the circuit breaker, and packed hourly ETH buckets.
- **Initcode Size**: 19,147 bytes (< 49,152 bytes EIP-3860 limit).
- Gas profiling details available in [`docs/GAS.md`](docs/GAS.md).

---

## 8. Limitations and Future Work

Known limits of this release, each with where it is handled:

1. **Hourly Bucket Approximation**: The 24-hour rolling window uses 24 discrete 1-hour buckets. Spend within the current hour rolls over cleanly, but timestamps within the same 60-minute bucket are grouped together.
2. **Circuit Breaker Denial Accounting (`Execute` vs `TryExecute`)**: In EVM execution semantics, `execute()` provides atomic fail-safe execution that reverts the EVM transaction on policy denial via `revert_error(PolicyViolation { code })`. Because an EVM revert rolls back all state modifications within that transaction frame, storage writes (such as incrementing `cfg.denials` or tripping `cfg.tripped`) do not persist during an `execute()` revert. Callers and relayers requiring denial tracking and auto-pause trip behavior call `tryExecute()`, which records denials in storage and emits `Denied`/`CircuitTrippedEvent` without reverting the top-level EVM frame. Once tripped (`cfg.tripped == true`), subsequent calls to *both* `execute()` and `tryExecute()` are locked out until the Safe owner calls `resetBreaker(agent)`.
3. **Storage and Gas Overhead (32 Storage Words, ~200k–220k gas)**: Every transaction evaluation accesses 32 storage words (24 packed hourly ETH buckets in `Window24` [24 words] + 4 token period buckets [8 words]) in `AgentLedger`. At 2,100 gas per cold SLOAD, storage reading alone consumes 67.2k gas (reduced from 117.6k gas by packing ETH buckets), bringing total end-to-end transaction execution through `LeashModule` and the Safe to ~202k–218k gas (down from ~264k–299k gas, a ~25% reduction). This fixed ring-buffer design was intentionally chosen over transaction-log or dynamic array structures to guarantee bounded $O(1)$ loop execution and eliminate out-of-gas griefing, but introduces a higher baseline SLOAD cost than single-word nonce checks. Full gas breakdown in [`docs/GAS.md`](docs/GAS.md).
4. **Compile-Time Policy Constants vs Dynamic Deploy-Time Configuration**: The default policy's addresses (`ADDR_TOKEN`, `ADDR_TREASURY`) and spending caps are defined as constants in `ingots/policy/src/config.fe`. This architecture was chosen to guarantee that `LeashModule` stays under EIP-170's 24,576-byte limit (runtime size 18,892 bytes, 5,684 bytes headroom) and to ensure byte-for-byte cryptographic policy fingerprint parity (`0x3efcfc58...`) between the native CLI binary and the EVM smart contract. To configure custom policies, developers adjust `config.fe` and compile with `fe build`, producing both their tailored off-chain binary and on-chain contract.
5. **Native CLI platforms**: Fe 26.6.0 links native binaries on x86-64 Linux and AArch64 macOS. Windows users run the CLI under WSL; the Windows demo uses the labelled TypeScript mirror (see the demo section).
6. **Agent tool server**: `bin/leash-serve.ts` asks the Fe `leash` binary for each verdict when one is present. Its planning session (`record`) keeps the planned ledger (ETH buckets and the token period) in TypeScript and passes it to every check as `--state`, so the verdict still comes from the policy.
7. **Safe on testnet & Production Safe Compatibility**: `demo/deploy.ts` and automated Anvil tests deploy against `MockSafe` to test the standard Safe Core module interface (`execTransactionFromModule`). Detailed instructions for attaching `LeashModule` to a production Safe on Sepolia or Mainnet via the Safe Transaction Builder UI (`enableModule`, `setAgent`) are documented in [`docs/deployment.md#using-a-canonical-safe-instead-of-the-mock`](docs/deployment.md#using-a-canonical-safe-instead-of-the-mock).
8. **Token window is fixed, not sliding**: each token rule's `max_per_window` (code 21) applies per fixed 24 h period starting 00:00 UTC (two storage words per token rule; a sliding window would need 48 words per token, or 192 storage words for 4 tokens, which would be cost-prohibitive in gas and exceed contract size). Across a period boundary an agent can move up to twice the cap in a short span. The ETH window slides hour by hour. Details in [`docs/RULES.md`](docs/RULES.md#11-protocol-guards).
9. **Swaps are refused**: the policy decodes the first 100 calldata bytes, and a Uniswap call's recipient and token path lie past them, so a listed router is always refused (`SwapNotAllowed`, 16). Checked swaps need a longer calldata window, which costs contract size.
10. **One policy for every agent & Inactive Shipped Rules**: `LeashModule` enforces `default_policy()` for every agent, the policy the CLI predicts with and the fingerprint names. Recipient allowlists (`A8`), rate limiting (`A9`) and cooldowns (`A10`) are fully implemented and verified across 31 attack tests in `test/attacks/`, but disabled in `default_policy()` (`n_recipients: 0`, `max_actions: 0`, `cooldown: 0`) to minimize baseline storage consumption and keep demo execution unconstrained.
11. **On-chain fingerprint is a constant**: `LeashModule.fingerprint()` returns the default policy's fingerprint as a compiled-in constant (computing Keccak over the 138-word policy on-chain does not fit the size limit). The `module` test `test_fingerprint_golden` deploys the contract and checks that its constant equals `fingerprint(default_policy())` computed by the policy code, and the CLI test `test_cli_fingerprint_golden` checks the CLI against the same value, so the two cannot silently diverge.
12. **Contract size headroom**: `LeashModule` has 5,684 bytes (23.1%) of headroom under the EIP-170 limit after storage packing (runtime size 18,892 bytes, see E3).



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

Every requirement from the official contest guidelines is fulfilled and linked below:

| Contest Requirement | Leash Deliverable | Phase | Proof in Repository |
|---|---|---|---|
| **Core contribution in Fe** | `policy`, `module`, `cli`, `testkit` ingots are 100% pure Fe | 1–4 | [`fe.toml`](fe.toml), [`ingots/`](ingots/) |
| **Public GitHub repo, OSI licence** | Apache-2.0 | 0 | [`LICENSE`](LICENSE), [GitHub Repo](https://github.com/devprashant19/Leash) |
| **Commit SHA & exact Fe version** | Pinned `fe 26.6.0 (5b3f96a)` | 0, 7 | [`.github/workflows/ci.yml`](.github/workflows/ci.yml), [`docs/submission.md`](docs/submission.md) |
| **Reproducible build instructions** | `make setup && make all && make demo` | 0, 7 | [`Makefile`](Makefile), [Quick Start](#2-quick-start) |
| **Appropriate automated tests** | 167 EVM tests and 132 native tests passing (82 shared policy tests on both), 31 attack tests, 9 compile-fail tests, 200/200 differential fuzz tests | 1–5 | [`test/`](test/), [CI Workflow](https://github.com/devprashant19/Leash/actions) |

| **README: approach, architecture, limitations** | Complete technical report adhering to contest structure | 7 | This document ([README.md](README.md)) |
| **Short pitch + Fe highlight** | Pitch and Fe highlight defined in context §1 | 7 | [Pitch Header](#leash--drift-proof-safe-guardrails-for-ai-agents-in-fe) |
| **Demo or reproducible example** | 2-min video script + local Anvil demo runner | 6 | [`docs/video-script.md`](docs/video-script.md), [`demo/local.ts`](demo/local.ts) |
| **Declaration of pre-existing work & AI use** | Starter cited; Safe interfaces noted; full AI log | 0–7 | [`DECLARATION.md`](DECLARATION.md), [`docs/ai-log.md`](docs/ai-log.md) |
| **All commits in contest window** | Commits after the `starter` tag, dated Nov 13–16, 2026 | 0 | `git log starter..HEAD` |

---

## 11. Declarations & Attributions

- **Starter Template**: Based on `https://github.com/fe-lang/builders-challenge-starter` (commit `f9d9aa9`), tagged in git as `starter`.
- **Safe Smart Account Interface**: Standard `ModuleManager.execTransactionFromModule` selector (`0x468721a7`) and calling convention.
- **ERC-20 Interface**: Standard selectors for `transfer`, `approve`, `transferFrom`, `balanceOf`, `allowance`.
- **Standard Library**: Fe standard library modules (`core`, `std`) from `argotorg/fe` tag `v26.6.0`.
- **AI Assistance Declaration**: Development was assisted by agentic AI engineering workflows (Google DeepMind Antigravity / Claude Code) following strict engineering rules (`AGENTS.md`). Every AI-assisted code change, test execution, architectural decision, and raw compiler output is permanently logged in [`docs/ai-log.md`](docs/ai-log.md) (27 entries). Full details in [`DECLARATION.md`](DECLARATION.md).

---

## 12. License

Licensed under the Apache License, Version 2.0. See [`LICENSE`](LICENSE) for details.
