# RULES.md — Policy Rule Evaluation Order (A12)

Every transaction evaluated by `policy::decide` follows a deterministic, non-branching order of checks. Cheapest and most severe checks are executed first. **The first failing rule terminates evaluation and returns that denial reason.**

## Evaluation Order

1. **Paused** (`code 1`): If `state.paused` is true (kill switch active), deny `Paused`.
2. **CircuitTripped** (`code 15`): If consecutive denials in the window exceeded the breaker threshold, deny `CircuitTripped`.
3. **SessionExpired** (`code 2`): If `tx.now >= state.expiry`, deny `SessionExpired`.
4. **OutsideTradingHours** (`code 14`): If policy has an active schedule and `tx.now` is outside allowed trading hours, deny `OutsideTradingHours`.
5. **CooldownActive** (`code 13`): If `tx.now < state.last_action + policy.cooldown`, deny `CooldownActive`.
6. **DelegateCallBlocked** (`code 3`): If `tx.op == Operation::DelegateCall` and the target rule does not explicitly allow delegatecalls, deny `DelegateCallBlocked`.
7. **TargetNotAllowed** (`code 4`): If `tx.to` is not in `policy.targets`, deny `TargetNotAllowed`.
8. **Calldata Validation**:
   - If calldata is malformed or truncated, deny `MalformedCalldata` (`code 6`).
   - If selector is not allowlisted for this target, deny `SelectorNotAllowed` (`code 5`).
9. **RateLimited** (`code 12`): If `policy.max_actions_per_window > 0` and current actions in the rolling window equal or exceed the limit, deny `RateLimited`.
10. **PerTxCapExceeded** (`code 7`): If `tx.value > policy.max_per_tx`, deny `PerTxCapExceeded`.
11. **WindowCapExceeded** (`code 8`): If `eth_spent_in_window + tx.value > policy.max_per_window`, deny `WindowCapExceeded`.
12. **Protocol Guards (e.g. ERC-20)**:
    - If `target.kind == TargetKind::Erc20`:
      - If recipient is not allowlisted, deny `RecipientNotAllowed` (`code 11`).
      - If approval amount is `type(uint256).max` or exceeds `token_rule.max_approve`, deny `UnlimitedApproval` (`code 10`).
      - If token spend exceeds per-tx or window caps, deny `TokenCapExceeded` (`code 9`).
    - If `target.kind == TargetKind::UniswapRouter`:
      - Decode swap params; if disallowed token or slippage, deny `SwapNotAllowed` (`code 16`).
13. **USD Caps & Oracles**:
    - If oracle returns zero or stale price, deny `PriceUnavailable` (`code 18`).
    - If total USD value exceeds cap, deny `UsdCapExceeded` (`code 19`).
14. **Escalation Queue**:
    - If value exceeds instant-execution threshold, deny `EscalationRequired` (`code 20`).
15. **Allow** (`code 0`): All checks passed. Return `Verdict::Allow`.
