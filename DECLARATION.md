# DECLARATION.md — Attributions and Contest Disclosures

## 1. Pre-existing Work & Starter Template
- **Starter Template**: Based on `https://github.com/fe-lang/builders-challenge-starter` (tagged `starter`).
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
- **Workflow & Division of Labor**: Development was assisted by agentic AI engineering workflows (Google DeepMind Antigravity / Claude Code) following strict engineering rules (`AGENTS.md`). The human author provided project specifications, architecture design, cryptographic constraints, security review, and final release sign-off; the AI agents drafted code, test suites, and documentation subject to human approval and automated compiler gates.
- **Audit Trail**: Every AI-assisted code change, test execution, architectural decision, and compiler verification receipt is logged chronologically in [`docs/ai-log.md`](docs/ai-log.md).
- **Commit History & Dates**: 21 commits dated Nov 14–16 carry hand-set dates; they were pushed together on Nov 16. All work was performed within the contest window.
- **History Rewrites**: On Nov 17 `main` was briefly replaced by a squashed history and restored the same day, and again on Nov 18 to drop one docs commit; no code changed.
- **Removed Early Scaffolding (Nov 16)**: Early AI iterations generated mock SDKs (TypeScript/Python) and a "WASM" simulator (hand-written approximations of the rules), a deployments registry listing testnet deployments that do not exist on-chain, an informal specification, a self-written security audit, canned fallback results in the API and the page, and an experimental queue contract (`LeashQueue`). These were removed when review found they did not match the Fe code; git history preserves them for reference.
- **Scripted Demonstrations**: The adversarial prompt-injection defense demo (`npm run demo:injection`) uses scripted tool calls to demonstrate deterministic policy enforcement rather than invoking live external LLMs.

