# RULES.md — Policy Rule Evaluation Specification (A12)

Every transaction goes through `policy::decide_spend` (`ingots/policy/src/rules.fe`); `decide` returns its verdict. The checks run in a fixed order, cheapest and most severe first. **The first failing rule ends evaluation and returns that denial reason.** Anything not explicitly allowlisted is denied.

`decide_spend` also reports, for an allowed call, the tokens it moves under a token rule. `record` books exactly that amount, so the check and the ledger never read the calldata differently.

## Evaluation order

| Step | Rule | Deny reason | Code | Inputs |
|---|---|---|---|---|
| 1 | Global pause | `Paused` | 1 | `state.paused` |
| 2 | Circuit breaker | `CircuitTripped` | 15 | `state.tripped` |
| 3 | Session expiry | `SessionExpired` | 2 | `tx.now`, `state.expiry` |
| 4 | Cooldown | `CooldownActive` | 13 | `tx.now`, `state.last_action`, `policy.cooldown` |
| 5 | Delegatecall | `DelegateCallBlocked` | 3 | `tx.op` |
| 6 | Target allowlist | `TargetNotAllowed` | 4 | `tx.to`, `policy.targets` |
| 7 | Calldata and selector | `MalformedCalldata` / `SelectorNotAllowed` | 6 / 5 | `tx.data`, `target.selectors`, `target.allow_eth_transfer` |
| 8 | Rate limit | `RateLimited` | 12 | `state.action_window`, `policy.max_actions_per_window` |
| 9 | ETH per-transaction cap | `PerTxCapExceeded` | 7 | `tx.value`, `policy.max_per_tx` |
| 10 | ETH 24 h window | `WindowCapExceeded` | 8 | `state.eth_window`, `tx.value`, `policy.max_per_window` |
| 11 | Protocol guards | see below | 6, 9, 10, 11, 16, 17, 21 | `tx.data`, `policy.tokens`, `policy.recipients`, `state.token_spent` |
| — | Allow | `Verdict::Allow` | 0 | every check passed |

Codes 14 (`OutsideTradingHours`), 18–20 are produced by the variants described at the end, not by `decide`. Codes are append-only: none is ever renumbered or reused.

## The default policy

`policy::config::default_policy()` is what `LeashModule` enforces for every agent and what the `leash` CLI predicts with. Its fingerprint is `0x3efcfc58aec5d1e7e81b5bded7820ed3ed8a0e654cf4aff3bfb793a7494ae6ee`.

- Targets: the treasury (`0x2000…0002`, plain ETH only, no selectors) and the token (`0x1000…0001`, `approve`, `transferFrom`, `transfer`).
- ETH: 0.1 ETH per transaction, 0.5 ETH per rolling 24 h.
- Token: 100 tokens per transfer, 500 tokens per 24 h period, approvals up to 100 tokens.
- No recipient allowlist (any recipient passes rule 11), no rate limit, no cooldown.

## Rule details

### 1. Paused (code 1)
`state.paused`. Set by the guardian or the Safe with `pause()`; only the Safe can `unpause()`.

### 2. CircuitTripped (code 15)
`state.tripped`. `LeashModule` counts calls refused through `tryExecute` and trips the breaker at `policy::BREAKER_DENIALS` (3), via `policy::breaker_trips`. Allowed calls do not reset the count, and refusals through `execute` revert instead of counting. Only the Safe can reset it, with `resetBreaker(agent)`; `setAgent` also clears it. The policy's `breaker_threshold` field is part of the fingerprinted encoding but is not read.

### 3. SessionExpired (code 2)
Denied when `state.expiry > 0` and `tx.now >= state.expiry`. `expiry == 0` means no expiry. `LeashModule.setAgent` refuses an expiry that is not in the future.

### 4. CooldownActive (code 13)
Denied when `policy.cooldown > 0`, `state.last_action > 0` and `tx.now < state.last_action + cooldown`. Off in the default policy.

### 5. DelegateCallBlocked (code 3)
Every `Operation::DelegateCall` is denied, before target lookup. A delegatecall would run foreign code with the Safe's storage. The `delegate_ok` target field is part of the fingerprinted encoding but is not read.

### 6. TargetNotAllowed (code 4)
`tx.to` must be one of `policy.targets[0..n_targets]`. The zero address is always denied.

### 7. Calldata and selector (codes 6 and 5)
- No calldata: a plain ETH transfer, allowed only when `target.allow_eth_transfer`; otherwise `SelectorNotAllowed`.
- 1 to 3 bytes: `MalformedCalldata`.
- A selector not in `target.selectors[0..n_selectors]`: `SelectorNotAllowed`.

### 8. RateLimited (code 12)
Denied when `max_actions_per_window > 0` and the actions in the last 24 hourly buckets, plus this one, exceed it. Off in the default policy, and `LeashModule` stores no action window.

### 9. PerTxCapExceeded (code 7)
`tx.value > policy.max_per_tx` (typed `Wei` comparison). The cap itself is allowed; cap + 1 wei is denied.

### 10. WindowCapExceeded (code 8)
ETH spent in the last 24 hourly buckets (`spent_in_window`) plus `tx.value`, with saturating addition, must not exceed `policy.max_per_window`. The window slides hour by hour.

### 11. Protocol guards
Chosen by the target's `kind`.

**ERC-20** (`TargetKind::Erc20`):
- The target needs a token rule in `policy.tokens`; without one, `TokenCapExceeded` (9).
- Calldata shape: `transfer`, `approve`, `increaseAllowance` and `decreaseAllowance` exactly 68 bytes, `transferFrom` exactly 100 bytes, address words with the high 12 bytes zero; otherwise `MalformedCalldata` (6). (The default policy allowlists only `approve`, `transferFrom` and `transfer`.)
- `transfer` and `transferFrom`, in order: the recipient must be allowlisted when a recipient list exists (`RecipientNotAllowed`, 11); the amount must not exceed `max_per_tx` (`TokenCapExceeded`, 9); and the tokens moved in the current 24 h period plus this amount must not exceed `max_per_window` (`TokenWindowCapExceeded`, 21).
- `approve(spender, 0)` is always allowed (revocation). Otherwise the spender must pass the recipient list (11), and an amount of 2^256 − 1 or above `max_approve` is `UnlimitedApproval` (10). Approvals are not counted in the token window.

**Token window (code 21).** Each token rule's `max_per_window` applies per fixed 24 h period: period `n` covers `[n × 86400, (n + 1) × 86400)` seconds, so periods start at 00:00 UTC. `state.token_spent[i]` holds `(period, amount)` for token rule `i`; a new period starts from zero. Unlike the ETH window, which slides hour by hour, this is a fixed window: an agent can move up to the cap just before a period ends and up to the cap again just after, so at most twice the cap within a short span across the boundary. It costs two storage words per token rule, against 48 for a sliding window.

**Aave pool** (`TargetKind::AavePool`):
- Only `withdraw(address,uint256,address)` (`0x69328dec`); any other selector is `LendingNotAllowed` (17).
- Exactly 100 bytes with clean address words, or `MalformedCalldata` (6).
- The asset needs a token rule (`LendingNotAllowed`, 17), then the same recipient (11), per-transfer (9) and 24 h period (21) checks as an ERC-20 transfer, counted under that token rule.

**Uniswap router** (`TargetKind::UniswapRouter`): always `SwapNotAllowed` (16). A swap's recipient and token path lie past the 100 calldata bytes the policy decodes (`MAX_CALLDATA`), so the policy cannot check where the output goes, and refuses. Checked swaps are on the roadmap.

The default policy lists no Aave pool or router; those guards apply to custom policies only.

## Variants built on `decide`

These wrap `decide` and add one rule after it allows a call. `LeashModule` and the CLI use plain `decide`.

- `decide_with_escalation(tx, policy, state, threshold)`: `EscalationRequired` (20) when `threshold > 0` and `tx.value > threshold`.
- `decide_with_usd(tx, policy, state, quote, max_usd_per_tx, max_price_age)`: `PriceUnavailable` (18) for a missing, zero, future-dated or stale quote; `UsdCapExceeded` (19) when `tx.value × usd_per_eth_1e8 / 1e18 > max_usd_per_tx`.
- `OutsideTradingHours` (14) exists in the enum only; no rule produces it yet.

## Recording

`record(tx, policy, state)` books an allowed call: its ETH in the hourly ETH window, the token amount `decide_spend` reported in that token rule's period, one action in the action window, and `last_action`. `LeashModule` calls `record_allowed` with the same decision before it calls the Safe (checks-effects-interactions), and stores the ETH window and the token periods per agent. A denied call records nothing.
