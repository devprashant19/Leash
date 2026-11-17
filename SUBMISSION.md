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
pub fn decide(policy: Policy, state: AgentState, now: Timestamp, tx: Tx) -> Verdict {
    if state.paused != 0 {
        return Verdict::Deny(Reason::Paused)
    }
    if state.expiry != 0 and now > state.expiry {
        return Verdict::Deny(Reason::SessionExpired)
    }
    if tx.operation != 0 {
        return Verdict::Deny(Reason::DelegateCallBlocked)
    }
    // ... Target allowlist, calldata decoding, per-tx and 24h rolling budget checks
    Verdict::Allow
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

# 3. Run all tests on EVM backend (153 tests)
fe test

# 4. Run tests on Native backend (Linux / macOS)
fe test --backend native

# 5. Build EVM smart contracts (Runtime size: 24,308 B; 268 B under 24,576 B limit)
fe build

# 6. Run the local Anvil end-to-end demo
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
3. **Storage and Gas Overhead (56 Storage Words, ~260k–300k gas)**: Every transaction evaluation accesses 56 storage words (24 hourly ETH buckets + 4 token period buckets) in `AgentLedger`. At 2,100 gas per cold SLOAD, storage reading alone consumes ~117k gas, bringing total transaction execution through `LeashModule` to ~260k–300k gas. This fixed ring-buffer design guarantees bounded $O(1)$ loop execution and eliminates out-of-gas griefing, but incurs higher baseline SLOAD gas than single-word nonce checks.
4. **Compile-Time Policy Constants vs Deploy-Time Configuration**: Default policy targets (`ADDR_TOKEN`, `ADDR_TREASURY`) and caps are compiled constants in `ingots/policy/src/config.fe` to stay within EIP-170 (runtime size 24,308 bytes, 268 bytes headroom) and guarantee byte-for-byte fingerprint parity between native CLI and EVM contract. Custom policies are configured by editing `config.fe` and compiling with `fe build`.
5. **Native CLI Platforms**: Fe 26.6.0 links native binaries on x86-64 Linux and AArch64 macOS. Windows environments run under WSL or use the TypeScript policy mirror.
6. **Token window is fixed, not sliding**: each token rule's `max_per_window` (code 21) applies per fixed 24 h period from 00:00 UTC (two storage words per token rule; a sliding window would require 48 words per token, or 192 storage words for 4 tokens). Across a period boundary an agent can move up to twice the cap in a short span. The ETH window slides hour by hour.
7. **Swaps are refused**: a Uniswap call's recipient and token path lie past the 100 calldata bytes the policy decodes, so every call to a listed router is refused (`SwapNotAllowed`, 16).
8. **One policy for every agent & Inactive Default Rules**: `LeashModule` enforces `default_policy()` for every agent, the policy the CLI predicts with. Recipient allowlists (`A8`), rate limiting (`A9`) and cooldowns (`A10`) are implemented and tested in `ingots/policy` but disabled in `default_policy()` to keep storage minimal.
9. **Safe on Testnet & Production Safe**: Automated tests and demo run against `MockSafe` to test `execTransactionFromModule`. Attaching `LeashModule` to a live production Safe on Sepolia/Mainnet via Safe Transaction Builder is documented in `docs/deployment.md`.
10. **Small size headroom**: `LeashModule` is 268 bytes under the EIP-170 limit; new on-chain rules need size work first.


---

## Declaration

- **Pre-existing work**: Built on top of the official Fe challenge starter template (`https://github.com/fe-lang/builders-challenge-starter`, commit `f9d9aa9`), tagged as `starter`. All contract logic, CLI implementation, tests, and web interfaces were authored during the contest period.
- **Third-party code**: Safe `ModuleManager` interface standard calling convention; ERC-20 standard interfaces; Fe standard library (`core`, `std`); Foundry Anvil for local node simulation; Viem and EthereumJS VM for the local web sandbox.
- **AI assistance**: Development was assisted by agentic AI engineering workflows (Google DeepMind Antigravity / Claude Code) following strict rules (`AGENTS.md`). All AI-assisted changes, compiler test runs, and architectural decisions are logged in [`docs/ai-log.md`](docs/ai-log.md).
- **Commit History & Integrity**: All work was created and verified within the contest window. Detailed attributions and disclosures are published in [`DECLARATION.md`](DECLARATION.md).

---

## Team

- **Dev Prashant** ([@devprashant19](https://github.com/devprashant19))

---

## License

Licensed under the [Apache License, Version 2.0](LICENSE).
