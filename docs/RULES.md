# RULES.md — Policy Rule Evaluation Specification (A12)

Every transaction evaluated by `policy::decide` follows a deterministic, non-branching order of checks. Cheapest and most severe checks are executed first. **The first failing rule terminates evaluation and returns that denial reason.**

## Evaluation Order Table

| Step | Rule | Deny Reason | Code | Inputs | Rationale for Position |
|---|---|---|---|---|---|
| 1 | Global Pause | `Paused` | 1 | `state.paused` | Cheapest global kill-switch. If paused, zero compute should be spent. |
| 2 | Circuit Breaker | `CircuitTripped` | 15 | `state.tripped` | Halts automated execution after consecutive denial threshold. |
| 3 | Session Expiry | `SessionExpired` | 2 | `tx.now`, `state.expiry` | Immediate timestamp check. Expired sessions are invalid regardless of action. |
| 4 | Cooldown Period | `CooldownActive` | 13 | `tx.now`, `state.last_action`, `policy.cooldown` | Prevents rapid back-to-back tx bursts. |
| 5 | DelegateCall Safety | `DelegateCallBlocked` | 3 | `tx.op`, `target.delegate_ok` | Evaluated before targets because unverified DelegateCall is critical code execution risk. |
| 6 | Target Allowlist | `TargetNotAllowed` | 4 | `tx.to`, `policy.targets` | Default-deny target filter. Address zero is always denied. |
| 7 | Calldata & Selector | `MalformedCalldata` / `SelectorNotAllowed` | 6 / 5 | `tx.data`, `target.selectors`, `target.allow_eth_transfer` | Validates calldata structure before reading amounts. 0 bytes requires allow_eth_transfer. |
| 8 | Rate Limit | `RateLimited` | 12 | `state.action_window`, `policy.max_actions_per_window` | Guards against spamming actions within sliding window. |
| 9 | ETH Per-Tx Cap | `PerTxCapExceeded` | 7 | `tx.value`, `policy.max_per_tx` | Simple scalar check on native ETH value. |
| 10 | ETH Window Cap | `WindowCapExceeded` | 8 | `state.eth_window`, `tx.value`, `policy.max_per_window` | 24-hour rolling bucket window spend check. Checked addition with saturation. |
| 11 | Protocol Guards | `RecipientNotAllowed` / `UnlimitedApproval` / `TokenCapExceeded` / `SwapNotAllowed` | 11 / 10 / 9 / 16 | `tx.data`, `policy.tokens`, `policy.recipients` | Protocol-specific parsing: recipient allowlist -> approval hygiene -> spend caps -> MEV protection. |
| 12 | Escalation Threshold | `EscalationRequired` | 20 | `tx.value`, `escalation_threshold` | Queues large allowed transactions for Safe timelock review before execution. |
| 13 | Allow | `Verdict::Allow` | 0 | All previous checks passed | Safe transaction permitted for execution. |

---

## Detailed Rule Specifications

### 1. Paused (`code 1`)
- **Inputs**: `state.paused: bool`
- **Deny Reason**: `DenyReason::Paused`
- **Edge cases**: Guardian sets pause on anomalous agent behavior; all agent calls are halted immediately.

### 2. CircuitTripped (`code 15`)
- **Inputs**: `state.tripped: bool`
- **Deny Reason**: `DenyReason::CircuitTripped`
- **Edge cases**: If enabled (`breaker_threshold > 0`), consecutive policy rejections trip the breaker. Requires guardian reset.

### 3. SessionExpired (`code 2`)
- **Inputs**: `tx.now: Timestamp`, `state.expiry: Timestamp`
- **Deny Reason**: `DenyReason::SessionExpired`
- **Edge cases**: If `state.expiry == 0`, session expiry rule is disabled (indefinite session). If `tx.now >= state.expiry`, denied.

### 4. CooldownActive (`code 13`)
- **Inputs**: `tx.now: Timestamp`, `state.last_action: Timestamp`, `policy.cooldown: Duration`
- **Deny Reason**: `DenyReason::CooldownActive`
- **Edge cases**: If `policy.cooldown == 0` or `state.last_action == 0`, cooldown is inactive. If `tx.now < state.last_action + cooldown`, transaction is denied.

### 5. DelegateCallBlocked (`code 3`)
- **Inputs**: `tx.op: Operation`, `target.delegate_ok: bool`
- **Deny Reason**: `DenyReason::DelegateCallBlocked`
- **Edge cases**: Evaluated before target lookups. Any `Operation::DelegateCall` is blocked unless `target.delegate_ok == true` (false by default). Prevents storage takeover of the Safe.

### 6. TargetNotAllowed (`code 4`)
- **Inputs**: `tx.to: Address`, `policy.targets: [TargetRule; MAX_TARGETS]`
- **Deny Reason**: `DenyReason::TargetNotAllowed`
- **Edge cases**: Empty policy (`n_targets == 0`) denies all targets. Address zero `0x000...000` is always denied. Unlisted targets are denied.

### 7. Calldata & Selector Shape (`code 6` & `code 5`)
- **Inputs**: `tx.data: Calldata`, `target.selectors: [u32; MAX_SELECTORS]`, `target.allow_eth_transfer: bool`
- **Deny Reasons**: `DenyReason::MalformedCalldata` (code 6), `DenyReason::SelectorNotAllowed` (code 5)
- **Edge cases**:
  - `data.len == 0`: Plain ETH transfer. Allowed if and only if `target.allow_eth_transfer == true`; otherwise `SelectorNotAllowed`.
  - `1 <= data.len < 4`: Truncated calldata returns `MalformedCalldata`.
  - Selector not found in `target.selectors[0..n_selectors]`: Returns `SelectorNotAllowed`.

### 8. RateLimited (`code 12`)
- **Inputs**: `state.action_window: Window24`, `policy.max_actions_per_window: u32`
- **Deny Reason**: `DenyReason::RateLimited`
- **Edge cases**: If `max_actions_per_window == 0`, rate limiting is disabled. Otherwise, sums hourly action buckets in the active 24h window.

### 9. PerTxCapExceeded (`code 7`)
- **Inputs**: `tx.value: Wei`, `policy.max_per_tx: Wei`
- **Deny Reason**: `DenyReason::PerTxCapExceeded`
- **Edge cases**: Strictly typed unit comparison (`Wei > Wei`). `value == cap` is allowed; `value == cap + 1 wei` is denied.

### 10. WindowCapExceeded (`code 8`)
- **Inputs**: `state.eth_window: Window24`, `tx.value: Wei`, `policy.max_per_window: Wei`
- **Deny Reason**: `DenyReason::WindowCapExceeded`
- **Edge cases**: Sums active hourly buckets where `bucket_index > current_index - 24`. Saturated checked addition prevents `u256` overflow.

### 11. Protocol Guards (ERC-20, Uniswap Router, and Aave Pool)
- **Inputs**: `tx.data: Calldata`, `policy.tokens: [TokenRule; MAX_TOKENS]`, `policy.recipients: [Address; MAX_RECIPIENTS]`, `target.kind: TargetKind`
- **Deny Reasons**: `TokenCapExceeded` (9), `UnlimitedApproval` (10), `RecipientNotAllowed` (11), `MalformedCalldata` (6), `SwapNotAllowed` (16), `LendingNotAllowed` (17)
- **ERC-20 Guard Edge Cases**:
  - Target must have a matching `TokenRule`; if missing, defaults to deny (`TokenCapExceeded`).
  - Calldata lengths: `transfer` must be exactly 68 bytes; `approve` exactly 68 bytes; `increaseAllowance` exactly 68 bytes; `decreaseAllowance` exactly 68 bytes; `transferFrom` exactly 100 bytes. Longer or shorter calldata returns `MalformedCalldata`.
  - Address words must have high 12 bytes zeroed; dirty address words return `MalformedCalldata`.
  - `approve(spender, 0)` and `decreaseAllowance` are allowed (hygienic limit reduction).
  - `increaseAllowance(spender, type(uint256).max)` and `increaseAllowance(spender, amount > max_approve)` return `UnlimitedApproval`.
  - `increaseAllowance` to non-allowlisted spender returns `RecipientNotAllowed`.
- **Uniswap Guard Edge Cases**:
  - Target kind `UniswapRouter` (`0x7a25...` or SwapRouter02).
  - Selectors: `SEL_UNISWAP_V2_SWAP_TOKENS` (`0x38ed1739`) and `SEL_UNISWAP_V3_EXACT_INPUT_SINGLE` (`0x04e45aaf`).
  - **MEV Sandwich Protection**: Zero minimum output (`amountOutMin == 0`) is strictly denied with `SwapNotAllowed` (code 16) to prevent 100% slippage frontrunning.
  - Swap input amounts exceeding token caps return `TokenCapExceeded` (code 9).
  - Unauthorized selectors on the router return `SwapNotAllowed` (code 16).
- **Aave v3 Pool Guard Edge Cases**:
  - Target kind `AavePool` (`0x6ae4...` or Pool v3).
  - Selector: `withdraw(address,uint256,address)` (`0x69328dec`).
  - Strict 100-byte calldata shape and address sanitization (`is_address_word`).
  - Withdrawn destination `to` must be on recipient allowlist (`RecipientNotAllowed`, code 11) to prevent diverting collateral to attacker accounts.
  - Withdrawn asset must be allowlisted in `policy.tokens` and must not exceed per-tx token cap (`TokenCapExceeded`, code 9).
  - Unauthorized selectors on the pool return `LendingNotAllowed` (code 17).

### 12. EscalationRequired (`code 20`)
- **Inputs**: `tx.value: Wei`, `escalation_threshold: Wei`
- **Deny Reason**: `DenyReason::EscalationRequired`
- **Edge cases**:
  - Evaluated **after** all security checks and spend caps pass.
  - If `escalation_threshold > 0` and `tx.value > escalation_threshold`, execution direct from the agent is withheld with `EscalationRequired`.
  - Transaction enters `LeashQueue` with timelock delay (`ready_at = now + delay_sec`).
  - Safe owners can veto any queued transaction during the timelock window.

### 13. USD-Denominated Caps (`decide_with_usd`)
- **Inputs**: `tx.value: Wei`, `price_quote: Option<PriceQuote>`, `max_usd_per_tx: u256`, `max_price_age: Duration`
- **Deny Reasons**: `PriceUnavailable` (18), `UsdCapExceeded` (19)
- **Edge cases**:
  - Missing oracle quote (`None`), zero price (`usd_per_eth_1e8 == 0`), futuristic timestamp (`tx.now < quote.updated_at`), or stale price (`tx.now > quote.updated_at + max_price_age`) returns `PriceUnavailable` (code 18).
  - USD equivalent calculated via `(tx.value * quote.usd_per_eth_1e8) / 1e18`.
  - Exceeding `max_usd_per_tx` returns `UsdCapExceeded` (code 19).

---

## Owner Co-Signed Overrides (`decide_with_override`)

When a transaction carries an EIP-712 signature from a verified Safe owner:
- **Allowed Bypasses**: Bypasses `PerTxCapExceeded` (code 7), `WindowCapExceeded` (code 8), and `TokenCapExceeded` (code 9).
- **Strictly Enforced Controls**:
  - `Paused` (code 1) is **never** bypassed.
  - `SessionExpired` (code 2) is **never** bypassed.
  - `DelegateCallBlocked` (code 3) is **never** bypassed.
  - `TargetNotAllowed` (code 4) is **never** bypassed.
  - `MalformedCalldata` (code 6) is **never** bypassed.
  - `CircuitTripped` (code 15) is **never** bypassed.
  - `SwapNotAllowed` MEV zero-slippage protection (code 16) is **never** bypassed.
- **Accounting Invariant**: Override spends are still recorded against the rolling window.
- **Replay Protection**: Nonce incremented per-agent in `LeashQueue`.

