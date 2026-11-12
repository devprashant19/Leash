#!/usr/bin/env bash
set -euo pipefail

echo "Running compile-fail tests..."
passed=0
failed=0

for file in test/compile_fail/*.fe; do
    if [ -f "$file" ]; then
        if fe check "$file" > /dev/null 2>&1; then
            echo "FAIL (expected error, but compiled successfully): $file"
            failed=$((failed + 1))
        else
            echo "PASS (correctly failed to compile): $file"
            passed=$((passed + 1))
        fi
    fi
done

if [ "$failed" -gt 0 ]; then
    echo "compile-fail suite failed: $failed unexpected pass(es)"
    exit 1
fi

echo "compile-fail suite passed: $passed file(s) correctly rejected"
exit 0
