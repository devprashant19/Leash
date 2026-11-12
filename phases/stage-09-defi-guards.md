# Stage 9 — DeFi guards: C1 hardening, C5 plugin trait, C2 Uniswap guard

| | |
|---|---|
| **When** | After the submission (on branch `roadmap`), or pulled forward before the freeze only if Phases 0–5 are all green |
| **Depends on** | Stage 2 (Phase 1) and stage 6 (Phase 5) |
| **Exit check** | Real-calldata fixtures pass; plugin test ingot works |
| **Skills** | superpowers TDD, `/ponytail-review`, addy security-and-hardening |

Every gate in [quality-gates.md](quality-gates.md) still applies, including parity: new rules must be covered by the generator, and the golden digest is regenerated with a written reason.

---

## C5 — `ActionGuard` plugin trait (do this first; C1 and C2 become guards)

```fe
// SKETCH — check Fe 26.6 trait syntax
pub trait ActionGuard {
    fn matches(self, target: TargetRule, data: Bytes) -> bool
    fn check(self, tx: Tx, policy: Policy, state: AgentState) -> Verdict   // pure: no `uses`
}
```

- [ ] `decide` step 12 (context §6) becomes "dispatch to the guard for the target's `TargetKind`". Dispatch is a `match` on `TargetKind` (static, no dynamic dispatch needed), so it works on both backends.
- [ ] Move the ERC-20 logic into `Erc20Guard`. All existing tests must pass unchanged (a pure refactor; parity digest must **not** change).
- [ ] **Extensibility test:** a separate test ingot `ingots/guard-example` defines `DummyGuard` (for example "allow only calls whose first argument is the Safe") and a test wires it in. Document in the README "Adding a protocol = one ingot implementing `ActionGuard`, checked by the same pipeline on both targets."
- [ ] CI grep: guard `check` functions have no `uses` clause either.

## C1 — ERC-20 guard hardening

- [ ] Add `increaseAllowance(address,uint256)` (`0x39509351`): it counts as an approval. The new total cannot be known without state, so apply the same caps to the increase and deny `MAX_UINT` increases. Document it.
- [ ] `transferFrom.from`: must be the Safe or a listed recipient (decide which, document in RULES.md). Pass the Safe address into `decide` via `AgentState.safe` (the module fills it; the CLI gets it from `--state`).
- [ ] **Real-calldata fixtures:** collect real `transfer`/`approve`/`transferFrom`/`increaseAllowance` calldata from Sepolia transactions (or produce it with `cast calldata`) into `test/fixtures/erc20/*.hex`, each with the expected verdict. Test on both backends.

## C2 — Uniswap swap guard (`SwapNotAllowed`, code 16)

Target kind `UniswapRouter` (SwapRouter02 on Sepolia; get the address from Uniswap's official deployments page).

- [ ] Decode `exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96))`. Compute the selector with `sol("…")` and compare it with `cast sig`. **Note:** SwapRouter02's struct has no `deadline` field (the original SwapRouter's does). Support the router version you deploy against, and if the struct has a deadline enforce `deadline ≤ now + 10 min`. Write the version choice into RULES.md.
- [ ] Decode `exactInput((bytes path,address recipient,uint256 amountIn,uint256 amountOutMinimum))`. Walk the path (`token(20) fee(3) token(20) …`) and check every hop's token and fee.
- [ ] Rules: `tokenIn` and `tokenOut` (all path tokens) in the swap allowlist; `amountIn ≤ max_swap_in` for that token; `recipient == safe`; `fee ≤ max_fee_tier`; `amountOutMinimum > 0` (no zero-slippage-protection swaps; document it). Any failure → `SwapNotAllowed`.
- [ ] Policy fields appended: `swap_tokens`, `max_swap_in` per token, `max_fee_tier`. Encoding version → **V2** if this ships after the freeze (bump the prefix to `LEASH_POLICY_V2`; keep V1 decoding for old deployments, or document a migration).
- [ ] Tests: a decoded fixture from a **real Sepolia swap** passes; the recipient attack (recipient = attacker) is denied; an unlisted token; amountIn cap + 1; fee tier too high; a multi-hop path with a bad middle token; a malformed struct.
- [ ] CLI: `leash explain` shows the swap rules; golden tests.
- [ ] Module: an end-to-end test with a mock router that records the call.

## Exit check

- [ ] Real-calldata fixtures pass on both backends; the plugin test ingot works.
- [ ] Parity generator extended to swaps; golden digest regenerated with a reason; both backends match.
- [ ] README feature table + Limitations updated; ADR for the guard trait (ADR-010).
