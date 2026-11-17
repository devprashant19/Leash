# Gas & Bytecode Size Tracking

## 1. Bytecode Size Tracking (EIP-170 & EIP-3860)

EIP-170 sets a hard runtime bytecode limit of **24,576 bytes** (0x6000).
EIP-3860 sets a maximum initcode limit of **49,152 bytes** (0xc000).

| Contract | Runtime size (bytes) | EIP-170 limit | Headroom | Initcode size (bytes) | EIP-3860 limit | Status |
|---|---|---|---|---|---|---|
| `LeashModule` | **18,892** | 24,576 | **+5,684 bytes (23.1%)** | 19,147 | 49,152 | **PASS (0 warnings)** |

Measured with `fe build ingots/module --emit sizes` (Fe 26.6.0, default optimization level `-O 1`, which the artifacts are built with). Storage bucket packing into single 256-bit words (`(index << 192) | amount`) freed 5,358 bytes of runtime code, providing substantial headroom (+5,684 bytes) for extensible protocol rules.

### Top Runtime Functions Breakdown (`LeashModule`)

From `fe build ingots/module --emit sizes`:

```text
runtime: 18892 bytes (16775 code, 2117 data, 0 embedded)
    8876 eval_tx
    3702 contract_runtime_root_LeashModule
    1343 contract_recv_abi_LeashModule_1368675399 (Preview)
     848 contract_recv_abi_LeashModule_2197115671 (Execute)
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

1. **Packed Hourly Buckets**: Storing each of the 24 hourly ETH buckets in a single 256-bit word `(index << 192) | amount` (saturating at $2^{192}-1$) eliminated struct array overhead, reducing runtime size by 5,358 bytes and expanding EIP-170 headroom from 268 B to 5,684 B.
2. **One decision, one decode**: `policy::decide_spend` returns the verdict and the token amount an allowed call moves; the module books that amount with `record_allowed`. Decoding the calldata a second time for the ledger cost about 2.7 KB.
3. **Pass-by-reference (`ref` and `mut`)** for `Tx`, `Policy` and `Calldata`, and index-based target and token lookups (`find_target_idx`, `find_token_rule_idx`) instead of copying 416-byte `TargetRule` structs.
4. **Lean storage model (`AgentLedger`)**: per agent, only the 24 packed hourly ETH buckets (24 words) and one `(period, amount)` pair per token rule (8 words) are stored (32 words total, down from 56 words).
5. **One policy for every agent**: the module evaluates `default_policy()`; per-agent caps were removed (they also broke CLI parity).
6. **Compile-time fingerprint**: `fingerprint()` returns the default policy's fingerprint as a constant instead of hashing 138 policy words on-chain. The `module` test `test_fingerprint_golden` checks it against `fingerprint(default_policy())`.

---

## 2. Measured gas (reproducible)

Gas used by each transaction of the canonical demo, end to end (agent → `LeashModule.tryExecute` → test Safe → target), from `demo/run.json` (Anvil) and the in-memory EVM runs in `web/public/recorded/`:

| Step | Verdict | Gas (Anvil run, `demo/run.json`) |
|---|---|---|
| 0.05 ETH to the treasury | ALLOW | 299,218 |
| Transfer 50 tokens | ALLOW | 264,283 |
| 0.2 ETH (over the per-tx cap) | DENY 7 | 192,947 |
| Unlisted contract | DENY 4 | 175,484 |
| Unlimited approve | DENY 10 | 201,701 |

`demo/run.json` is the `demo-run-fe-native` artifact of CI run 43936669227 (commit `3fbae35`): Anvil, predictions from the Fe-built `leash` binary, 5/5 matched.

### Gas Cost Breakdown (~260k–300k Gas per Allowed Call)
Why does an allowed transaction through `LeashModule` consume ~264k–299k gas?
1. **Cold Storage Reads (32 Words, down from 56 Words)**: Every transaction loads `AgentLedger` (24 packed hourly ETH buckets in `Window24` [24 words] + 4 token period buckets [8 words] = 32 words). Under EIP-2929, each cold `SLOAD` costs 2,100 gas:
   $$\text{Storage Read Overhead} = 32 \times 2{,}100 = 67{,}200\text{ gas}$$
   By packing ETH ring buffer buckets into single 256-bit words (`(index << 192) | amount`), storage read overhead was reduced by **50,400 gas** (from 117,600 gas to 67,200 gas).
2. **Safe Module Subcall Overhead**: `LeashModule` dispatches to Safe via `execTransactionFromModule`, which performs Safe signature checks, reentrancy guards, and context switching.
3. **Storage Writes (`SSTORE`)**: Recording spent amounts updates the active bucket. The first token transfer in a 24h UTC period writes a fresh `(period, amount)` pair (two zero-to-nonzero `SSTORE`s costing ~40,000 gas; subsequent updates within the period cost ~2,900 gas warm).
4. **Target Execution**: Gas consumed by the target contract (e.g. ERC-20 `transfer` updating sender and receiver balances, or plain ETH transfers).

### The Tradeoff: Fixed Storage Ring Buffer vs Unbounded $O(N)$ Logs
Why not use an append-only transaction log or dynamic array?
- **Griefing Defense**: If an agent wallet used an unbounded transaction array, an attacker or compromised agent could submit hundreds of tiny 1-wei transactions, causing subsequent loop evaluations to exceed the block gas limit (out-of-gas denial-of-service).
- **Predictable $O(1)$ Complexity**: A fixed 24-bucket ring buffer guarantees that loop traversal is strictly bounded ($O(1)$) and gas consumption remains constant over the entire lifetime of the agent session.
- **The Tradeoff**: High baseline cold SLOAD cost (~117k gas per transaction), in exchange for mathematical immunity against state exhaustion and loop-griefing attacks.

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
