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
  - `balanceOf(address)` (`0x70a08231`)
  - `allowance(address,address)` (`0xdd62ed3e`)
- **Standard Library**: Fe standard library modules (`core`, `std`) from `argotorg/fe` tag `v26.6.0`.
- **Foundry Tools**: Anvil local testnet and Cast CLI from Foundry v1.9.0.

## 3. AI Assistance Declaration
- Development of the Leash codebase was assisted by agentic AI engineering workflows (Google DeepMind Antigravity / Claude Code) following strict engineering rules (`AGENTS.md`).
- **Total Logged AI Milestones**: 12 verified engineering milestones logged across Phases 0 through 7.
- **Audit Log**: Every AI-assisted code change, test execution, architectural decision, and raw compiler/test verification output is permanently recorded in [`docs/ai-log.md`](docs/ai-log.md).
- **Human Steering**: The human engineer provided the project vision, high-level requirements, contest registration, cryptographic and security constraints, review gating, and final sign-off. The AI acted as the lead implementation engineer executing strictly test-driven development (TDD), writing failing tests first, implementing minimal passing code, running cross-backend verification, and assembling deliverables.

