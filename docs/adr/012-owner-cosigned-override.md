# ADR-012: Owner Co-signed EIP-712 Spending Overrides

## Status
Accepted

## Context
In exceptional circumstances (such as emergency rebalancing, urgent debt repayment, or scheduled treasury operations), an agent may need to exceed its configured per-transaction, rolling window, or token spending caps without waiting for contract reconfiguration or redeployment.

## Decision
We implement Owner Co-signed Overrides (`decide_with_override` in policy, `ExecuteWithOverride` in `LeashQueue`):
1. **EIP-712 Typed Structured Data**:
   - Domain: `name = "Leash"`, `version = "1"`, `chainId`, `verifyingContract = LeashQueue`.
   - Type: `Override(address agent,address to,uint256 value,bytes32 dataHash,uint8 operation,uint256 nonce,uint256 deadline)`.
   - Verified with canonical cryptographic hygiene:
     - `ecrecover` signature recovery.
     - Strict `v ∈ {27, 28}` and `s ≤ secp256k1_n / 2` (EIP-2 malleability protection).
     - Signer authorization check via Safe: `safe.isOwner(signer) == true`.
     - Monotonically increasing agent nonce (`agent_nonces[agent]`) preventing replay attacks.
     - Deadline check (`now <= deadline`).
2. **Selective Bypass Invariants**:
   - An override **only** bypasses spending ceilings: `PerTxCapExceeded`, `WindowCapExceeded`, and `TokenCapExceeded`.
   - An override **never** bypasses structural security controls:
     - `DelegateCallBlocked` (code 3) remains strictly blocked.
     - `TargetNotAllowed` (code 4) remains strictly blocked.
     - `Paused` (code 1) remains strictly blocked.
     - `SessionExpired` (code 2) remains strictly blocked.
     - `CircuitTripped` (code 15) remains strictly blocked.
     - `RecipientNotAllowed` (code 11) remains strictly blocked.
     - `SwapNotAllowed` MEV sandwich protection (code 16) remains strictly blocked.
3. **CLI Parity**:
   - `leash check --override` uses `policy::decide_with_override` to predict verdicts with 100% agreement against on-chain behavior.

## Consequences
- Human Safe owners can authorize emergency actions without relaxing long-term agent permissions.
- Spending state is recorded against the window to maintain accounting history.

