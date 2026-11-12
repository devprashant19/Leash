# CONSTRAINTS.md — Non-Negotiable System Constraints

1. **Compiler Version**: Pinned strictly to Fe **26.6.0**. No unpinned releases. CI and local setups must verify `fe --version` prints `26.6.0`.
2. **Contract Runtime Size**: `LeashModule` runtime bytecode size must remain strictly under **24,576 bytes** (EIP-170 limit). Checked via `fe build --emit sizes`.
3. **Pure Fe Implementation**: All core code (`ingots/policy`, `ingots/module`, `ingots/cli`, `ingots/testkit`) must be 100% Fe. Only demo scripts and frontends may use TypeScript/HTML.
4. **Strict Component Boundary**: Zero policy rules outside `ingots/policy`. The module and CLI contain only effects and I/O.
5. **Purity of `decide`**: `policy::decide` has no `uses` clause. It is pure, deterministic, and can be evaluated on any target without side-effects.
6. **State Mutation Boundary**: Only `policy::record` (and `record_denial`) may mutate ledger state.
7. **Append-Only Deny Codes**: Numeric deny codes (0..20+) and custom error signatures are permanent and append-only. No code is ever renumbered or reassigned.
8. **Typed Units**: All amounts are strictly typed (`Wei`, `Duration`, `Timestamp`, `TokenAmount`). Raw untyped integers for money or time are prohibited.
9. **Zero Secrets in Repository**: No private keys, mnemonic phrases, or live API credentials in code or commits.
10. **Contest Commit Window**: Every commit must be dated between November 3 and November 24, 2026 UTC. Starter commit is tagged `starter`.
