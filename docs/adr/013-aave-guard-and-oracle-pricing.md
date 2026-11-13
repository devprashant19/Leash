# ADR-013: Aave v3 Lending Guard and Chainlink USD-Denominated Caps

## Status
Accepted

## Context
Autonomous agents interacting with decentralized finance require protocol-specific semantic inspection beyond raw ERC-20 transfer and approval rules. Specifically:
1. **Lending Protocol Interactions**: Unconstrained calls to Aave v3 `withdraw` functions could allow an attacker or misconfigured agent to divert withdrawn collateral or underlying assets to an arbitrary unapproved destination address or exceed token caps.
2. **Volatile Market Exposure**: ETH-denominated transaction caps fail to protect treasury value when ETH price fluctuates significantly. A 0.5 ETH transaction could be worth \$1,000 or \$2,500 depending on market conditions. Real-world treasury risk controls require USD-denominated transaction caps anchored by reliable price oracles with strict staleness bounds.

## Decision
We implement Aave v3 Lending Guards and Chainlink-compatible Oracle USD Caps:

1. **Aave v3 Semantic Guard (`TargetKind::AavePool` & `check_aave_guard`)**:
   - Selector: `withdraw(address,uint256,address)` (`0x69328dec`).
   - Calldata Validation:
     - Strict 100-byte ABI calldata layout.
     - Address sanitization: leading 12 dirty bytes rejected with `MalformedCalldata` (code 6).
   - Recipient Enforcement:
     - Destination `to` address validated against policy recipient allowlist (`is_recipient_allowed`).
     - Unauthorized destination rejected with `RecipientNotAllowed` (code 11).
   - Token Cap Enforcement:
     - Withdrawn `asset` must match allowlisted token rule (`policy.tokens`).
     - Unlisted asset or exceeding per-tx token cap rejected with `LendingNotAllowed` (code 17) or `TokenCapExceeded` (code 9).
   - Trait Integration:
     - Implemented via `AaveGuard` satisfying `ActionGuard` trait in `ingots/policy/src/guard.fe`.

2. **USD-Denominated Caps with Staleness Checking (`decide_with_usd`)**:
   - Pure policy evaluation with optional `PriceQuote { usd_per_eth_1e8: u256, updated_at: Timestamp }`.
   - Staleness Validation:
     - If price quote is missing, zero, in the future, or older than `max_price_age`: rejected with `PriceUnavailable` (code 18).
   - Valuation & Cap Enforcement:
     - Effective USD spend: `(tx.value * quote.usd_per_eth_1e8) / 1e18`.
     - Exceeding `max_usd_per_tx`: rejected with `UsdCapExceeded` (code 19).

3. **Compiler Headroom Optimization**:
   - Replaced large struct by-value copies with index-based references (`find_target_idx`, `find_token_rule_idx`).
   - Direct field mutation in `policy_for_agent` avoiding multi-kilobyte struct literal emissions in contract bytecode.
   - Reused loaded window memory in module evaluation, reducing `LeashModule` runtime bytecode to 22,029 bytes (2,547 bytes headroom below EIP-170 limit, with 0 compiler warnings).

## Consequences
- Agents can safely supply and withdraw from Aave v3 with mathematical proof that funds cannot be diverted to rogue recipients.
- Safe treasuries can set immutable USD-denominated spending limits protected against oracle staleness.
- Bytecode size remains comfortably below the EVM runtime cap.
