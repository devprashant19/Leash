#!/usr/bin/env bash
set -euo pipefail

echo "Running tests on EVM backend for policy ingot..."
EVM_OUT=$(fe test ingots/policy 2>&1)
echo "$EVM_OUT"
EVM_PASS=$(echo "$EVM_OUT" | grep -oE '[0-9]+ passed' | head -n 1 | awk '{print $1}')

echo "EVM passed count: $EVM_PASS"

case "$(uname)" in
    MINGW*|MSYS*|CYGWIN*)
        echo "Windows host detected: Native executable test runner requires Linux/macOS linking."
        echo "EVM tests verified: $EVM_PASS passed."
        ;;
    *)
        echo "Running tests on native backend for policy ingot..."
        NATIVE_OUT=$(fe test ingots/policy --backend native 2>&1)
        echo "$NATIVE_OUT"
        NATIVE_PASS=$(echo "$NATIVE_OUT" | grep -oE '[0-9]+ passed' | head -n 1 | awk '{print $1}')
        echo "Native passed count: $NATIVE_PASS"

        if [ "$EVM_PASS" -ne "$NATIVE_PASS" ]; then
            echo "MISMATCH: EVM ($EVM_PASS) vs Native ($NATIVE_PASS)"
            exit 1
        fi
        echo "Test counts match on both backends: $EVM_PASS"
        ;;
esac

exit 0
