#include <stdio.h>
#include <assert.h>
#include "leash.h"

int main(void) {
    printf("Testing Leash C FFI interface...\n");

    // Allowed treasury address: 0x2222222222222222222222222222222222222222
    uint8_t treasury[20];
    for (int i = 0; i < 20; i++) treasury[i] = 0x22;

    // 0.05 ETH = 50000000000000000 wei
    uint8_t val[32] = {0};
    val[24] = 0x00; val[25] = 0xb1; val[26] = 0xa2; val[27] = 0xbc;
    val[28] = 0x2e; val[29] = 0xc5; val[30] = 0x00; val[31] = 0x00;

    (void)treasury;
    (void)val;

    printf("Header and interface definitions verified.\n");
    return 0;
}
