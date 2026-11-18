# Gas & Bytecode Size Tracking

## 1. Bytecode Size Tracking (EIP-170 & EIP-3860)

EIP-170 sets a hard runtime bytecode limit of **24,576 bytes** (0x6000).
EIP-3860 sets a maximum initcode limit of **49,152 bytes** (0xc000).

| Contract | Runtime size (bytes) | EIP-170 limit | Headroom | Initcode size (bytes) | EIP-3860 limit | Status |
|---|---|---|---|---|---|---|
| `LeashModule` | **22,182** | 24,576 | **+2,394 bytes (9.7%)** | 22,437 | 49,152 | **PASS (0 warnings)** |

Measured with `fe build ingots/module --emit sizes` (Fe 26.6.0, default optimization level `-O 1`, which the artifacts are built with); CI fails the build at 24,576 bytes. Storing the ledger as two parts and loading only the part a call needs (section 2) costs 3,290 bytes over the previous 18,892-byte build.

### Top Runtime Functions Breakdown (`LeashModule`)

From `fe build ingots/module --emit sizes`:

```text
runtime: 22182 bytes (17953 code, 4229 data, 0 embedded)
    8548 eval_tx
    3054 contract_runtime_root_LeashModule
    2376 calldata_from_bytes
    1095 eval_and_record
     886 contract_recv_abi_LeashModule_2197115671
     406 forward
     351 reason_code
     180 check_transfer
     144 record_spend
     144 spent_in_window
     116 copy_dynamic_payload_from_with_input_len
      93 find_token_rule_idx
      90 is_address_word
      86 is_recipient_allowed
      84 lib__decode__read_word
      75 selector_of
      37 checked_add_saturate
      25 require_safe
```

### What keeps it under the limit

1. **Packed Hourly Buckets**: each of the 24 hourly ETH buckets is one 256-bit word `(index << 192) | amount` (saturating at $2^{192}-1$), which removed the struct array overhead (5,358 bytes when it was introduced).
2. **One decision, one decode**: `policy::decide_spend` returns the verdict and the token amount an allowed call moves; the module books that amount with `record_allowed`. Decoding the calldata a second time for the ledger cost about 2.7 KB. The module converts the calldata once per call and passes it on.
3. **Pass-by-reference (`ref` and `mut`)** for `Tx`, `Policy` and `Calldata`, and index-based target and token lookups (`find_target_idx`, `find_token_rule_idx`) instead of copying 416-byte `TargetRule` structs.
4. **Lean storage model**: per agent, the 24 packed hourly ETH buckets (`eth_windows`, 24 words) and one `(period, amount)` pair per token rule (`token_periods`, 8 words), 32 words in all.
5. **One policy for every agent**: the module evaluates `default_policy()`; per-agent caps were removed (they also broke CLI parity).
6. **Compile-time fingerprint**: `fingerprint()` returns the default policy's fingerprint as a constant instead of hashing 138 policy words on-chain. The `module` test `test_fingerprint_golden` checks it against `fingerprint(default_policy())`.

---

## 2. Measured gas (reproducible)

Gas used by each transaction of the canonical demo, end to end (agent → `LeashModule.tryExecute` → test Safe → target). "Now" is `demo/run.json`, from the CI `demo` job (`demo-run-fe-native` artifact: Anvil, predictions from the Fe-built `leash` binary, 5/5 matched). "Before" is the same job on the previous build, which loaded all 32 ledger words on every call.

| Step | Verdict | Ledger words loaded | Gas now (Anvil) | Gas before (Anvil) | Saved |
|---|---|---|---|---|---|
| 0.05 ETH to the treasury | ALLOW | 24 (ETH window) | **204,871** | 217,878 | -13,007 (-6.0%) |
| Transfer 50 tokens | ALLOW | 8 (token periods) | **153,502** | 202,807 | -49,305 (-24.3%) |
| 0.2 ETH (over the per-tx cap) | DENY 7 | 24 (ETH window) | **123,068** | 135,002 | -11,934 (-8.8%) |
| Unlisted contract | DENY 4 | 0 | **54,696** | 117,532 | -62,836 (-53.5%) |
| Unlimited approve | DENY 10 | 8 (token periods) | **97,362** | 143,473 | -46,111 (-32.1%) |

**Why the savings differ by step.** `policy::reads_eth_window` is true only for a call that moves ETH (or when rate limiting is on) and `policy::reads_token_periods` only for a call with calldata; `LeashModule` loads, and after an allowed call stores back, only those parts. A cold `SLOAD` costs 2,100 gas, so skipping the ETH window saves up to 50,400 gas and skipping the token periods up to 16,800. The policy test `test_ledger_reads` checks that `decide_spend` returns the same verdict and token spend with the skipped part emptied: a call that moves no ETH adds 0 to a window total that rule 10 already kept at or under `max_per_window`, and only `check_transfer`, which needs decoded calldata, reads the token periods.

> [!NOTE]
> **Execution Environment Differences:** steps 3–5 measure the same in the in-memory EthereumJS EVM used by the web demo (`npm run test:web`) as on Anvil. The allowed steps measure higher there (239,386 and 183,977 gas); the source of that difference has not been isolated.

### Live Sepolia (Canonical Safe v1.4.1) Gas Measurements

The 5-step scenario was also executed live on Ethereum Sepolia behind a canonical Safe v1.4.1 account ([`demo/deployments/sepolia-safe-run.json`](../demo/deployments/sepolia-safe-run.json)), once with the previous build (all 32 ledger words loaded on every call) and again with the current one:

| Step | Transaction | Verdict | Sepolia, current build | Sepolia, previous build | Saved | Anvil (`MockSafe`), current build |
|---|---|---|---|---|---|---|
| 1 | 0.05 ETH to treasury | ALLOW | **237,624** | 250,631 | -13,007 | 204,871 |
| 2 | Transfer 50 tokens | ALLOW | **346,569** | 493,794 | -147,225 | 153,502 |
| 3 | 0.2 ETH (over cap) | DENY 7 | **205,305** | 217,239 | -11,934 | 123,068 |
| 4 | Unlisted target | DENY 4 | **55,885** | 118,721 | -62,836 | 54,696 |
| 5 | Unlimited approve | DENY 10 | **98,791** | 144,902 | -46,111 | 97,362 |

Steps 1, 3, 4 and 5 saved exactly as much on Sepolia as on Anvil. Step 2 saved 147,225 gas on Sepolia against 49,305 on Anvil; how the extra ~98k splits up has not been measured. One difference between the two Sepolia runs: both used the same demo token and treasury, so the treasury already held 50 tokens in the second run and its balance update was not a zero-to-nonzero write.

**Environment and execution differences between Sepolia and Anvil:**
- **Step 2 (Token transfer execution)**: On Sepolia, the canonical `Safe` proxy executes `execTransactionFromModule` and forwards the call to `MockErc20.transfer`, updating balances and emitting events on-chain. On Anvil, the test double `MockSafe` records the call parameters without forwarding execution (`forward_calls` false), so the token contract itself is never invoked in the Anvil demo. This accounts for the bulk of the Step 2 difference.
- **Step 3 (Refusal delta)**: Step 3 is refused before reaching the Safe, yet uses 82,237 gas more on Sepolia than on Anvil, the same difference with both builds, so it does not come from the module's ledger reads; its cause has not been isolated.

### Where the gas goes
1. **Cold storage reads**: under EIP-2929 each cold `SLOAD` costs 2,100 gas. A call reads its agent's config, plus the 24-word ETH window if it moves ETH and the 8 words of token periods if it has calldata (section 2), so the ledger costs 0, 16,800 or 50,400 gas to read.
2. **Safe module dispatch**: `LeashModule` calls the Safe's `execTransactionFromModule`, which checks that the module is enabled, forwards the call to the target and emits `ExecutionFromModuleSuccess`.
3. **Storage writes (`SSTORE`)**: an allowed call stores back only the ledger part it read. The first token transfer in a 24 h UTC period writes a fresh `(period, amount)` pair (two zero-to-nonzero `SSTORE`s, about 40,000 gas); later updates in the period cost about 2,900 gas each.
4. **Target execution**: gas used by the target itself (an ERC-20 `transfer` updating two balances, or a plain ETH transfer).

### Safe Module Gas Profile
An allowed ETH transfer still costs about 205k gas on Anvil (238k on Sepolia) and a refused over-cap transfer about 123k (205k on Sepolia), which is high for a Safe module. Most of it is the on-chain 24 h ETH window: Leash keeps a rolling spending history on-chain instead of checking a single allowance word or an off-chain signature.

**The architectural choice (bounded ring buffer vs dynamic arrays)**: Leash uses a fixed 24-bucket ring buffer so evaluation is bounded ($O(1)$) in pure Fe:
- **Griefing defense**: with an unbounded transaction array, an attacker or compromised agent could submit many tiny transactions until later evaluations exceed the block gas limit (out-of-gas denial of service).
- **Predictable complexity**: the 24-bucket loop is bounded, so its gas does not grow over the life of the agent session.
- **The trade-off**: reading the window costs up to 50,400 gas in cold `SLOAD`s, in exchange for immunity to state exhaustion and loop griefing.

**Future optimizations (roadmap)**:
- **Smaller ETH window**: reading only the buckets that fall inside the last 24 h needs their positions known in advance; a coarser window (for example 6 four-hour buckets) would cut the read to 6 words at the cost of resolution.
- **Transient storage (EIP-1153)**: keeping intra-transaction scratch state in transient storage, which Fe 26.6.0's `std::evm` already exposes (`TSlot<T>`, `read_transient_word`). This only saves gas for state that does not need to outlive the transaction; the 24 h ledger itself must stay in persistent storage.
- **Stateless Merkle proofs**: moving rolling-window accounting off-chain and verifying compact state roots on-chain.

Reproduce with `make demo` (Anvil) or `npm run test:web` (in-memory EVM). No benchmark harness for Zodiac Roles or other modules is included in this repository, so this document makes no comparative gas claim.

---

## 3. Which Abstractions in Fe Are Free?

Fe 26.6.0 provides high-level type safety. Here is how Fe abstractions translate to EVM gas:

### 1. Truly Free Abstractions (0 Gas Overhead)
- **Strongly Typed Financial Units (`Wei`, `Timestamp`, `Duration`)**:
  - Fe strictly checks unit dimensions at compile time (rejecting `Wei + Duration`).
  - At the EVM bytecode level, all three compile directly to raw 256-bit scalar values without boxing, tags, or runtime wrappers.
- **Pure Function Effects Guarantee (`decide` has no `uses`)**:
  - Because Fe statically proves `decide` cannot touch storage or make external calls, the compiler omits all storage loading machinery from the evaluation loop.
- **Copy & Snapshot Semantics**:
  - Passing immutable references (`ref Policy`, `ref Tx`) allows Fe to reference data in memory via pointer arithmetic without emitting memory-copy loops.

### 2. Low-Cost Abstractions (< 100 Gas)
- **Enums with Small Variants (`Verdict`, `Operation`, `TargetKind`)**:
  - Compiles to 1-byte discriminants with jump tables or simple conditional jumps.
- **Selector Constants (`sol("transfer(address,uint256)")`)**:
  - Evaluated at compile time to constant 32-bit integers (`0xa9059cbb`), pushed directly with `PUSH4`.

### 3. Abstractions That Cost Gas (Carefully Optimized in Leash)
- **Dynamic Bytes Slicing**:
  - Decoding calldata words from `std::abi::Bytes` requires memory copies if not guarded. Leash uses fixed-size `[u8; 100]` buffers to keep memory allocation deterministic.
- **Large Struct Copies**:
  - In Stage 11, refactoring `find_target` to `find_target_idx` returning indices saved **3,439 bytes of contract runtime code** and ~850 gas per execution by avoiding 416-byte memory copies.

---

## 4. Operation-by-Operation Gas

Per-operation figures (Execute, Preview, Pause) are not measured by any script in this repository, so none are quoted here. The end-to-end figures in section 2 are measured and reproducible.

---
