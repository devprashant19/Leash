# ARCHITECTURE.md — Leash Architecture

## 1. System Overview

```
                 1 check                          same decide
  ┌──────────┐ ─────────► ┌──────────────────┐ ──────────────┐
  │ AI agent │            │ leash CLI(native)│               ▼
  │ proposes │            │ check·explain·   │      ┌─────────────────────┐
  │   a tx   │            │ replay·fingerprint│     │    policy ingot     │
  └────┬─────┘            │ Args,Stdout,Fs   │      │ decide: no effects  │
       │ 2 execute        └──────────────────┘      │ record: mut Ledger  │
       ▼                                            │ same fingerprint    │
  ┌──────────────────────┐   same decide + record   └─────────────────────┘
  │ LeashModule (EVM)    │ ─────────────────────────────────▲
  │ Execute·Preview·Pause│
  │ Storage,Call,Log     │
  └────┬─────────────────┘
       │ 3 allowed calls only
       ▼
  ┌──────────────────────────┐
  │ Safe smart account       │
  │ execTransactionFromModule│
  └──────────────────────────┘
```

## 2. Component Boundaries

| Ingot / folder | Target | Responsibility | Allowed effects |
|---|---|---|---|
| `ingots/policy` | EVM + native | Types (`Tx`, `Policy`, `Verdict`, `DenyReason`, `AgentState`), calldata decoding, `decide`, `record`, `fingerprint`, `validate`, `explain` text, encoding | **None** for `decide`; `mut Ledger` only for `record` |
| `ingots/module` | EVM | `LeashModule`: agent entry, owner admin, kill switch, events, forwards to the Safe | Storage, Ctx, Call, Log |
| `ingots/cli` | Native | `leash check / explain / fingerprint / replay / validate / encode`; optional static library | Args, Stdout, Stderr, Fs, Exit |
| `ingots/testkit` | EVM + native | MockSafe, MockErc20, seeded tx generator, shared fixtures | Test-only |
| `demo/` | Node/TS | Sepolia and Anvil deploy, scripted agent (viem), dashboard page | Non-Fe runtime scripts |
| `docs/` | — | Architecture, threat model, ADRs, AI log, Fe findings, rules | Documentation |

## 3. Transaction Path

1. **Proposal**: The AI agent creates a candidate transaction `(to, value, data, operation)`.
2. **Off-chain Pre-flight**: The agent runs `leash check` (or calls the embedded native library). The CLI executes pure `policy::decide` natively and outputs `ALLOW` or `DENY <Reason>`. A compliant agent only broadcasts `ALLOW` transactions.
3. **On-chain Ingestion**: The agent calls `LeashModule.Execute`. The module reconstructs the exact same `Tx` and `AgentState`, then evaluates `policy::decide`.
4. **Enforcement**:
   - On `ALLOW`: `policy::record` updates the ledger state, and `LeashModule` calls `Safe.execTransactionFromModule(...)`.
   - On `DENY`: `LeashModule` reverts immediately with a typed custom error (or records denial in `TryExecute`). No state is modified.
5. **Fingerprint Verification**: Both CLI and Module expose `fingerprint`, which computes the identical keccak-256 digest of the canonical policy encoding. Operators can verify that off-chain agents and on-chain guards execute the exact same policy rules.
