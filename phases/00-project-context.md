# 00 — Project context and shared contracts

Read this file at the start of every session. It is the **single source of truth** for names, codes, encodings and decisions that more than one phase depends on. If a phase file and this file disagree, this file wins. Fix the phase file and log the change in `docs/ai-log.md`.

---

## 1. Pitch and highlight (copy these exactly into the form and the README)

- **Pitch:** Leash gives AI agents a Safe wallet with spending limits written once in Fe — the same code enforces them on-chain and pre-checks them off-chain, so the two can never drift.
- **Fe-specific highlight:** every policy rule is an effect-checked function, so a reviewer can read from signatures alone which code can move funds, and the identical source builds for both the EVM and native targets.

---

## 2. Feature set (from the plan)

| # | Feature | What it does | Fe capability it shows | Priority | Phase |
|---|---|---|---|---|---|
| 1 | Typed limits | Caps in `Wei`, windows in `Duration`, expiry in `Timestamp`; mixing them is a compile error | Typed units in std | Must | 1 |
| 2 | Target + selector allowlist | Agent may call only listed contracts and functions | Compile-time `sol("…")` selectors | Must | 1 |
| 3 | Per-transaction and rolling-window ETH caps | e.g. ≤ 0.1 ETH per tx, ≤ 0.5 ETH per 24 h | Effects: only `record` may write the ledger | Must | 1 |
| 4 | ERC-20 calldata limits | Decodes `transfer`, `approve`, `transferFrom`; per-token caps; blocks unlimited approvals | ABI decoding in std | Must | 1 |
| 5 | No delegatecall | Denies operation type 1, closing the MultiSend bypass | Enums + exhaustive match | Must | 1 |
| 6 | LeashModule contract | Agent calls the module; module checks policy, then calls the Safe | `msg` / `recv`, contract effects | Must | 2 |
| 7 | `leash check` CLI | Prints ALLOW or DENY with the reason, from the same code | Native backend, `Args`, `Stdout` effects | Must | 3 |
| 8 | Same tests on both backends | `fe test` and `fe test --backend native` pass the same suite | One codebase, two targets | Must | 1–5 |
| 9 | Typed deny reasons | Each denial reverts with a Solidity-compatible custom error and is reported by an event | `#[error]` types | Should | 2 |
| 10 | Kill switch | Safe owner or a guardian pauses the agent instantly | Effects separate guardian powers | Should | 2 |
| 11 | Session keys | Several agents, each with its own policy and expiry | Generic `Policy` per agent | Should | 2 (expiry), 4 (own policy) |
| 12 | Recipient allowlist and rate limit | Limits counterparties and tx count per window | `StorageMap`, typed time | Should | 4 |
| 13 | Compile-time policy validation | Bad constants (zero window, empty allowlist, duplicates) fail the build | `const fn` + `static_assert` | Should | 4 |
| 14 | Policy fingerprint | Contract and CLI print the same keccak hash of the policy | `core::hash` keccak on both targets | Should | 1 (fn), 2, 3 |
| 15 | `leash explain` | Prints the policy in plain English from the same constants | Native text formatting | Should | 3 |
| 16 | `leash replay` | Audits a CSV log of agent transactions and lists would-be denials | `Fs` effect, text parsing | Should | 3 |
| 17 | Escalation queue | Above a threshold, a tx waits a delay and the owner can veto | Timestamps, state machine enum | Could | 4 / stage 10 |
| 18 | C static library + C/Rust agent demo | Agent frameworks link the exact policy check | `#[unsafe(export)]`, `--emit staticlib` | Could | 3 |
| 19 | Swap guard | Decodes a Uniswap `exactInputSingle` and caps size and tokens | Solidity struct ABI mapping | Could | 4 / stage 9 |
| 20 | Demo dashboard | Static page comparing CLI predictions with on-chain outcomes | Non-Fe frontend (allowed) | Could | 6 |

The full A–E specifications live in the phase files that build them. The ID → phase map is in §12.

---

## 3. Architecture

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

### Components

| Ingot / folder | Target | Responsibility | Allowed effects |
|---|---|---|---|
| `ingots/policy` | EVM + native | Types (`Tx`, `Policy`, `Verdict`, `DenyReason`, `AgentState`), calldata decoding, `decide`, `record`, `fingerprint`, `validate`, `explain` text, encoding | **None** for `decide`; `mut Ledger` only for `record` |
| `ingots/module` | EVM | `LeashModule`: agent entry, owner admin, kill switch, events, forwards to the Safe | Storage, Ctx, Call, Log |
| `ingots/cli` | Native | `leash check / explain / fingerprint / replay / validate / encode`; optional static library | Args, Stdout, Stderr, Fs, Exit |
| `ingots/testkit` | EVM + native | MockSafe, MockErc20, seeded tx generator, shared fixtures | Test-only |
| `demo/` | Node/TS | Sepolia and Anvil deploy, scripted agent (viem), dashboard page | Not Fe (allowed for scripts and frontends) |
| `docs/` | — | Architecture, threat model, ADRs, AI log, Fe findings, rules | — |

### Repository layout (target end state)

```
leash/
├─ fe.toml                       # workspace: policy, module, cli, testkit
├─ ingots/
│  ├─ policy/src/{lib,types,decode,rules,ledger,fingerprint,validate,explain,encoding}.fe
│  ├─ module/src/{lib,admin,events,errors}.fe
│  ├─ cli/src/{main,check,explain,replay,export,args,json}.fe
│  └─ testkit/src/{mock_safe,mock_erc20,gen,fixtures}.fe
├─ test/{policy,module,parity,attacks,cli/golden,compile_fail}/
├─ examples/{c,rust}/
├─ demo/{deploy.ts,agent.ts,local.ts,run.json,dashboard/}
├─ docs/{ARCHITECTURE.md,THREAT_MODEL.md,RULES.md,FE_FINDINGS.md,GAS.md,ai-log.md,adr/,handoff/}
├─ .claude/skills/{fe-26,leash}/
├─ Makefile  README.md  DECLARATION.md  LICENSE  AGENTS.md  GLOSSARY.md  CONSTRAINTS.md
└─ .github/workflows/ci.yml      # fmt, check, test (EVM + native), build, sizes, parity, grep rules
```

Phase files may add files. They must not move rule logic out of `ingots/policy`.

### Transaction path

1. The agent proposes a call `(to, value, data, operation)`.
2. **Off-chain:** `leash check` runs `policy::decide` natively and prints the verdict. A well-behaved agent sends only ALLOW calls.
3. **On-chain:** the agent calls `LeashModule.Execute`. The module builds the same `Tx` and `AgentState` and runs the same `decide`. On ALLOW, `record` updates the ledger.
4. On ALLOW the module calls the Safe's `execTransactionFromModule`. On DENY it reverts with a typed error and nothing moves.
5. Both sides print the same policy fingerprint, so a reviewer can confirm the checker matches the deployed rules.

---

## 4. Invariants (never break these; CI checks the first three)

1. `decide` has **no `uses` clause**. It is pure. (CI grep.)
2. Only `record` (and later the circuit breaker, which also lives in policy) may write ledger state. (Effect signatures + review.)
3. No file under `ingots/cli/` or `ingots/module/` contains rule logic. They import only the public API of `policy`. (CI grep + `/ponytail-review`.)
4. **Default deny.** Anything not explicitly allowed is denied. No match arm returns `Allow` as a fall-through.
5. A denied tx never changes the ledger. `decide` never panics or reverts on any input; malformed input gives `Deny(MalformedCalldata)`.
6. **Checks → effects → interactions** in the module: `record` runs before the external call to the Safe.
7. The guardian can only pause. It can never unpause, raise limits, or add agents.
8. Deny codes (§6) are **append-only**. A code is never renumbered or reused.
9. The policy encoding (§8) is frozen at `v0.1.0-freeze`. Any later change bumps the encoding version.

---

## 5. Core types (sketch — check real Fe 26.6 syntax before writing)

```fe
// ingots/policy/src/types.fe  — SKETCH, not verified syntax
pub enum Operation { Call, DelegateCall }          // ABI value 0 and 1, like Safe's Enum.Operation

pub struct Tx {
    to: Address,
    value: Wei,
    data: Bytes,            // or a bounded byte array if Bytes is not available on both backends
    op: Operation,
    now: Timestamp,         // block.timestamp on-chain; --now or the clock in the CLI
}

pub enum Verdict { Allow, Deny(DenyReason) }

// Agent-specific state that decide reads. The module loads it from storage;
// the CLI gets it from --state (hex from the module's State message) or starts empty.
pub struct AgentState {
    paused: bool,            // module-wide or per-agent pause (kill switch)
    tripped: bool,           // circuit breaker (Phase 4)
    expiry: Timestamp,       // session key expiry
    eth_window: Window<24>,  // hourly buckets of Wei spent
    token_windows: [Window<24>; MAX_TOKENS],  // Phase 4 (per-token rolling)
    action_window: Window<24>,                // Phase 4 (rate limit: counts)
    last_action: Timestamp,                   // Phase 4 (cooldown)
    denials: Window<24>,                      // Phase 4 (breaker)
}

// Pure: no `uses`, so it cannot touch state.
pub fn decide(tx: Tx, policy: Policy, state: AgentState) -> Verdict

// The only function that may write spending state.
pub fn record(tx: Tx, policy: Policy) uses (ledger: mut Ledger)
```

Name rules: use the `GLOSSARY.md` names in code exactly (Policy, Verdict, DenyReason, Ledger, Window, Bucket, Agent, Guardian, Fingerprint, Session, Rule, Guard).

### Policy representation (ADR-005)

The policy uses **fixed-capacity arrays with counts**, sorted in ascending order, with unused slots zeroed. Why: storage and encoding stay simple and canonical on both backends, the same set always gives the same fingerprint, and duplicates are easy to find.

| Constant | Value (v1) | Meaning |
|---|---|---|
| `MAX_TARGETS` | 8 | allowlisted contracts / ETH recipients |
| `MAX_SELECTORS` | 8 | selectors per target |
| `MAX_TOKENS` | 4 | ERC-20 tokens with rules |
| `MAX_RECIPIENTS` | 8 | token recipients / spenders (Phase 4) |
| `BUCKETS` | 24 | buckets per window |
| `BUCKET_LEN` | 3600 s | bucket length (hourly) |

```fe
pub enum TargetKind { Generic, Erc20, UniswapRouter, AavePool }   // later kinds are appended

pub struct TargetRule {
    target: Address,
    kind: TargetKind,
    allow_eth_transfer: bool,   // empty calldata + value allowed
    delegate_ok: bool,          // false by default; A2
    n_selectors: u8,
    selectors: [u32; MAX_SELECTORS],   // sorted, built from sol("…") constants
}

pub struct TokenRule {
    token: Address,
    max_per_tx: TokenAmount,      // newtype over u256 in policy (std has no token unit)
    max_per_window: TokenAmount,  // Phase 4 per-token window
    max_approve: TokenAmount,     // approve cap; approve(MAX_UINT) always denied
}

pub struct Policy {
    version: u8,                       // = 1
    n_targets: u8,  targets: [TargetRule; MAX_TARGETS],
    max_per_tx: Wei,
    max_per_window: Wei,
    window: Duration,                  // must equal BUCKETS * BUCKET_LEN in v1
    n_tokens: u8,   tokens: [TokenRule; MAX_TOKENS],
    // Phase 4 fields (append only, before the freeze):
    n_recipients: u8, recipients: [Address; MAX_RECIPIENTS],
    max_actions_per_window: u32,       // 0 = rule off
    cooldown: Duration,                // 0 = rule off
    schedule: Schedule,                // trading hours; all-open = rule off
    breaker_threshold: u32,            // 0 = rule off
}
```

---

## 6. Deny codes (append-only, shared by EVM, CLI, JSON, C library and parity digest)

| Code | `DenyReason` | Custom error (Solidity signature) | Introduced | Feature ID |
|---|---|---|---|---|
| 0 | — (Allow) | — | 1 | — |
| 1 | `Paused` | `Paused()` | 1 (checked from state) / 2 | B1 |
| 2 | `SessionExpired` | `SessionExpired()` | 1 / 2 | B2 |
| 3 | `DelegateCallBlocked` | `DelegateCallBlocked()` | 1 | A2 |
| 4 | `TargetNotAllowed` | `TargetNotAllowed()` | 1 | A1 |
| 5 | `SelectorNotAllowed` | `SelectorNotAllowed()` | 1 | A3 |
| 6 | `MalformedCalldata` | `MalformedCalldata()` | 1 | A3/A6 (*added by this playbook*; the docx says malformed input "returns Deny" but names no reason) |
| 7 | `PerTxCapExceeded` | `PerTxCapExceeded()` | 1 | A4 |
| 8 | `WindowCapExceeded` | `WindowCapExceeded()` | 1 | A5 |
| 9 | `TokenCapExceeded` | `TokenCapExceeded()` | 1 | A6 |
| 10 | `UnlimitedApproval` | `UnlimitedApproval()` | 1 | A7 |
| 11 | `RecipientNotAllowed` | `RecipientNotAllowed()` | 4 | A8 |
| 12 | `RateLimited` | `RateLimited()` | 4 | A9 |
| 13 | `CooldownActive` | `CooldownActive()` | 4 | A10 |
| 14 | `OutsideTradingHours` | `OutsideTradingHours()` | 4 | A11 |
| 15 | `CircuitTripped` | `CircuitTripped()` | 4 | B3 |
| 16 | `SwapNotAllowed` | `SwapNotAllowed()` | 4 / stage 9 | C2 |
| 17 | `LendingNotAllowed` | `LendingNotAllowed()` | stage 11 | C3 |
| 18 | `PriceUnavailable` | `PriceUnavailable()` | stage 11 | C4 |
| 19 | `UsdCapExceeded` | `UsdCapExceeded()` | stage 11 | C4 |
| 20 | `EscalationRequired` | `EscalationRequired()` | 4 / stage 10 | B6 |

Errors take no parameters in v1, so the selector is `bytes4(keccak256("Name()"))`. The code is also emitted in events and returned by `TryExecute`, `Preview`, `leash check --json` and the C library.

Non-policy module errors (not deny codes; they guard access, not policy): `NotAgent()`, `NotSafe()`, `NotGuardian()`, `SafeCallFailed()`, `Reentrant()`, `InvalidPolicy()`, `TimelockActive()`.

### Rule order (A12; must match `docs/RULES.md`)

Cheapest and most severe checks first. **The first failing rule wins.**

1. `Paused` → 2. `CircuitTripped` → 3. `SessionExpired` → 4. `OutsideTradingHours` → 5. `CooldownActive` →
6. `DelegateCallBlocked` → 7. `TargetNotAllowed` → 8. calldata shape: `MalformedCalldata` / `SelectorNotAllowed` →
9. `RateLimited` → 10. `PerTxCapExceeded` → 11. `WindowCapExceeded` →
12. protocol guard for the target kind (ERC-20: `RecipientNotAllowed` → `UnlimitedApproval` → `TokenCapExceeded`; Uniswap: `SwapNotAllowed`; Aave: `LendingNotAllowed`) →
13. USD caps: `PriceUnavailable` → `UsdCapExceeded` → 14. `EscalationRequired`.

Rules that are not built yet are skipped. Rules whose policy field is 0 or "off" are skipped.

---

## 7. Window semantics (ADR-002: fixed hourly buckets)

- `Window<const BUCKETS: usize>` holds `BUCKETS` slots of `(bucket_index: u64, amount: u256)`. `bucket_index = now / BUCKET_LEN`.
- **Spent in window** at time `now` = the sum of slots whose `bucket_index > current_index − BUCKETS` (that is, the current bucket and the 23 before it).
- `record` writes into slot `bucket_index % BUCKETS`. If the slot holds an older index, it is reset first.
- **Expiry rule:** an amount recorded in bucket `b` stops counting at the first second of bucket `b + 24`.
- **Rollover test (exact):** spend `cap` at any second in bucket `b`. At the last second of bucket `b+23`, spending 1 wei → `WindowCapExceeded`. At the first second of bucket `b+24`, spending `cap` → Allow.
- **Known approximation (document in THREAT_MODEL and README Limitations):** because buckets are hourly, a real 24-hour interval can contain up to `cap + (one bucket's spend)`, at most 2 × cap in the worst case (spend at 00:59, spend again at 24:00 next day). This is the trade-off ADR-002 accepts for O(24) gas. Future work: smaller buckets or an exact list.
- The same generic `Window` counts Wei (ETH), token amounts (per token), action counts (rate limit) and denial counts (breaker).

---

## 8. Canonical policy encoding and fingerprint (D3)

```
fingerprint = keccak256( "LEASH_POLICY_V1" || enc(policy) )
```

`enc(policy)` is a sequence of 32-byte big-endian words, written in this exact order:

1. `version`
2. `n_targets`, then for **each of the `MAX_TARGETS` slots** (unused slots are all zero): `target` (address, left-padded), `kind`, `allow_eth_transfer`, `delegate_ok`, `n_selectors`, then `MAX_SELECTORS` selector words
3. `max_per_tx`, `max_per_window`, `window`
4. `n_tokens`, then each of the `MAX_TOKENS` slots: `token`, `max_per_tx`, `max_per_window`, `max_approve`
5. Phase 4 fields in the order they appear in the `Policy` struct

Rules:
- Arrays must be sorted ascending, and unused slots zero. `validate` rejects anything else, so one set has exactly one encoding.
- The prefix `"LEASH_POLICY_V1"` is raw ASCII bytes (15 bytes), not padded.
- `encode` and `fingerprint` live in `ingots/policy/src/{encoding,fingerprint}.fe` and are used unchanged by the module (`Fingerprint` message) and the CLI (`leash fingerprint`).
- A test fixture `test/policy/fingerprint_vectors` pins the expected hash of `DEFAULT_POLICY`. Both backends assert against it.

### AgentState encoding (for `State` message → `leash check --state`) (ADR-006)

The module's `State { agent }` message returns `enc(agent_state)`: 32-byte words in struct field order, windows as `BUCKETS × (index, amount)`. `policy::decode_state(bytes)` is the inverse. Both live in policy. The CLI must never rebuild state on its own. It decodes what the module returns.

---

## 9. CLI contract (D1–D5)

| Command | Exit codes |
|---|---|
| `leash check --to 0x… --value <eth> [--value-wei N] [--data 0x…] [--op call\|delegatecall] [--now <unix>] [--state 0x…] [--policy leash.toml] [--json]` | 0 allow · 2 deny · 1 bad input |
| `leash explain [--policy leash.toml]` | 0 |
| `leash fingerprint [--policy leash.toml]` | 0 |
| `leash replay log.csv [--report out.csv] [--policy …]` | 0 none denied · 2 any denied · 1 bad input |
| `leash validate leash.toml` (Phase 4) | 0 valid · 1 invalid |
| `leash encode leash.toml` (Phase 4) | 0 (prints constructor/`SetAgent` args as hex) |
| `leash diff old.toml new.toml` (Phase 4) | 0 same · 2 differs |
| `leash --help`, `leash --version` (prints Leash version and Fe version) | 0 |

Text output for check: `ALLOW` or `DENY <ReasonName>: <plain-English message>`.

`--json` output (stable, a golden-tested schema):

```json
{
  "verdict": "DENY",
  "code": 8,
  "reason": "WindowCapExceeded",
  "message": "This would bring spending in the last 24 h to 0.55 ETH; the limit is 0.5 ETH.",
  "remaining": {
    "eth_per_tx_wei": "100000000000000000",
    "eth_window_wei": "20000000000000000",
    "actions_in_window": 3,
    "tokens": [{ "token": "0x…", "per_tx": "…", "window": "…" }]
  },
  "window_resets_at": 1763942400,
  "fingerprint": "0x…"
}
```

All Wei and token amounts are **decimal strings** (u256 does not fit in JSON numbers). The plain-English `message` text comes from `policy::explain_reason`, a shared function in policy, never from CLI code.

Replay CSV input: header `timestamp,to,value,data,op`. `value` is in wei (integer), `data` is hex (may be `0x`), `op` is `call` or `delegatecall`. Rows are processed in order: `decide`, then `record` on Allow.

---

## 10. Architecture decision records

ADR files live in `docs/adr/NNN-title.md` (Context, Decision, Consequences, Status).

| ADR | Decision | Written in |
|---|---|---|
| 001 | A **module** (not a Safe guard) is the agent's entry point. The agent is not a Safe owner, and the module calls `execTransactionFromModule`. | Phase 0 |
| 002 | Rolling window = **24 fixed hourly buckets** (§7), with the approximation documented | Phase 0 |
| 003 | **Default deny** for everything not allowlisted | Phase 0 |
| 004 | **Deny semantics:** `Execute` reverts with the typed error (atomic; logs are discarded by the EVM on revert). `TryExecute` returns `(bool ok, uint8 code)` without reverting, emits `Denied`, and feeds the circuit breaker. *(Added by this playbook: the docx asks for "revert + emit event", but an EVM revert discards events, so both cannot happen in one call.)* | Phase 2 |
| 005 | Policy = fixed-capacity sorted arrays + canonical encoding (§5, §8) | Phase 1 |
| 006 | CLI reads agent state only through `State` → `--state` hex, decoded by policy | Phase 2/3 |
| 007 | Per-agent policies are stored in module storage, set by `SetAgent`, and checked by the same `validate` fn used at compile time | Phase 4 |
| 008 | Limit changes are asymmetric: lowering applies at once, raising waits for a timelock | Phase 4 |
| 009 | Policy files use TOML parsed with the `lutz` ingot (or a hand-written parser if lutz does not build on 26.6) | Phase 4 |

---

## 11. Submission criteria map (every row must be linked from the README in Phase 7)

| Contest requirement | Leash deliverable | Phase | Proof in repo |
|---|---|---|---|
| Core contribution in Fe | `policy`, `module`, `cli` ingots are 100% Fe; only demo scripts and the dashboard use TS | 1–4 | `fe.toml` workspace, GitHub language stats |
| Public GitHub repo, OSI licence | Apache-2.0 (keep the starter's) | 0 | `LICENSE` |
| Full commit SHA, manifest, exact Fe version | Pinned fe 26.6.0 in CI and README | 0, 7 | `.github/workflows/ci.yml`, README header |
| Reproducible build instructions | `make setup`, `make test`, `make build`, `make demo` | 0, 7 | `Makefile`, README "Quick start" |
| Appropriate automated tests | EVM + native suites, randomized agreement test, attack tests | 1–5 | `test/`, CI badge |
| README: approach, architecture, limitations | From the starter's `SUBMISSION.md` template | 7 | `README.md` |
| Short pitch + Fe-specific highlight | §1 | 7 | README top |
| Demo or reproducible example | 2-min video + scripted Sepolia run + local `make demo` | 6 | `demo/`, video link |
| Declaration of pre-existing work, reused code, AI use | Starter repo noted; Safe interfaces cited; AI log kept from day 1 | 0–7 | `DECLARATION.md`, `docs/ai-log.md` |
| Registered by Nov 17 23:59 UTC | Project ID + private submission link by email | 0 | Confirmation email saved (not in repo) |
| Only work from Nov 3–24 judged | All commits dated in window; starter commit tagged `starter` | 0 | `git log` |

### Judging rubric → where Leash earns points

| Criterion (weight) | How Leash earns it | Phases |
|---|---|---|
| Technical quality (30%) | Clean ingot split, 3 test layers, attack suite, green CI on both backends | 1, 2, 5 |
| Fe-specific value (25%) | Effects bound powers; typed units; one source on EVM + native; `const fn` validation; `#[error]` reasons; C export | 1–4 |
| Originality (20%) | Drift-proof on-chain/off-chain policy with a shared fingerprint | 3, 4 |
| Usefulness or insight (15%) | Ready-made Safe module for agent wallets; reusable policy ingot; written findings on Fe native | 4, 7 |
| Documentation & demo (10%) | README, architecture diagram, video, one-command demo | 6, 7 |

Social reach does not affect the score. Skip promotion until after Nov 24.

---

## 12. Feature ID → where it is built

| IDs | Built in |
|---|---|
| A1–A7, A12 | [Phase 1](phase-1-policy-core.md) |
| B1, B2 (expiry), B7, B8 | [Phase 2](phase-2-module.md) |
| D1, D2, D3, D5, D7 | [Phase 3](phase-3-cli.md) |
| A8–A11, A6 windows, B2 per-agent policy, B3, B4, D1 `--json`, D4, Tier-A explanations | [Phase 4](phase-4-extra-features.md) |
| E1, E2, E3 | [Phase 5](phase-5-verification.md) |
| E4, E6 (E5 optional) | [Phase 6](phase-6-demo.md) |
| E7, docs, submission | [Phase 7](phase-7-submission.md) |
| C1, C5, C2 | [Stage 9](stage-09-defi-guards.md) |
| B5, B6 | [Stage 10](stage-10-override-escalation.md) |
| C3, C4 | [Stage 11](stage-11-aave-usd.md) |
| D6, D8, D9, E5, gas comparison vs Zodiac Roles, audit | [Stage 12](stage-12-tooling-audit.md) |

---

## 13. Agent skills toolkit (one skill per job)

| Skill (repo) | Role in Leash | Phases |
|---|---|---|
| karpathy-guidelines (andrej-karpathy-skills) | Always-on base rules in `AGENTS.md`: think before coding, simplicity first, surgical changes, goal-driven | All |
| obra/superpowers: brainstorming, writing-plans, executing-plans, test-driven-development, systematic-debugging, verification-before-completion, requesting-code-review, dispatching-parallel-agents, finishing-a-development-branch | Main build loop: spec → small plan → red-green TDD → review → verify | 1–5, 7 |
| addyosmani/agent-skills: /spec, /constraints, /test, /review, /ship, security-and-hardening, doubt-driven-development, documentation-and-adrs, api-and-interface-design | Quality gates; `CONSTRAINTS.md`; security pass; ADRs; CLI surface | 0, 2, 3, 5, 7 |
| mattpocock/skills: grill-with-docs, domain-modeling, improve-codebase-architecture, code-review, handoff, wizard | Day-0 grilling; glossary + ADRs; mid-project architecture survey; final review; hand-offs; demo setup script | 0, 1, 4, 6, 7 |
| DietrichGebert/ponytail: /ponytail-review, /ponytail-audit | Keep policy small; whole-repo audit before the freeze | 3, 4, 5, 7 |
| Graphify-Labs/graphify: /graphify | Knowledge graph of Fe std + repo; source for the README architecture section | 0, 4, 7 |
| JuliusBrussee/caveman: /caveman | Short replies during long build/test loops only. **Off** for README, ADRs, demo script | 1–5 |
| Leonxlnx/taste-skill: design-taste-frontend | Dashboard and README hero image only | 6 |
| anthropics/skills: skill-creator | Build the custom `fe-26` skill (and `leash` skill in stage 12) | 0, 12 |

Do not run JSM workflow skills and superpowers together. Pick superpowers. If a listed skill is not installed, follow its intent by hand and note that in the AI log. Do not block on it.

---

## 14. Risks and fallbacks (global)

| Risk | Likelihood | Impact | Mitigation and fallback |
|---|---|---|---|
| Missed registration | Low | Fatal | Register on Nov 13, keep the confirmation email |
| Agent writes invalid Fe 26.6 syntax | High | Medium | fe-26 skill, graphify map of std, `fe check` after every slice |
| Fe compiler bug blocks a feature | Medium | High | Minimal repro → GitHub issue → Zulip office hours → email hello@fe-lang.org; ship a workaround and document it in `docs/FE_FINDINGS.md` |
| Native backend gap (hashing, I/O) | Low–medium | High | Day-0 spikes; fallback keeps native parity for `decide` only and computes the fingerprint off-chain |
| Safe integration on Sepolia slips | Medium | Medium | Local Anvil demo and mock-Safe tests carry the evidence; testnet deploy is optional under the rules |
| Scope creep from the backlog | High | High | Tiered backlog and timeboxes; freeze on Nov 22 |
| Docs left to the last day | Medium | High | Update README and ADRs at every phase gate; Phase 7 only assembles |
| AI-use declaration incomplete | Medium | Medium | One line per AI-assisted change in `docs/ai-log.md` from day 1 |
