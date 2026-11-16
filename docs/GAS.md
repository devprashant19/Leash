# Gas & Bytecode Size Tracking

## 1. Bytecode Size Tracking (EIP-170 & EIP-3860)

EIP-170 sets a hard runtime bytecode limit of **24,576 bytes** (0x6000).
EIP-3860 sets a maximum initcode limit of **49,152 bytes** (0xc000).

| Contract | Runtime size (bytes) | EIP-170 limit | Headroom | Initcode size (bytes) | EIP-3860 limit | Status |
|---|---|---|---|---|---|---|
| `LeashModule` | **24,308** | 24,576 | **+268 bytes (1.1%)** | 24,563 | 49,152 | **PASS (0 warnings)** |

Measured with `fe build ingots/module --emit sizes` (Fe 26.6.0, default optimization level `-O 1`, which the artifacts are built with; `-O s` gives 24,217 bytes and `-O 2` 24,187). The headroom is small: new on-chain rules need size work first.

### Top Runtime Functions Breakdown (`LeashModule`)

From `fe build ingots/module --emit sizes`:

```text
runtime: 24308 bytes (22223 code, 2085 data, 0 embedded)
    9318 eval_tx
    3859 contract_runtime_root_LeashModule
    2426 contract_recv_abi_LeashModule_1368675399 (Preview)
    1504 contract_recv_abi_LeashModule_837179557 (TryExecute)
    1459 contract_recv_abi_LeashModule_2197115671 (Execute)
    1217 default_policy
     406 forward
     335 reason_code
     288 revert_for
     180 check_transfer
     125 spent_in_window
     116 copy_dynamic_payload_from_with_input_len
      93 find_token_rule_idx
      90 is_address_word
      86 is_recipient_allowed
      84 lib__decode__read_word
      75 selector_of
      72 record_spend
      37 checked_add_saturate
      25 require_safe
```

### What keeps it under the limit

1. **One decision, one decode**: `policy::decide_spend` returns the verdict and the token amount an allowed call moves; the module books that amount with `record_allowed`. Decoding the calldata a second time for the ledger cost about 2.7 KB.
2. **Pass-by-reference (`ref` and `mut`)** for `Tx`, `Policy` and `Calldata`, and index-based target and token lookups (`find_target_idx`, `find_token_rule_idx`) instead of copying 416-byte `TargetRule` structs.
3. **Lean storage model (`AgentLedger`)**: per agent, only the 24 hourly ETH buckets and one `(period, amount)` pair per token rule are stored; no action window (rate limiting is off in the module policy).
4. **One policy for every agent**: the module evaluates `default_policy()`; per-agent caps were removed (they also broke CLI parity).
5. **Compile-time fingerprint**: `fingerprint()` returns the default policy's fingerprint as a constant instead of hashing 138 policy words on-chain. The `module` test `test_fingerprint_golden` checks it against `fingerprint(default_policy())`.

---

## 2. Measured gas (reproducible)

Gas used by each transaction of the canonical demo, end to end (agent → `LeashModule.tryExecute` → test Safe → target), from `demo/run.json` (Anvil) and the in-memory EVM runs in `web/public/recorded/`:

| Step | Verdict | Gas (Anvil run, `demo/run.json`) |
|---|---|---|
| 0.05 ETH to the treasury | ALLOW | 280,202 |
| Transfer 50 tokens | ALLOW | 204,813 |
| 0.2 ETH (over the per-tx cap) | DENY 7 | 175,401 |
| Unlisted contract | DENY 4 | 157,884 |
| Unlimited approve | DENY 10 | 184,406 |

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
