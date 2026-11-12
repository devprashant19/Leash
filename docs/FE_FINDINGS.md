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
