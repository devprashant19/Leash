# FE_FINDINGS.md — Fe 26.6.0 Language Findings, Std Reference, and Spikes

## 1. Standard Library Reference Locations (Fe v26.6.0)

| Capability / API | Location in `argotorg/fe` (v26.6.0) | Notes |
|---|---|---|
| **Typed Units** (`Wei`, `Address`, `Duration`, `Timestamp`) | `ingots/std/src/evm/units.fe`, `ingots/std/src/time.fe`, `ingots/std/src/evm/address.fe` | `Wei`, `Address` in `std::evm`; `Duration`, `Timestamp` in `std::time` |
| **Keccak-256 Hashing** | `ingots/core/src/hash.fe` (`core::hash::keccak256_word`, `core::hash::keccak256`) | Available on both EVM and Native for `[u8; N]`, `MemSpan`, `MemBuffer` |
| **Storage Maps** | `ingots/std/src/evm/storage_map.fe` (`std::evm::StorageMap`) | EVM contract storage mapping |
| **EVM Effects** (`Ctx`, `Log`, `Call`, `Evm`, `Create`) | `ingots/std/src/evm/effects.fe` | Effects system for contracts |
| **Contract Calls & Returndata** | `ingots/std/src/evm/calls.fe`, `ingots/std/src/evm/returndata.fe` | Low-level EVM call wrappers, `evm.call` and `evm.try_call` |
| **Text & Hex Decoding** | `ingots/core/src/text.fe` (`decode_hex`, `parse_uint`), `ingots/core/src/string.fe` | `decode_hex` takes any `T: Text` and returns `Option<Bytes>` |
| **I/O & Streams** (`Stdout`, `Stderr`, `Stdin`) | `ingots/std/src/io.fe` | Defined as traits implemented by `Host`; provides `print!` and `println!` |
| **Process Environment** (`Args`, `Env`) | `ingots/std/src/env.fe`, `ingots/std/src/process.fe` | Defined as traits implemented by `Host`; `Args::get` returns `Arg` with `.span()` |
| **File System** (`Fs`, `File`) | `ingots/std/src/fs.fe` | Native file system operations |

---

## 2. Syntax Surprises & Compiler Rules in Fe 26.6.0
1. **Contract Structure**: Contracts do NOT accept top-level `pub fn` directly inside the `contract` body. Contracts use `init(...)` for constructors and `recv MsgType { Variant { ... } -> ReturnType { ... } }` blocks for public interfaces.
2. **Selectors on Messages**: Message variants require explicit `#[selector = sol("...")]` or numeric selectors `#[selector = 1]`.
3. **Ingot Root**: Every Fe ingot MUST have `src/lib.fe` as its root file. For a native binary ingot, `pub fn main() -> i32` or `pub fn main()` must be located in `src/lib.fe` (or re-exported by it).
4. **Native Backend on Windows**: `fe build --backend native` links native executables and static libraries on x86-64 Linux and AArch64 macOS hosts. On Windows, Sonatina IR emission (`fe build -i cli --backend native --emit ir`) works. Full native binary compilation runs in CI on Ubuntu (`ubuntu-latest`).
5. **Conditional Compilation**: `#[cfg(target = "evm")]` and `#[cfg(target = "native")]` allow separating target-dependent entrypoints and tests across backends cleanly.

---

## 3. Spikes Results (Phase 0)

### Spike 1: Pure function in policy tested across backends
- **Code**: `compute_cap_multiplier` in `ingots/policy/src/lib.fe`.
- **EVM Result**: `PASS [0.0001s] policy test_cap_multiplier`.
- **Native Result**: On Windows, Fe native code emitter notes `native test execution supports x86-64 Linux and AArch64 macOS`. Validated Sonatina IR generation via `fe build -i cli --backend native --emit ir` and CI on Linux executes native tests.

### Spike 2: Module-to-Safe external call (`execTransactionFromModule`)
- **Code**: `MockSafe` contract receiving `ExecTransactionFromModule { to, value, data: Bytes, operation } -> bool`.
- **EVM Result**: `PASS [0.0001s] testkit test_mock_safe_call`. Verified `evm.call` passes typed arguments and receives return boolean.

### Spike 3: Native `main` with `Args`, `Stdout`, and `decode_hex`
- **Code**: `pub fn main() -> i32 uses (out: mut Stdout, args: Args)` in `ingots/cli/src/lib.fe`. Decodes hex input via `decode_hex(arg.span())`.
- **Result**: Compiles cleanly to native Sonatina IR `out/cli.native.sona`.

### Spike 4: Keccak-256 Hashing Verification
- **Code**: `keccak256_word([116, 101, 115, 116])` ("test" in ASCII).
- **Result**: `0x9c22ff5f21f0b81b113e63f7db6da94fedef11b2119b4088b89664fb9a3cb658`.
- **Parity with `cast keccak`**: `cast keccak "test"` outputs the identical word `0x9c22ff5f21f0b81b113e63f7db6da94fedef11b2119b4088b89664fb9a3cb658`. Test passes.

### Spike 5: Custom `#[error]` Reverts
- **Code**: `#[error] pub struct Paused {}` with selector `0x9e87fac8`.
- **Result**: `#[test(should_revert, selector = 0x9e87fac8)]` passes. Matches `cast sig "Paused()" == 0x9e87fac8`.

---

## 4. Phase 5 Findings: Advanced Patterns, Gas Boundaries, and Parity

1. **Mutable Bindings (`var` vs `let mut`)**:
   - `let mut x = ...` causes compiler error `unexpected token 'mut'`.
   - In Fe 26.6.0, mutable local variables MUST be declared with `var x = ...`. Mutable references passed to functions use `mut x` or `label: mut x`.
2. **Top-Level `pub use` Semicolons**:
   - In Fe source files, `pub use module::*;` fails with `unexpected token ';'`.
   - Top-level `pub use` statements must omit the trailing semicolon (e.g., `pub use golden::*`).
3. **`Bytes` Move Semantics**:
   - `Bytes` does not implement `Copy`. Passing a `Bytes` struct into an EVM message call or function moves it.
   - For repeated calls in loops (such as circuit breaker probing or multi-tx simulation), either re-instantiate `Bytes` inside each loop iteration or use explicit `.clone()`.
4. **Single-Element Tuples for `evm.create<T>`**:
   - Calling `evm.create<T>(args: (x))` treats `(x)` as parenthesized expression rather than a tuple.
   - Single-element tuples require a trailing comma: `evm.create<T>(args: (x,))`.
5. **EVM Gas Limits in Off-chain Test Harnesses**:
   - Running 10,000 complex cryptographic transactions in a single EVM contract execution exceeds standard gas limits (30M gas).
   - Solution: Sharding the parity suite into 10 deterministic chunks of 1,000 transactions with rolling seeds (`PARITY_SEED + chunk_idx`) allows instant verification across both EVM and native backends (~0.35s per chunk) with rolling Keccak-256 state continuity.
6. **Zero-Field Message Variant Syntax**:
   - Calling or matching a zero-field message variant requires empty braces syntax `ReenterMsg::Ping {}` rather than bare identifier `ReenterMsg::Ping`. Omitting braces causes compiler error `expected unit variant ... Consider using Ping { } instead`.
7. **Explicit Error Selectors in Tests**:
   - Using bare `#[test(should_revert)]` without a selector accepts any revert, including unrelated errors like `TargetNotAllowed` or out-of-gas.
   - Pinned selector verification `#[test(should_revert, selector = 0x...)]` ensures the revert is caused by the exact expected custom error (e.g. `0xed3ba6a6` for `Reentrant()`).
8. **Duration and Time Helpers**:
   - In Fe std, `Duration` creation helper functions are defined as `seconds(u64)` rather than associated methods like `Duration::from_seconds(u64)`.


