# DECLARATION.md — Attributions and Contest Disclosures

## 1. Pre-existing Work & Starter Template
- **Starter Template**: Based on `https://github.com/fe-lang/builders-challenge-starter` (commit `f9d9aa9`).
- **Tag**: Tagged in git as `starter`.
- **License**: Apache-2.0 preserved from starter template.
- **Repository**: `https://github.com/devprashant19/Leash.git`

## 2. Reused Code and Standard Interfaces
- **Safe Smart Account Interface**: Standard `ModuleManager.execTransactionFromModule(address to, uint256 value, bytes data, uint8 operation) returns (bool success)` selector (`0x468721a7`) and calling convention.
- **ERC-20 Interface**: Standard selectors for:
  - `transfer(address,uint256)` (`0xa9059cbb`)
  - `approve(address,uint256)` (`0x095ea7b3`)
  - `transferFrom(address,address,uint256)` (`0x23b872dd`)
  - `increaseAllowance(address,uint256)` (`0x39509351`)
  - `decreaseAllowance(address,uint256)` (`0xa457c2d7`)
  - `balanceOf(address)` (`0x70a08231`)
  - `allowance(address,address)` (`0xdd62ed3e`)
- **DeFi & Router Interfaces**: Standard selectors for:
  - Uniswap V2 `swapExactTokensForTokens(uint256,uint256,address[],address,uint256)` (`0x38ed1739`)
  - Uniswap V3 `exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))` (`0x04e45aaf`)
- **Standard Library**: Fe standard library modules (`core`, `std`) from `argotorg/fe` tag `v26.6.0`.
- **Foundry Tools**: Anvil local testnet and Cast CLI from Foundry v1.9.0.
- **Web demo libraries** (Vercel page only, not the Fe code): `@ethereumjs/vm`, `@ethereumjs/tx`, `@ethereumjs/block`, `@ethereumjs/common`, `@ethereumjs/util` 10.1.3 (in-memory EVM that runs the Fe-compiled contracts) and `viem` (ABI encoding); for the page itself React, `motion` (Framer Motion), `lenis`, Vite and the self-hosted Newsreader, Inter and Geist Mono fonts, all pinned in `package.json`. The page’s visual and motion design was inspired by a public website; no assets, text or code from it are used.

## 3. AI Assistance Declaration
- Development of the Leash codebase was assisted by agentic AI engineering workflows (Google DeepMind Antigravity / Claude Code) following strict engineering rules (`AGENTS.md`).
- **Logged AI-assisted entries**: the entries in `docs/ai-log.md` cover Phases 0–7, roadmap Stages 9–12, the release fixes, the Vercel page and its redesign, the 2026-11-16 clean-up, the 2026-11-17 fixes, and the technical audit. Some entries carry planned dates rather than commit dates; `git log` has the actual dates.
- **Commit Timestamps Disclosure**: 21 commits (6d7e742 through 699adc6) carry hand-set timestamps between Nov 14 and Nov 16. Their dates do not reflect when they were written: they were pushed together on 2026-11-16 at about 13:37 UTC (the CI run for 32d0902). All code, contracts, tests and documentation were written within the contest period (Nov 3–24).
- **AI-generated material that was removed on 2026-11-16** after review found it did not match the code: TypeScript and Python "SDK" packages and a "WASM" simulator (hand-written approximations of the rules), a deployments registry listing testnet deployments that do not exist on-chain, a self-written "security audit" and an informal "formal specification", and canned fallback results in the API and the page. Git history keeps them for reference.
- On 2026-11-17 main was briefly replaced by a squashed, re-dated history (5 commits ending at 8a3e7bc, kept on branch backup/squashed-2026-11-17). It was reverted the same day to the original commits; no code changed.
- **Security Hardening & Scaffolding Pruning (2026-11-16)**: The experimental `LeashQueue` contract was removed after security review identified that its caller interface bypassed policy validation. Dummy placeholder tests (`attack_13`) were removed, and internal planning scaffolding (`phases/`, `.claude/`, `CLAUDE.md`, future handoff notes) was completely pruned.
- **Fixes after review (2026-11-17, AI-assisted with Claude Code)**: the Vercel functions crashed on load (`ERR_REQUIRE_ESM`) and now run from an esbuild bundle; the per-token 24 h cap (`max_per_window`, new code 21) is enforced on-chain and off-chain; the Uniswap guard, whose decoder read the wrong calldata offsets, now refuses every router call; `decide_with_override`, the EIP-712 override module, the policy queue module and per-agent caps (`setAgentPolicy`, `fingerprintOf`) were removed; `LeashModule` stores the ledger before calling the Safe. Details and verification output are in `docs/ai-log.md`.
- **Technical Quality & Audit Updates (2026-11-17, AI-assisted with Antigravity)**: Addressed independent reviewer evaluation. Documented EVM state rollback semantics for the circuit breaker (`execute` atomic revert vs `tryExecute` denial recording & trip); upgraded `scripts/compile-fail.sh` to assert specific compiler error diagnostics; clarified 10,000-transaction parity test execution (EVM runs all 10,000 txs live; native runs chunk 0 live and compares chunks against golden digests); documented the 56 storage words (~300k gas) bounded $O(1)$ ring buffer trade-off; and clarified default policy configuration vs production customization.

- **Audit Log**: Every AI-assisted code change, test execution, architectural decision, and raw compiler/test verification output is permanently recorded in [`docs/ai-log.md`](docs/ai-log.md).
- **Human Steering**: The human engineer provided the project vision, high-level requirements, contest registration, cryptographic and security constraints, review gating, and final sign-off. The AI acted as the lead implementation engineer executing strictly test-driven development (TDD), writing failing tests first, implementing minimal passing code, running cross-backend verification, and assembling deliverables.

