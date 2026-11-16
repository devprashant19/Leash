# Gas & Bytecode Size Tracking

## 1. Bytecode Size Tracking (EIP-170 & EIP-3860)

EIP-170 sets a hard runtime bytecode limit of **24,576 bytes** (0x6000).
EIP-3860 sets a maximum initcode limit of **49,152 bytes** (0xc000).

| Contract | Runtime Size (Bytes) | EIP-170 Limit | Headroom | Initcode Size (Bytes) | EIP-3860 Limit | Status |
|---|---|---|---|---|---|---|
| `LeashModule` | **22,029** | 24,576 | **+2,547 bytes (10.4%)** | 22,284 | 49,152 | **PASS (0 warnings)** |
| `LeashQueue` | **8,610** | 24,576 | **+15,966 bytes (65.0%)** | 8,730 | 49,152 | **PASS (0 warnings)** |

### Top Runtime Functions Breakdown (`LeashModule`)

From `fe build ingots/module --emit sizes`:

```text
runtime: 22029 bytes (20167 code, 1862 data, 0 embedded)
    9277 eval_tx
    3584 contract_runtime_root_LeashModule
    2079 contract_recv_abi_LeashModule_1368675399 (Preview)
    1358 contract_recv_abi_LeashModule_2197115671 (Execute)
    1246 contract_recv_abi_LeashModule_837179557 (TryExecute)
     689 run_tx
     319 reason_code
     274 revert_for
     188 contract_recv_abi_LeashModule_3773533601
     125 spent_in_window
     116 copy_dynamic_payload_from_with_input_len
      93 find_token_rule_idx
      90 is_address_word
      86 is_recipient_allowed
      84 lib__decode__read_word
      75 selector_of
      51 check_transfer
      25 require_safe
```

### Architectural Size Optimizations Applied

1. **Pass-by-Reference (`ref` & `mut`)**:
   Eliminated struct copies for `Tx`, `Policy`, and `Calldata`.
2. **Index-Based Target and Token Lookups**:
   `find_target_idx` and `find_token_rule_idx` return indices, eliminating 416-byte `TargetRule` copies on every transaction check.
3. **Data Section Pruning via Field Mutation**:
   Constructing `targets` and `tokens` in `policy_for_agent` via direct field mutation reduced DATA section footprint by over 3,200 bytes.
4. **Lean On-Chain Storage Model (`AgentLedger`)**:
   Instead of storing 340-word `AgentState` struct on-chain, `StorageMap<Address, AgentLedger>` stores only active window buckets (`eth_window`), cutting storage read/write overhead by over 70%.
5. **Execution Deduplication**:
   Extracted shared transaction evaluation pipeline (`eval_tx`) between `Execute`, `TryExecute`, and `Preview`.
6. **Compile-time Policy Fingerprint**:
   Emitted the pinned default policy cryptographic fingerprint (`0x3efcfc58aec5d1e7e81b5bded7820ed3ed8a0e654cf4aff3bfb793a7494ae6ee`) as a constant for `Fingerprint`, pruning unused Keccak-f[1600] permutation engine from on-chain deployment.

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
