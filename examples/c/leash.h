#ifndef LEASH_H
#define LEASH_H

#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

// Deny codes matching Leash specification
#define LEASH_ALLOW 0
#define LEASH_DENY_PAUSED 1
#define LEASH_DENY_SESSION_EXPIRED 2
#define LEASH_DENY_DELEGATECALL_BLOCKED 3
#define LEASH_DENY_TARGET_NOT_ALLOWED 4
#define LEASH_DENY_SELECTOR_NOT_ALLOWED 5
#define LEASH_DENY_MALFORMED_CALLDATA 6
#define LEASH_DENY_PER_TX_CAP_EXCEEDED 7
#define LEASH_DENY_WINDOW_CAP_EXCEEDED 8
#define LEASH_DENY_TOKEN_CAP_EXCEEDED 9
#define LEASH_DENY_UNLIMITED_APPROVAL 10

uint8_t leash_check(
    const uint8_t *to_20bytes,
    const uint8_t *value_be32,
    const uint8_t *data,
    size_t data_len,
    uint8_t operation,
    uint64_t now_unix,
    const uint8_t *state,
    size_t state_len
);

#ifdef __cplusplus
}
#endif

#endif // LEASH_H
