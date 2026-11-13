#!/usr/bin/env bash
set -euo pipefail

BINARY=""
for cand in out/leash out/cli ingots/cli/out/leash ingots/cli/out/cli; do
    if [ -f "$cand" ]; then
        BINARY="$cand"
        break
    fi
done

if [ -z "$BINARY" ]; then
    echo "Building leash binary..."
    fe build -i cli --backend native || fe build --backend native || true
    for cand in out/leash out/cli ingots/cli/out/leash ingots/cli/out/cli; do
        if [ -f "$cand" ]; then
            BINARY="$cand"
            break
        fi
    done
fi

if [ -z "$BINARY" ]; then
    case "$(uname)" in
        MINGW*|MSYS*|CYGWIN*)
            echo "Windows host detected: Fe native binary linking currently requires an x86-64 Linux or AArch64 macOS host."
            echo "Golden CLI tests execute on Linux in CI."
            exit 0
            ;;
        *)
            echo "Error: native binary not found after build!"
            exit 1
            ;;
    esac
fi

echo "Using binary: $BINARY"
echo "Running golden CLI tests..."
FAILED=0
TOTAL=0

for args_file in test/cli/golden/*.args; do
    TOTAL=$((TOTAL + 1))
    case_name=$(basename "$args_file" .args)
    stdout_file="test/cli/golden/${case_name}.stdout"
    exit_file="test/cli/golden/${case_name}.exit"

    # Read args line-by-line
    args=()
    while IFS= read -r line || [ -n "$line" ]; do
        # Strip CR if present
        line=$(echo "$line" | tr -d '\r')
        if [ -n "$line" ]; then
            args+=("$line")
        fi
    done < "$args_file"

    expected_exit=$(cat "$exit_file" | tr -d ' \r\n')
    
    set +e
    "$BINARY" "${args[@]}" > "test/cli/golden/tmp_${case_name}.out" 2> "test/cli/golden/tmp_${case_name}.err"
    actual_exit=$?
    set -e

    if [ "$actual_exit" -ne "$expected_exit" ]; then
        echo "FAIL [$case_name]: expected exit $expected_exit, got $actual_exit"
        cat "test/cli/golden/tmp_${case_name}.err"
        FAILED=$((FAILED + 1))
        continue
    fi

    if [ -f "$stdout_file" ] && [ -s "$stdout_file" ]; then
        # Normalize line endings
        tr -d '\r' < "test/cli/golden/tmp_${case_name}.out" > "test/cli/golden/tmp_${case_name}.norm.out"
        tr -d '\r' < "$stdout_file" > "test/cli/golden/tmp_${case_name}.norm.expected"
        if ! diff -u "test/cli/golden/tmp_${case_name}.norm.out" "test/cli/golden/tmp_${case_name}.norm.expected" > "test/cli/golden/tmp_${case_name}.diff"; then
            echo "FAIL [$case_name]: stdout mismatch:"
            cat "test/cli/golden/tmp_${case_name}.diff"
            FAILED=$((FAILED + 1))
            continue
        fi
    fi

    echo "PASS [$case_name]"
    rm -f "test/cli/golden/tmp_${case_name}"*
done

if [ "$FAILED" -gt 0 ]; then
    echo "Golden tests: $FAILED / $TOTAL failed"
    exit 1
fi

echo "All $TOTAL golden tests passed!"
exit 0
