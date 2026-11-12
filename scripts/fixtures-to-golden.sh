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
    echo "Error: native binary not found!"
    exit 1
fi

echo "Verifying CLI vs Policy EVM fixture parity..."

assert_verdict() {
    local name="$1"
    local expected_verdict="$2"
    shift 2
    local out
    set +e
    out=$("$BINARY" check "$@" 2>/dev/null)
    local status=$?
    set -e

    if [[ "$out" == *"$expected_verdict"* ]]; then
        echo "PASS [parity: $name] -> $expected_verdict"
    else
        echo "FAIL [parity: $name]: expected '$expected_verdict', got '$out' (exit $status)"
        exit 1
    fi
}

TREASURY="0x2222222222222222222222222222222222222222"
TOKEN="0x1111111111111111111111111111111111111111"
UNKNOWN="0x3333333333333333333333333333333333333333"

# 1. Valid ETH transfer
assert_verdict "valid_eth" "ALLOW" --to "$TREASURY" --value 0.05 --now 1000

# 2. Target not allowed
assert_verdict "unlisted_target" "DENY TargetNotAllowed" --to "$UNKNOWN" --value 0.01 --now 1000

# 3. Per tx cap exceeded
assert_verdict "per_tx_cap" "DENY PerTxCapExceeded" --to "$TREASURY" --value 0.20 --now 1000

# 4. Delegatecall blocked
assert_verdict "delegatecall" "DENY DelegateCallBlocked" --to "$TREASURY" --value 0.01 --op delegatecall --now 1000

# 5. Token transfer valid (50 tokens: transfer(0x4444..., 50))
TRANSFER_50="0xa9059cbb00000000000000000000000044444444444444444444444444444444444444440000000000000000000000000000000000000000000000000000000000000032"
assert_verdict "erc20_transfer_allow" "ALLOW" --to "$TOKEN" --value 0 --data "$TRANSFER_50" --now 1000

# 6. Token transfer over cap (150 tokens)
TRANSFER_150="0xa9059cbb00000000000000000000000044444444444444444444444444444444444444440000000000000000000000000000000000000000000000000000000000000096"
assert_verdict "erc20_transfer_over_cap" "DENY TokenCapExceeded" --to "$TOKEN" --value 0 --data "$TRANSFER_150" --now 1000

# 7. Malformed calldata (3 bytes)
assert_verdict "malformed_calldata" "DENY MalformedCalldata" --to "$TOKEN" --value 0 --data "0x123456" --now 1000

# 8. Unlimited approval blocked (approve(0x4444..., type(uint256).max))
APPROVE_MAX="0x095ea7b30000000000000000000000004444444444444444444444444444444444444444ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
assert_verdict "unlimited_approval" "DENY UnlimitedApproval" --to "$TOKEN" --value 0 --data "$APPROVE_MAX" --now 1000

echo "All fixture parity tests passed!"
exit 0
