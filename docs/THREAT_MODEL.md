# THREAT_MODEL.md — Leash Security and Threat Model

*Status: Draft created in Phase 0. Phase 2 populates detailed attack vectors and invariants.*

## 1. Assets and Trust Boundaries
- **Safe Treasury**: High-value multi-sig account. Must never execute unapproved or out-of-policy calls.
- **LeashModule**: Trusted module authorized by the Safe owners.
- **AI Agent**: Semi-trusted session key holder. Susceptible to prompt injection, hallucination, or private key leakage.
- **Guardian**: Partially trusted entity authorized strictly to pause.

## 2. Attack Vectors to Mitigate
1. **DelegateCall MultiSend Hijack**: Agent attempts `DELEGATECALL` to an arbitrary contract to execute code in the Safe's storage context.
2. **Unlimited Approvals**: Agent attempts `approve(spender, type(uint256).max)` to bypass spending caps.
3. **Rolling Window Spanning / Drain Attack**: Rapid bursts of transactions near bucket boundaries.
4. **Reentrancy**: Re-entering the module before ledger updates complete.
5. **Calldata Smuggling**: Truncated or malformed calldata designed to confuse ABI decoders.
6. **Off-Chain / On-Chain Drift**: Discrepancies between off-chain predictions and on-chain verdicts.
