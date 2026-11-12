# Phase 3 — Native CLI and C library

| | |
|---|---|
| **Dates** | Nov 19–20, 2026 (2 days) |
| **Roadmap stage** | 4 — features D1, D2, D3, D5, D7 |
| **Depends on** | Phase 1 gate (policy API) and Phase 2 gate (`State` encoding, `Fingerprint`) |
| **Goal** | A `leash` binary built from the same policy source that predicts every on-chain verdict, plus an optional C static library for agent frameworks. |
| **Skills** | superpowers TDD; `/ponytail-review` (keep the CLI thin: parsing and printing only); addy api-and-interface-design for the command surface and exit codes |

**Iron rule for this phase:** `ingots/cli` does parsing and printing **only**. Every verdict comes from `policy::decide`, every state change from `policy::record`, every message text from `policy::explain_reason` / `policy::explain_policy`, and every hash from `policy::fingerprint`. If you are about to write a comparison against a cap inside `cli/`, stop.

---

## Command surface (contract in [00-project-context.md §9](00-project-context.md))

| Command | Input | Output | Exit code |
|---|---|---|---|
| `leash check --to 0x… --value 0.05 --data 0x… [--op call] [--now <unix>] [--state 0x…]` | One proposed tx | `ALLOW` or `DENY <Reason>: <message>` | 0 allow, 2 deny, 1 bad input |
| `leash explain` | Built-in policy | Plain-English list of every limit | 0 |
| `leash fingerprint` | Built-in policy | `0x` + 64 hex chars (Keccak-256 of the canonical policy encoding) | 0 |
| `leash replay log.csv` | CSV `timestamp,to,value,data,op` | Verdict per row + summary counts | 0, or 2 if any deny; 1 bad input |
| `leash --help` / `--version` | — | Usage; `leash 0.1.0 (fe 26.6.0)` | 0 |

`--json` for `check` is added in Phase 4. Design the output code so adding it is a small change (one `Report` struct, two printers).

### Argument rules

- `--to`: 20-byte hex with `0x`. Wrong length or bad hex → stderr message + exit 1.
- `--value`: decimal ETH (`0.05`), parsed with `UFixed::parse` into `Wei` (18 decimals). More than 18 decimals → exit 1. `--value-wei <int>` is an alternative; giving both → exit 1. Default 0.
- `--data`: hex, default `0x`. Odd length → exit 1.
- `--op`: `call` (default) or `delegatecall`. Anything else → exit 1.
- `--now`: unix seconds. If std has a native clock effect, the default is the current time; otherwise `--now` is required by `check` (exit 1 with a clear message). **Golden tests always pass `--now`** so they are deterministic.
- `--state`: hex from the module's `State` message, decoded with `policy::decode_state`. Default: an empty state (not paused, no spend, `expiry` = max).
- Unknown flags → exit 1 with usage on stderr. Usage goes to stdout only for `--help`.

---

## Tasks

### T1 — `cli/main.fe` skeleton (1.5 h)

- [ ] `pub fn main() -> i32 uses (args: Args, out: mut Stdout, err: mut Stderr, fs: Fs)`. Read the real 26.6 signature for native `main` in the fe-26 skill.
- [ ] Dispatch on the first argument to `check`, `explain`, `fingerprint`, `replay`, `--help`, `--version`.
- [ ] **Only `replay` receives the `Fs` effect.** Pass narrower effect sets into each subcommand function, so the signatures prove that `check` cannot touch the file system. Write this in ARCHITECTURE.md; it is a Fe-specific talking point.

### T2 — Argument parsing (2 h) — `cli/src/args.fe`

- [ ] Use `core::text` (`parse_uint`, `decode_hex`) and `UFixed::parse`. Do not hand-roll a hex decoder if std has one.
- [ ] Unit tests (native) for each rule above, including every bad-input case → exit 1.

### T3 — `leash check` (2 h) — `cli/src/check.fe`

- [ ] Build `Tx` and `AgentState`, call `policy::decide(tx, DEFAULT_POLICY, state)`.
- [ ] Print `ALLOW`, or `DENY <reason_name>: <explain_reason(...)>`. Exit 0 or 2.
- [ ] No other logic.

### T4 — `leash explain` (D2) (1.5 h) — `cli/src/explain.fe`

- [ ] Prints every limit in plain English with units, from the policy constants, through a policy function `policy::explain_policy(policy) -> String` (or a list of lines). For example:

```
Leash policy (fingerprint 0x1234…abcd)
- The agent may call 2 contracts:
  - 0xToken… (ERC-20): transfer, approve, transferFrom
  - 0xTreasury…: plain ETH transfers
- At most 0.1 ETH per transaction.
- At most 0.5 ETH in any rolling 24 hours (hourly buckets).
- Token 0xToken…: at most 100 tokens per transfer; approvals up to 100 tokens; unlimited approvals are always refused.
- Delegatecall is always refused.
- Anything not listed above is refused.
```

- [ ] Wei is printed as ETH with trailing zeros trimmed; durations as hours/minutes. The formatting helpers live in policy (native-only `#[cfg]` is fine) or in cli (pure formatting, no rules). Formatting is allowed in cli; **deciding is not**.
- [ ] This text is later pasted **verbatim** into the README.

### T5 — `leash fingerprint` (D3) (0.5 h)

- [ ] Prints `policy::fingerprint(DEFAULT_POLICY)` as `0x…`.
- [ ] Test: equals the pinned vector from Phase 1, and therefore equals the module's `Fingerprint` (Phase 2 test 22). Also add one test that compares the two directly if the harness allows a cross-backend comparison. Otherwise the shared pinned vector is the link; explain this in the test file.

### T6 — `leash replay` (D5) (2.5 h) — `cli/src/replay.fe`

- [ ] Reads the CSV through `Fs`. Header required, exactly `timestamp,to,value,data,op`. Any bad row → stderr `line N: <problem>`, exit 1, and no partial summary.
- [ ] For each row in order: build `Tx` (with `now = timestamp`, `value` in wei), `decide`; if Allow, `record` into an in-memory ledger. The state starts empty (or from `--state`).
- [ ] Output, one line per row: `N,<timestamp>,ALLOW` or `N,<timestamp>,DENY,<Reason>`. Then the summary `allowed=X denied=Y` and per-reason counts sorted by code.
- [ ] Timestamps must be non-decreasing. If not, exit 1 (the ledger assumes time moves forward).
- [ ] Exit 0 if no denials, 2 if any.

### T7 — Golden-file tests (2 h) — `test/cli/golden/`

- [ ] Layout: `NN-name.args` (one arg per line), `NN-name.stdout`, `NN-name.exit`, and an optional `NN-name.csv` input.
- [ ] A runner `scripts/golden.sh` builds `out/leash`, runs every case, diffs stdout, and checks the exit code. `make golden` calls it; CI job `golden`.
- [ ] Cases: one ALLOW and one DENY per deny reason reachable through `check`; every bad-input class; `explain`; `fingerprint`; `--help`; `--version`; `replay` with a mixed log (allow, window-cap deny after several allows, rollover allow); replay with a bad row; replay with decreasing timestamps.
- [ ] **Fixture parity:** for every Phase 1 test fixture, generate a golden `check` case and confirm the CLI verdict equals the verdict asserted in the EVM test. Write `scripts/fixtures-to-golden` (a Fe native test or a small script) so this list cannot drift.

### T8 — Optional: C static library (D7) (2 h, Could)

- [ ] `cli/src/export.fe` (or a separate `ingots/ffi`): `#[unsafe(export)] pub fn leash_check(to: *const u8, value_be32: *const u8, data: *const u8, data_len: usize, op: u8, now: u64, state: *const u8, state_len: usize) -> u8` → returns the deny code (0 = allow, 255 = bad input). It calls `policy::decide` only.
- [ ] `fe build --backend native --emit staticlib` → `libleash.a`. Add `examples/c/leash.h` and a ~20-line `examples/c/main.c` that links it and checks one allowed and one denied tx; `make example-c` builds and runs it with `cc`.
- [ ] Test: the example's codes match the CLI for the same inputs (a script).
- [ ] If the export ABI does not work on 26.6, record the finding and drop it (it is a Could item).

---

## Exit gate

- [ ] `fe build --backend native` produces `out/leash` (or the documented output path). All golden tests pass (`make golden`).
- [ ] `leash fingerprint` equals the contract's `Fingerprint` return value in a test (through the shared pinned vector, at minimum).
- [ ] Running `check` on every Phase 1 fixture gives the same verdict as the EVM tests (T7 fixture parity).
- [ ] `/ponytail-review` finds **no rule logic inside `cli/`** (only I/O). The CI grep for policy internals is green.
- [ ] Effect signatures: only `replay` has `Fs` (show the grep in the AI log).
- [ ] Phases 1–2 suites still green on both backends.
- [ ] README draft gains a "CLI" section with real `leash explain` output.
- [ ] Standard + review gate output pasted; handoff; commit `chore: phase 3 complete`.

## Fallbacks

- **`UFixed::parse` is missing or broken:** parse decimal ETH by hand in `cli/args.fe` (string → integer wei). Test it heavily, and record the finding.
- **No native clock:** `--now` is required; document it.
- **`Fs` reading is awkward:** read the CSV from stdin (`leash replay - < log.csv`) as a fallback; keep the `Fs` version as the goal and document the gap.
