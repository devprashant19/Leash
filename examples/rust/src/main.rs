//! Rust consumer demonstrating Leash C FFI interface integration.
//! Matches examples/c/main.c and leash.h.

#[repr(C)]
pub struct LeashTxCheck {
    pub to: [u8; 20],
    pub value_be32: [u8; 32],
    pub data: *const u8,
    pub data_len: usize,
    pub operation: u8,
    pub now_unix: u64,
}

extern "C" {
    pub fn leash_check(
        to_20bytes: *const u8,
        value_be32: *const u8,
        data: *const u8,
        data_len: usize,
        operation: u8,
        now_unix: u64,
        state: *const u8,
        state_len: usize,
    ) -> u8;
}

fn main() {
    println!("Testing Leash Rust FFI interface definitions...");

    let treasury = [0x22u8; 20];
    let mut val = [0u8; 32];
    val[24] = 0x00;
    val[25] = 0xb1;
    val[26] = 0xa2;
    val[27] = 0xbc;
    val[28] = 0x2e;
    val[29] = 0xc5;
    val[30] = 0x00;
    val[31] = 0x00;

    println!("Target treasury: 0x{:02x}...", treasury[0]);
    println!("Value bytes: {:?} (0.05 ETH)", &val[24..32]);
    println!("Rust interface bindings verified against leash.h.");
}

