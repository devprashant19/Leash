# DECLARATION.md — Attributions and Contest Disclosures

## 1. Pre-existing Work
- **Starter Template**: Based on `https://github.com/fe-lang/builders-challenge-starter` (commit `f9d9aa9`).
- **Tag**: Tagged in git as `starter`.
- **License**: Apache-2.0 preserved from starter template.

## 2. Reused Code and Standard Interfaces
- **Safe Smart Account Interface**: Standard `ModuleManager.execTransactionFromModule(address to, uint256 value, bytes data, uint8 operation) returns (bool success)` selector and calling convention.
- **ERC-20 Interface**: Standard selectors for `transfer(address,uint256)`, `approve(address,uint256)`, `transferFrom(address,address,uint256)`, `balanceOf(address)`, `allowance(address,address)`.
- **Standard Library**: Fe standard library modules (`core`, `std`) from `argotorg/fe` tag `v26.6.0`.

## 3. AI Assistance Declaration
- Development was assisted by Claude / Google DeepMind agentic tools following rigorous engineering guidelines.
- Every AI-assisted change, decision, and verification command output is recorded in [docs/ai-log.md](docs/ai-log.md).
- Architectural reviews, threat model evaluations, and TDD verification were performed across all phases.
