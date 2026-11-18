# Leash — Drift-Proof Safe Guardrails for AI Agents in Pure Fe

**Pitch:** Leash gives AI agents a Safe wallet with spending limits written once in Fe — the same pure policy enforces them on-chain and predicts them off-chain, guaranteeing that the agent's pre-check and the smart contract's decision can never drift.

---

## The Problem

Autonomous AI agents executing financial transactions need strict, non-bypassable guardrails. In current architectures, two failure modes dominate:

1. **Monolithic On-Chain Guards**: Writing all rules exclusively in Solidity contracts is gas-expensive and opaque to the agent's LLM planning loop. Agents repeatedly propose invalid transactions, wasting gas on execution reverts and retrying in broken loops.
2. **Off-Chain Simulation Drift**: Writing off-chain prediction rules in Python or TypeScript inevitably drifts from on-chain contract logic over time as edge cases, rounding errors, and block semantics diverge. An agent believes a transaction is permitted, only for it to revert on-chain; or worse, relies on an off-chain filter that permits transactions that the contract rejects.

---

## Approach

Leash compiles **one pure Fe policy source (`ingots/policy`)** to two distinct compilation targets:
- **On-chain Safe Module (`LeashModule`)**: Enforces spending limits, agent session key validity, emergency guardian pause, and circuit-breaker tripping on the EVM.
- **Fast Native CLI (`leash`)**: Evaluates the identical policy rules off-chain before broadcasting, allowing agents to pre-flight transactions instantly.

Both targets share the same source and the same pinned fingerprint (`0x3efcfc58aec5d1e7e81b5bded7820ed3ed8a0e654cf4aff3bfb793a7494ae6ee`), verified by parity tests.

---

## Fe Highlight

Every policy rule is an **effect-checked pure function**:
- `policy::decide` has **no `uses` clause**: the Fe compiler statically forbids any storage access, I/O, or external calls inside the policy evaluator. A reviewer can verify from function signatures alone that `decide` cannot alter state.
- Only `policy::record` (and `record_denial` for the breaker) takes `mut AgentState` to update spending ledgers.
- Guardian emergency pause declares `uses (ctx, safe, guardian, mut paused, mut log)`: the compiler guarantees the guardian cannot touch funds, register agents, or alter spending limits.
- The identical Fe source compiles to EVM bytecode (`fe build`) and native x86-64/AArch64 machine code (`fe build --backend native`), verified by a 10,000-transaction parity test suite (EVM executes all 10,000 transactions live; native executes chunk 0 live and validates all 10 chunks against stored golden chunk digests, yielding identical root Keccak-256 digests on both backends).

```fe
// ingots/policy/src/rules.fe
// Pure deterministic policy evaluation: statically effect-free (no uses clause)
pub fn decide(_ tx: ref Tx, _ policy: ref Policy, _ state: ref AgentState) -> Verdict {
    decide_spend(tx, policy, state).verdict
}

pub fn decide_spend(_ tx: ref Tx, _ policy: ref Policy, _ state: ref AgentState) -> Decision {
    if state.paused {
        return denied(DenyReason::Paused)
    }
    if state.tripped {
        return denied(DenyReason::CircuitTripped)
    }
    if state.expiry.as_seconds() > 0 && tx.now >= state.expiry {
        return denied(DenyReason::SessionExpired)
    }
    match tx.op {
        Operation::DelegateCall => return denied(DenyReason::DelegateCallBlocked),
        Operation::Call => {},
    }
    // ... Target allowlist, calldata decoding, per-tx and 24h rolling budget checks
    // Protocol guards dispatched via ActionGuard trait (Erc20Guard, UniswapGuard, AaveGuard)
    Decision { verdict: Verdict::Allow, spend: Option::None }
}
```

---

## Architecture

```
                 1 check (off-chain)             same pure decide
   ┌──────────┐ ─────────────────────────► ┌──────────────────┐ ──────────────┐
   │ AI Agent │                            │ leash CLI(native)│               ▼
   │ proposes │                            │ check·explain·   │      ┌─────────────────────┐
   │ a tx     │                            │ replay·validate  │      │    policy ingot     │
   └────┬─────┘                            └──────────────────┘      │ decide: no effects  │
        │ 2 execute (on-chain)                                       │ record: mut state   │
        ▼                                                            │ same fingerprint    │
   ┌──────────────────────┐   same decide + record                   └─────────────────────┘
   │ LeashModule (EVM)    │ ─────────────────────────────────────────────────▲
   │ Execute·Preview·Pause│
   └────┬─────────────────┘
        │ 3 allowed calls only
        ▼
   ┌──────────────────────────┐
   │ Safe Smart Account       │
   │ execTransactionFromModule│
   └──────────────────────────┘
```

- **`ingots/policy/`**: Core data structures, deterministic `decide()`, state-transition `record()`, ERC-20 calldata decoders, policy canonical encoding, and compile-time validation.
- **`ingots/module/`**: `LeashModule` smart contract integrating with Safe via `execTransactionFromModule`, managing agent session keys and emergency guardian pause.
- **`ingots/cli/`**: Native command-line tool (`leash check`, `explain`, `fingerprint`, `replay`, `validate`) used by AI agents off-chain.
- **`ingots/testkit/`**: Shared test doubles (`MockSafe`, `MockErc20`), deterministic `SplitMix64` PRNG, and test fixtures.

---

## Build and Test

### Compiler Version
- **Fe Compiler**: `fe 26.6.0 (5b3f96a)`
- **Foundry**: Anvil & Cast v1.9.0
- **Node.js**: v20+ or v22+

### Quick Start
```sh
# 1. Verify environment and install dependencies
make setup

# 2. Check formatting and types
fe fmt --check ingots
fe check

# 3. Run all tests on EVM backend (167 tests)
fe test

# 4. Run tests on Native backend (Linux / macOS)
fe test --backend native

# 5. Run Canonical Safe v1.4.1 integration tests (14/14 tests)
npm run test:safe

# 6. Build EVM smart contracts (Runtime size: 18,892 B; 5,684 B under 24,576 B limit)
fe build

# 7. Run the local Anvil end-to-end demo
make demo
```

---

## Demo

- **Live Web Application**: [https://leash-project.vercel.app](https://leash-project.vercel.app)
  - Interactive 5-transaction demo with step-by-step walkthrough.
  - 18-transaction full feature tour covering all deny codes, breaker trips, and guardian pause.
  - Interactive transaction console ("Send the agent anything") and plan simulator.
- **Recorded Run Dashboard**: [https://leash-project.vercel.app/dashboard/](https://leash-project.vercel.app/dashboard/)
  - Live inspection of off-chain CLI predictions vs on-chain module decisions with 0 drift.
- **Local Anvil Demo**:
  - Run `npm --prefix demo run demo` to spin up an ephemeral node, deploy contracts, and execute the 5-step canonical rogue agent scenario in 7 seconds.
- **Video Script**: Scene-by-scene timing and narration script in [`docs/video-script.md`](docs/video-script.md).

---

## Limitations

1. **Hourly Bucket Approximation**: The 24-hour rolling window uses 24 discrete 1-hour buckets. Spend within the current hour rolls over cleanly, but timestamps within the same 60-minute bucket are grouped together.
2. **Circuit Breaker Denial Accounting (`Execute` vs `TryExecute`)**: Under EVM execution semantics, `Execute` reverts on policy denial via `revert_error(PolicyViolation { code })` to maintain atomic execution, which rolls back transaction storage modifications (so denials are not counted in storage on revert). Callers requiring on-chain denial tracking and auto-pause trip behavior call `TryExecute`, which increments `cfg.denials` and trips the breaker without reverting the EVM frame. Once tripped, subsequent calls to both `Execute` and `TryExecute` are rejected until the Safe owner calls `resetBreaker(agent)`.
3. **Storage and Gas Overhead (32 Storage Words, ~200k–220k gas)**: Every transaction evaluation accesses 32 storage words (24 packed hourly ETH buckets + 4 token period buckets) in `AgentLedger`. At 2,100 gas per cold SLOAD, storage reading alone consumes 67.2k gas (reduced from 117.6k gas by packing ETH buckets), bringing total transaction execution through `LeashModule` to ~202k–218k gas (down from ~264k–299k gas, a ~25% reduction). This fixed ring-buffer design guarantees bounded $O(1)$ loop execution and eliminates out-of-gas griefing, but incurs higher baseline SLOAD gas than single-word nonce checks.
4. **Declarative Policy Builder with Cryptographic Parity**: While default addresses (`ADDR_TOKEN`, `ADDR_TREASURY`) and caps are constants in `ingots/policy/src/config.fe` to maximize contract headroom (18,892 B runtime size, 5,684 B headroom), users do not need to write Fe manually to deploy custom policies. The declarative policy generator `scripts/build-policy.mjs` (`npm run policy:build <my_policy.json>`) calculates the Keccak-256 fingerprint, validates structural invariants, executes compile-time const validation (`validate_policy_invariants`), compiles both native CLI and EVM targets, and exports standalone deployment bundles to a separate output directory without modifying committed sources. Off-chain and on-chain fingerprint parity for custom policies is enforced in CI.
5. **Native CLI Platforms**: Fe 26.6.0 links native binaries on x86-64 Linux and AArch64 macOS. Windows environments run under WSL or use the TypeScript policy mirror.
6. **Token window is fixed, not sliding**: each token rule's `max_per_window` (code 21) applies per fixed 24 h period from 00:00 UTC (two storage words per token rule; a sliding window would require 48 words per token, or 192 storage words for 4 tokens). Across a period boundary an agent can move up to twice the cap in a short span. The ETH window slides hour by hour.
7. **Swaps are refused**: a Uniswap call's recipient and token path lie past the 100 calldata bytes the policy decodes, so every call to a listed router is refused (`SwapNotAllowed`, 16).
8. **One policy for every agent & Inactive Default Rules**: `LeashModule` enforces `default_policy()` for every agent, the policy the CLI predicts with. Recipient allowlists (`A8`), rate limiting (`A9`) and cooldowns (`A10`) are implemented and tested in `ingots/policy` but disabled in `default_policy()` to keep storage minimal.
9. **Safe Compatibility & Canonical v1.4.1 Testing**: Leash is thoroughly tested and verified against official `@safe-global/safe-contracts` (v1.4.1) Safe singleton and proxy bytecode in EVM via `npm run test:safe` (14/14 tests covering multisig setup, module enablement via `execTransaction`, agent registration, ETH/ERC-20 execution, guardian pause, breaker trip/reset, and atomic reverts). For live networks (Sepolia/Mainnet), deployment instructions via the Safe Transaction Builder UI are documented in `docs/deployment.md`.
10. **Size headroom**: `LeashModule` has 5,684 bytes (23.1%) headroom under the EIP-170 limit after storage packing.


---

## Declaration

- **Pre-existing work**: Built on top of the official Fe challenge starter template (`https://github.com/fe-lang/builders-challenge-starter`), tagged as `starter`. All contract logic, CLI implementation, tests, and web interfaces were authored during the contest period.
- **Third-party code**: Safe `ModuleManager` interface standard calling convention; ERC-20 standard interfaces; Fe standard library (`core`, `std`); Foundry Anvil for local node simulation; Viem and EthereumJS VM for the local web sandbox.
- **AI assistance**: Development was assisted by agentic AI engineering workflows (Google DeepMind Antigravity / Claude Code) following strict rules (`AGENTS.md`). All AI-assisted changes, compiler test runs, and architectural decisions are logged in [`docs/ai-log.md`](docs/ai-log.md).
- **Commit History & Integrity**: All work was created and verified within the contest window. Detailed attributions and disclosures are published in [`DECLARATION.md`](DECLARATION.md).

---

## Team

- **Dev Prashant** ([@devprashant19](https://github.com/devprashant19))

---

## License

Licensed under the [Apache License, Version 2.0](LICENSE).
