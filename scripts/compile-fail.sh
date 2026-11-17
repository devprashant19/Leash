#!/usr/bin/env bash
set -euo pipefail

echo "Running compile-fail tests with expected error diagnostics..."
passed=0
failed=0

for file in test/compile_fail/*.fe; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        case "$filename" in
            units_mixing.fe)
                expected="type mismatch"
                ;;
            duplicate_targets.fe|empty_targets.fe|per_tx_above_window.fe|zero_address_target.fe|zero_window.fe)
                expected="division by zero in const context"
                ;;
            *)
                expected="error"
                ;;
        esac

        output=$(fe check "$file" 2>&1 || true)
        if fe check "$file" > /dev/null 2>&1; then
            echo "FAIL (expected error, but compiled successfully): $file"
            failed=$((failed + 1))
        elif echo "$output" | grep -qi "$expected"; then
            echo "PASS (correctly rejected with diagnostic '$expected'): $filename"
            passed=$((passed + 1))
        else
            echo "FAIL (rejected, but diagnostic did not match expected '$expected'): $file"
            echo "Compiler output: $output"
            failed=$((failed + 1))
        fi
    fi
done

if [ "$failed" -gt 0 ]; then
    echo "compile-fail suite failed: $failed test(s) failed"
    exit 1
fi

echo "compile-fail suite passed: $passed file(s) correctly rejected with matching diagnostics"
exit 0
