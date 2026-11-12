---
name: fe-26
description: Comprehensive Fe 26.6.0 language syntax, verified std library patterns, and compiler rules.
---

# Fe 26.6.0 Language Skill & Cheat Sheet

This skill documents verified Fe 26.6.0 idioms, syntax patterns, std locations, and compiler constraints.

> **CRITICAL RULE**: Fe 26.6.0 is strictly typed and effect-checked. NEVER guess an API or syntax. Read `ingots/std` source or the reference repo before writing code. Run `fe check` after every change.

---

## 1. Verified Fe 26.6.0 Syntax Reference

### Ingot Structure
Every ingot must have `src/lib.fe` as its root module.
Dependencies are declared in `fe.toml`:
```toml
[ingot]
name = "module"
version = "0.1.0"

[dependencies]
policy = { path = "../policy" }
```

### Mutability & Variables
```fe
let x: u256 = 10        // immutable binding
var y: u256 = 20        // mutable local variable
y = 25
```

### Contracts, Messages & Selectors
Contracts do NOT use top-level `pub fn`. They use `init` and `recv` blocks:
```fe
pub msg LeashMsg {
    #[selector = sol("version()")]
    Version -> u32,
    #[selector = 1]
    Execute { to: Address, value: Wei } -> bool,
}

pub contract LeashModule uses (ctx: mut Ctx) {
    mut owner: Address

    init(owner: Address) uses (mut owner) {
        owner = owner
    }

    recv LeashMsg {
        Version -> u32 {
            1
        }
        Execute { to, value } -> bool uses (ctx, owner) {
            true
        }
    }
}
```

### Effects & Providers (`uses` and `with`)
- Functions requiring capabilities declare `uses (effect_name: mut Type)`.
- Pure functions (like `decide`) declare **NO `uses` clause**.
- Providers are passed down via `with`:
```fe
fn read_state() -> u256 uses (store: TokenStore) {
    with (store) {
        internal_reader()
    }
}
```

### Enums with Data & Pattern Matching
```fe
pub enum Verdict {
    Allow,
    Deny(DenyReason),
}

pub enum Operation {
    Call,
    DelegateCall,
}

pub fn is_allowed(v: Verdict) -> bool {
    match v {
        Verdict::Allow => true,
        Verdict::Deny(_) => false,
    }
}
```

### Custom Errors (`#[error]`)
```fe
#[error]
pub struct Paused {}

#[error]
pub struct PerTxCapExceeded {}
```

### Testing & Reverts
```fe
#[test]
fn test_allow() {
    assert(true)
}

#[test(should_revert, selector = sol("Paused()"))]
fn test_paused_reverts() {
    revert Paused()
}
```

### Typed Units
Units live in `std::evm` and `std::time`:
```fe
use std::evm::{Address, Wei}
use std::time::{Duration, Timestamp}

let cap: Wei = Wei::from(100000000000000000) // 0.1 ETH
let one_hour: Duration = Duration::from_secs(3600)
```

### Keccak-256 Hashing
Available in `core::hash`:
```fe
use core::hash::keccak256
```

### Text & Decoding
```fe
use core::text::decode_hex
```

### Native Main & CLI Effects
In `ingots/cli/src/lib.fe`:
```fe
use std::env::Args
use std::io::Stdout

pub fn main() -> i32 uses (args: Args, out: mut Stdout) {
    0
}
```

---

## 2. Fe 26.5 → 26.6 Breaking Changes
1. **`DynString` is non-Copy**: Cannot be cloned implicitly; pass references or buffers.
2. **Lossless `as` Casts**: Widening casts use `as`; narrowing casts require `.downcast_unchecked()` or explicit bounds checks.
3. **Native `main`**: Native entry points declare `pub fn main() -> i32` in `src/lib.fe` using `Args` and `Stdout` capabilities.

---

## 3. Essential Compiler Commands
- `fe fmt --check ingots` — check code formatting
- `fe fmt ingots` — format code in place
- `fe check` — typecheck all workspace ingots
- `fe test` — run tests on EVM backend
- `fe test --backend native` — run tests on Native backend
- `fe build` — compile EVM contracts to bytecode
- `fe build --emit sizes` — output contract bytecode sizes
- `fe build -i cli --backend native` — compile native CLI executable
