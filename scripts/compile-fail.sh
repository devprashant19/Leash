#!/usr/bin/env bash
# Compile-fail tests on the project's own code.
#
# Each case copies ingots/ to a temporary folder, makes one forbidden change to a real source file
# (an anchor line and what replaces it), and requires `fe check` to reject the copy with the expected
# diagnostic. If an anchor is no longer found exactly once, the real code has changed and the case
# fails, so a case cannot pass by testing nothing.
set -euo pipefail

PY=$(command -v python3 || command -v python)
ROOT=$(pwd)
WORK=$(mktemp -d)
trap 'rm -rf -- "${WORK:?}"' EXIT

passed=0
failed=0
skipped=0
n=0

# case_ NAME INGOT BACKEND EXPECTED [FILE ANCHOR REPLACEMENT]...
case_() {
    local name=$1 ingot=$2 backend=$3 expected=$4
    shift 4
    n=$((n + 1))
    local dir="$WORK/$n"
    mkdir -p "$dir"
    cp -r "$ROOT/ingots" "$dir/ingots"
    if ! "$PY" - "$dir/ingots" "$@" <<'EOF'
import sys
root, rest = sys.argv[1], sys.argv[2:]
for i in range(0, len(rest), 3):
    path, anchor, replacement = rest[i], rest[i + 1], rest[i + 2]
    full = f"{root}/{path}"
    text = open(full, "rb").read().decode()
    if text.count(anchor) != 1:
        sys.exit(f"anchor found {text.count(anchor)} times in {path}: {anchor!r}")
    open(full, "wb").write(text.replace(anchor, replacement, 1).encode())
EOF
    then
        echo "FAIL (the real code changed; update this case): $name"
        failed=$((failed + 1))
        return
    fi
    local out
    # shellcheck disable=SC2086
    if out=$(fe check $backend "$dir/ingots/$ingot" 2>&1); then
        echo "FAIL (expected a compile error, but it compiled): $name"
        failed=$((failed + 1))
    elif grep -qF -- "$expected" <<<"$out"; then
        echo "PASS $name: $expected"
        passed=$((passed + 1))
    else
        echo "FAIL (rejected, but not with '$expected'): $name"
        echo "$out" | head -20
        failed=$((failed + 1))
    fi
}

DECIDE=$'pub fn decide(_ tx: ref Tx, _ policy: ref Policy, _ state: ref AgentState) -> Verdict {\n'

echo "Compile-fail tests: one forbidden change to the real code, which the compiler must reject"

# Baseline: the unchanged copy compiles, so every rejection below comes from its one change.
mkdir -p "$WORK/baseline"
cp -r "$ROOT/ingots" "$WORK/baseline/ingots"
for ingot in policy module cli; do
    if ! fe check "$WORK/baseline/ingots/$ingot" >/dev/null 2>&1; then
        echo "FAIL baseline: the unchanged copy of ingots/$ingot does not compile"
        exit 1
    fi
done
echo "baseline: the unchanged copies of policy, module and cli compile"

# Effects: the guardian's Pause handler declares `uses (ctx, safe, guardian, mut paused, mut log)`,
# so it cannot touch the agent registry (or anything else but `paused`).
case_ guardian_cannot_write_agents module "" "is not in this handler's" \
    module/src/lib.fe \
    $'            paused = true\n            log.emit(PausedEvent' \
    $'            paused = true\n            agents.set(key: caller, value: agents.get(key: caller))\n            log.emit(PausedEvent'

# Effects: Execute may read `agents` but not write it, so a reverting Execute cannot count a denial.
case_ execute_cannot_write_agents module "" "mutable borrow requires a mutable place" \
    module/src/lib.fe \
    $'                revert_error(CircuitTripped {})\n            }\n\n            let now = ctx.timestamp()' \
    $'                revert_error(CircuitTripped {})\n            }\n            cfg.denials += 1\n            agents.set(key: agent, value: cfg)\n\n            let now = ctx.timestamp()'

# Purity: decide gets the agent's state by `ref`, so it cannot book a spend; only record (mut) can.
case_ decide_cannot_write_the_ledger policy "" "mutable borrow requires a mutable place" \
    policy/src/rules.fe "$DECIDE" "${DECIDE}    ingot::ledger::record(tx, policy, mut state)"$'\n'

# Units: Wei and Duration are different types, even inside decide.
case_ decide_cannot_add_wei_to_a_duration policy "" "type mismatch" \
    policy/src/rules.fe "$DECIDE" "${DECIDE}    let _ = tx.value + policy.window"$'\n'

# Effects in the native CLI: `leash check` gets Args, Stdout and Stderr only, so it cannot call
# anything that reads files (replay needs Fs). The CLI's file access exists on Unix targets only.
case "$(uname -s)" in
    MINGW* | MSYS* | CYGWIN*)
        echo "SKIP check_cannot_read_files: needs a Unix native target (CI runs it on Linux)"
        skipped=$((skipped + 1))
        ;;
    *)
        case_ check_cannot_read_files cli "--backend native" "missing effect" \
            cli/src/check.fe $'use core::MemBuffer\n' $'use core::MemBuffer\nuse ingot::replay\n' \
            cli/src/check.fe \
            $'pub fn run() -> i32 uses (args: Args, out: mut Stdout, err: mut Stderr) {\n' \
            $'pub fn run() -> i32 uses (args: Args, out: mut Stdout, err: mut Stderr) {\n    let _ = replay::run()\n'
        ;;
esac

# Compile-time validation (policy/src/invariants.fe) of the policy in policy/src/config.fe.
CONST_ERR="division by zero in const context"
case_ policy_per_tx_cap_above_the_window policy "" "$CONST_ERR" \
    policy/src/config.fe $'        ether(1) / 10\n' $'        ether(1)\n'
case_ policy_with_no_targets policy "" "$CONST_ERR" \
    policy/src/config.fe '        n_targets: 2,' '        n_targets: 0,'
case_ policy_with_a_zero_window policy "" "$CONST_ERR" \
    policy/src/config.fe '        window: hours(24),' '        window: hours(0),'
case_ policy_with_a_12_hour_window policy "" "$CONST_ERR"     policy/src/config.fe '        window: hours(24),' '        window: hours(12),'
case_ policy_with_rate_limiting policy "" "$CONST_ERR" \
    policy/src/config.fe '        max_actions_per_window: 0,' '        max_actions_per_window: 10,'
case_ policy_with_a_cooldown policy "" "$CONST_ERR" \
    policy/src/config.fe '        cooldown: seconds(0),' '        cooldown: seconds(60),'
case_ policy_with_another_breaker_threshold policy "" "$CONST_ERR" \
    policy/src/config.fe '        breaker_threshold: 0,' '        breaker_threshold: 5,'

if [ "$failed" -gt 0 ]; then
    echo "compile-fail suite failed: $failed failed, $passed passed, $skipped skipped"
    exit 1
fi
echo "compile-fail suite passed: $passed changes to the real code rejected with the expected diagnostic ($skipped skipped)"
