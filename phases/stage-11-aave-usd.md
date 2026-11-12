# Stage 11 — Aave guard (C3) and USD-denominated caps (C4)

| | |
|---|---|
| **When** | After stage 9 (needs the `ActionGuard` trait) |
| **Depends on** | Stage 9 |
| **Exit check** | Stale-feed and wrong-beneficiary tests |
| **Skills** | superpowers TDD, addy security-and-hardening |

---

## C3 — Aave guard (`LendingNotAllowed`, code 17)

Target kind `AavePool` (Aave v3 Pool; get the Sepolia address from Aave's official address book, not from memory).

- [ ] Implement `AaveGuard: ActionGuard`. Decode:
  - `supply(address asset,uint256 amount,address onBehalfOf,uint16 referralCode)`
  - `withdraw(address asset,uint256 amount,address to)`
  - `repay(address asset,uint256 amount,uint256 interestRateMode,address onBehalfOf)`
  Compute the selectors with `sol("…")` and cross-check them with `cast sig`.
- [ ] Rules: `asset` in the lending allowlist; `onBehalfOf == safe` (supply, repay); `to == safe` (withdraw); `withdraw amount ≤ max_withdraw` for that asset, and `amount == MAX_UINT` ("withdraw all") is allowed only if a policy flag permits it. Failure → `LendingNotAllowed`.
- [ ] `borrow` is not allowlisted by default (default deny). Document it.
- [ ] Policy fields appended (encoding version bump, as in stage 9).
- [ ] Tests: **withdraw-to-attacker denied**; supply on behalf of an attacker denied; unlisted asset; withdraw cap + 1; withdraw-all flag on/off; malformed calldata; real Sepolia calldata fixtures.

## C4 — USD-denominated caps (`PriceUnavailable` 18, `UsdCapExceeded` 19)

**Keep `decide` pure.** The price is an **input**, not something `decide` fetches.

- [ ] Add `price: Option<PriceQuote>` to the decide inputs, with `PriceQuote { usd_per_eth_1e8: u256, updated_at: Timestamp }` (and per token if needed).
- [ ] Policy: `max_usd_per_tx`, `max_usd_per_window` (USD with 8 decimals), `max_price_age: Duration` (1 h).
- [ ] Rules (step 13 in the order): no price, `price ≤ 0`, or `now − updated_at > max_price_age` → `PriceUnavailable`. USD value = `value × price / 1e18`, using checked math; over the cap → `UsdCapExceeded`. The USD window uses the same `Window<24>` type with USD amounts.
- [ ] **Module:** reads the Chainlink ETH/USD feed (`latestRoundData()` → `(roundId, answer, startedAt, updatedAt, answeredInRound)`) through a **read-only Call effect** (the handler declares a read-only call, not a state-changing one; this is the Fe talking point). Converts it into `PriceQuote` and passes it in. Get the Sepolia feed address from Chainlink's docs.
- [ ] **CLI parity:** `leash check --price <usd> --price-updated-at <unix>` supplies the same `PriceQuote`. `agent.ts` reads the feed and passes the same value, so the prediction matches.
- [ ] Tests: stale feed (age = max + 1 s) → `PriceUnavailable`; age exactly max → allowed; zero price; negative `answer` → `PriceUnavailable`; USD cap and cap + 1; parity cases with fixed prices on both backends. Module test with a `MockAggregator`.

## Exit check

- [ ] Stale-feed and wrong-beneficiary tests pass. Parity covers the Aave and USD paths with fixed prices.
- [ ] THREAT_MODEL: oracle risks (staleness, manipulation, L2 sequencer feeds if E5 deploys to Base).
- [ ] ADR-013 (price as an input to a pure `decide`) written; README updated.
