#!/usr/bin/env node
/**
 * scripts/build-policy.mjs
 * 
 * Generates and compiles custom Leash policies from declarative JSON definitions.
 * Eliminates manual Fe editing for custom deployments while maintaining 100%
 * compile-time invariant validation and cryptographic policy fingerprint synchronization.
 * 
 * Usage:
 *   node scripts/build-policy.mjs <path/to/policy.json> [--build] [--output <dir>] [--keep-in-place]
 *   node scripts/build-policy.mjs --restore
 *   node scripts/build-policy.mjs --example
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { keccak256, encodeDeployData, encodeFunctionData, decodeFunctionResult } from 'viem';
import { createVM, runTx } from '@ethereumjs/vm';
import { Common, Mainnet, Hardfork } from '@ethereumjs/common';
import { createLegacyTx } from '@ethereumjs/tx';
import { createBlock } from '@ethereumjs/block';
import {
  Account,
  bytesToHex,
  createAddressFromPrivateKey,
  hexToBytes,
} from '@ethereumjs/util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const CONFIG_FE_PATH = path.join(ROOT, 'ingots', 'policy', 'src', 'config.fe');
const BACKUP_PATH = path.join(ROOT, 'ingots', 'policy', 'src', 'config.fe.default');

const KNOWN_SELECTORS = {
  transfer: 'SEL_TRANSFER',
  approve: 'SEL_APPROVE',
  transferFrom: 'SEL_TRANSFER_FROM',
  increaseAllowance: 'SEL_INCREASE_ALLOWANCE',
  decreaseAllowance: 'SEL_DECREASE_ALLOWANCE',
  uniswapV3ExactInputSingle: 'SEL_UNISWAP_V3_EXACT_INPUT_SINGLE',
  uniswapV2SwapTokens: 'SEL_UNISWAP_V2_SWAP_TOKENS',
  aaveWithdraw: 'SEL_AAVE_WITHDRAW',
  aaveSupply: 'SEL_AAVE_SUPPLY',
  aaveRepay: 'SEL_AAVE_REPAY',
};

const SELECTOR_VALUES = {
  transfer: 0xa9059cbbn,
  approve: 0x095ea7b3n,
  transferFrom: 0x23b872ddn,
  increaseAllowance: 0x39509351n,
  decreaseAllowance: 0xa457c2d7n,
  uniswapV3ExactInputSingle: 0x04e45aafn,
  uniswapV2SwapTokens: 0x38ed1739n,
  aaveWithdraw: 0x69328decn,
  aaveSupply: 0x617ba037n,
  aaveRepay: 0x573ade81n,
};

function parseAmount(val) {
  if (typeof val === 'bigint') return val;
  if (typeof val === 'number') return BigInt(Math.floor(val));
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    if (s.endsWith('ether') || s.endsWith('eth')) {
      const num = parseFloat(s.replace(/ethers?|eth/, '').trim());
      return BigInt(Math.floor(num * 1e18));
    }
    if (s.endsWith('gwei')) {
      const num = parseFloat(s.replace('gwei', '').trim());
      return BigInt(Math.floor(num * 1e9));
    }
    return BigInt(s);
  }
  return 0n;
}

function parseDurationHours(val) {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    if (s.endsWith('days') || s.endsWith('d')) {
      return parseInt(s) * 24;
    }
    if (s.endsWith('hours') || s.endsWith('h')) {
      return parseInt(s);
    }
    return parseInt(s);
  }
  return 24;
}

function normalizeAddress(addr) {
  if (!addr || typeof addr !== 'string') throw new Error(`Invalid address: ${addr}`);
  let clean = addr.trim().toLowerCase();
  if (!clean.startsWith('0x')) clean = '0x' + clean;
  if (!/^0x[0-9a-fA-F]{40}$/.test(clean)) {
    throw new Error(`Address must be a 20-byte hex string (got: ${addr})`);
  }
  return clean;
}

export function calculatePolicyFingerprint(policy) {
  const maxTxWei = parseAmount(policy.max_eth_per_tx ?? '0.1 ether');
  const maxWinWei = parseAmount(policy.max_eth_per_window ?? '0.5 ether');
  const windowHours = parseDurationHours(policy.window_hours ?? 24);
  const cooldownSecs = BigInt(parseInt(policy.cooldown_seconds ?? 0));
  const maxActions = BigInt(parseInt(policy.max_actions_per_window ?? 0));
  const breakerThreshold = BigInt(parseInt(policy.breaker_threshold ?? 0));

  const targets = policy.targets ?? [];
  const tokens = policy.tokens ?? [];
  const recipients = policy.recipients ?? [];

  const words = new Array(138).fill(0n);
  let idx = 0;

  // 1. Version
  words[idx++] = 1n;

  // 2. Targets (8 slots, 13 words each)
  words[idx++] = BigInt(targets.length);
  for (let t = 0; t < 8; t++) {
    const tgt = targets[t];
    if (tgt) {
      words[idx++] = BigInt(normalizeAddress(tgt.address));
      words[idx++] = tgt.kind === 'erc20' ? 1n : 0n;
      words[idx++] = tgt.allow_eth_transfer ? 1n : 0n;
      words[idx++] = 0n; // delegate_ok
      const sels = tgt.selectors ?? [];
      words[idx++] = BigInt(sels.length);
      for (let s = 0; s < 8; s++) {
        if (s < sels.length) {
          const selStr = sels[s];
          let selNum = 0n;
          if (SELECTOR_VALUES[selStr] !== undefined) {
            selNum = SELECTOR_VALUES[selStr];
          } else if (/^0x[0-9a-fA-F]{8}$/.test(selStr)) {
            selNum = BigInt(selStr);
          }
          words[idx++] = selNum;
        } else {
          words[idx++] = 0n;
        }
      }
    } else {
      idx += 13;
    }
  }

  // 3. ETH Caps
  words[idx++] = maxTxWei;
  words[idx++] = maxWinWei;
  words[idx++] = BigInt(windowHours * 3600);

  // 4. Tokens (4 slots, 4 words each)
  words[idx++] = BigInt(tokens.length);
  for (let tok = 0; tok < 4; tok++) {
    const tk = tokens[tok];
    if (tk) {
      words[idx++] = BigInt(normalizeAddress(tk.address));
      words[idx++] = parseAmount(tk.max_per_tx ?? 0);
      words[idx++] = parseAmount(tk.max_per_window ?? 0);
      words[idx++] = parseAmount(tk.max_approve ?? 0);
    } else {
      idx += 4;
    }
  }

  // 5. Recipients (8 slots)
  words[idx++] = BigInt(recipients.length);
  for (let r = 0; r < 8; r++) {
    const rec = recipients[r];
    words[idx++] = rec ? BigInt(normalizeAddress(rec)) : 0n;
  }

  // 6. Action window & Breaker
  words[idx++] = maxActions;
  words[idx++] = cooldownSecs;
  words[idx++] = breakerThreshold;

  const prefix = Buffer.from('LEASH_POLICY_V1', 'utf8');
  const buf = Buffer.alloc(15 + 138 * 32);
  prefix.copy(buf, 0);
  for (let i = 0; i < 138; i++) {
    const hex = words[i].toString(16).padStart(64, '0');
    Buffer.from(hex, 'hex').copy(buf, 15 + i * 32);
  }

  return keccak256(buf);
}

function generateFeSource(policy, fingerprint) {
  const maxTxWei = parseAmount(policy.max_eth_per_tx ?? '0.1 ether');
  const maxWinWei = parseAmount(policy.max_eth_per_window ?? '0.5 ether');
  const windowHours = parseDurationHours(policy.window_hours ?? 24);
  const cooldownSecs = parseInt(policy.cooldown_seconds ?? 0);
  const maxActions = parseInt(policy.max_actions_per_window ?? 0);
  const breakerThreshold = parseInt(policy.breaker_threshold ?? 0);

  const targets = policy.targets ?? [];
  const tokens = policy.tokens ?? [];
  const recipients = policy.recipients ?? [];

  if (targets.length === 0) throw new Error('Policy must define at least one target');
  if (targets.length > 8) throw new Error('Max 8 targets allowed by Leash architecture');
  if (tokens.length > 4) throw new Error('Max 4 tokens allowed by Leash architecture');
  if (recipients.length > 8) throw new Error('Max 8 recipients allowed by Leash architecture');
  if (maxTxWei > maxWinWei) throw new Error(`max_eth_per_tx (${maxTxWei}) cannot exceed max_eth_per_window (${maxWinWei})`);
  if (windowHours !== 24) throw new Error('window_hours must be 24: the ETH window is a ring of 24 hourly buckets');
  // LeashModule stores no action window and no time of the last action, so it cannot enforce rate
  // limits or cooldowns, and it trips the breaker after a fixed 3 refusals. The same rules are checked
  // again at compile time by policy::invariants::validate_policy_invariants.
  if (maxActions !== 0) throw new Error('max_actions_per_window must be 0: LeashModule does not store an action window');
  if (cooldownSecs !== 0) throw new Error('cooldown_seconds must be 0: LeashModule does not store the time of the last action');
  if (breakerThreshold !== 0 && breakerThreshold !== 3) throw new Error('breaker_threshold must be 0 or 3: LeashModule trips the breaker after 3 refusals');

  let fe = `// Generated by scripts/build-policy.mjs — Declarative Custom Policy
use std::evm::Address
use std::evm::units::{Duration, Wei, ether, hours, seconds, wei}
use ingot::invariants::validate_policy_invariants
use ingot::types::{
    MAX_RECIPIENTS,
    MAX_SELECTORS,
    MAX_TARGETS,
    MAX_TOKENS,
    Policy,
    SEL_APPROVE,
    SEL_TRANSFER,
    SEL_TRANSFER_FROM,
    SEL_INCREASE_ALLOWANCE,
    SEL_DECREASE_ALLOWANCE,
    SEL_UNISWAP_V3_EXACT_INPUT_SINGLE,
    SEL_UNISWAP_V2_SWAP_TOKENS,
    SEL_AAVE_WITHDRAW,
    SEL_AAVE_SUPPLY,
    SEL_AAVE_REPAY,
    TargetKind,
    TargetRule,
    TokenAmount,
    TokenRule,
}

`;

  const tokenAddr = tokens[0]?.address ?? targets[0]?.address ?? '0x1000000000000000000000000000000000000001';
  const treasuryAddr = targets.find((t) => t.allow_eth_transfer)?.address ?? targets[1]?.address ?? '0x2000000000000000000000000000000000000002';

  fe += `pub const ADDR_TOKEN: Address = Address::new(${normalizeAddress(tokenAddr)})\n`;
  fe += `pub const ADDR_TREASURY: Address = Address::new(${normalizeAddress(treasuryAddr)})\n`;
  fe += `pub const POLICY_FINGERPRINT: u256 = ${fingerprint}\n\n`;

  fe += `pub const fn policy_for_agent(_ max_tx: Wei, _ max_win: Wei) -> Policy {\n`;
  fe += `    var targets: [TargetRule; MAX_TARGETS] = [TargetRule::empty(); MAX_TARGETS]\n`;

  targets.forEach((t, i) => {
    fe += `    targets[${i}].target = Address::new(${normalizeAddress(t.address)})\n`;
    if (t.allow_eth_transfer) {
      fe += `    targets[${i}].allow_eth_transfer = true\n`;
    }
    if (t.kind === 'erc20') {
      fe += `    targets[${i}].kind = TargetKind::Erc20\n`;
    }
    const sels = t.selectors ?? [];
    if (sels.length > 8) throw new Error(`Target ${i} exceeds maximum 8 selectors`);
    if (sels.length > 0) {
      fe += `    targets[${i}].n_selectors = ${sels.length}\n`;
      sels.forEach((sel, selIdx) => {
        let selExpr = KNOWN_SELECTORS[sel];
        if (!selExpr) {
          if (/^0x[0-9a-fA-F]{8}$/.test(sel)) {
            selExpr = sel;
          } else {
            throw new Error(`Unknown selector '${sel}' on target ${i}`);
          }
        }
        fe += `    targets[${i}].selectors[${selIdx}] = ${selExpr}\n`;
      });
    }
  });

  fe += `\n    var tokens: [TokenRule; MAX_TOKENS] = [TokenRule::empty(); MAX_TOKENS]\n`;
  tokens.forEach((tok, i) => {
    const maxTx = parseAmount(tok.max_per_tx ?? 0);
    const maxWin = parseAmount(tok.max_per_window ?? 0);
    const maxApprove = parseAmount(tok.max_approve ?? 0);
    fe += `    tokens[${i}].token = Address::new(${normalizeAddress(tok.address)})\n`;
    fe += `    tokens[${i}].max_per_tx = TokenAmount::from(${maxTx})\n`;
    fe += `    tokens[${i}].max_per_window = TokenAmount::from(${maxWin})\n`;
    fe += `    tokens[${i}].max_approve = TokenAmount::from(${maxApprove})\n`;
  });

  fe += `\n    var recs: [Address; MAX_RECIPIENTS] = [Address::new(0); MAX_RECIPIENTS]\n`;
  recipients.forEach((rec, i) => {
    fe += `    recs[${i}] = Address::new(${normalizeAddress(rec)})\n`;
  });

  fe += `
    let tx_cap = if max_tx.as_wei() > 0 {
        max_tx
    } else {
        wei(${maxTxWei})
    }
    let win_cap = if max_win.as_wei() > 0 {
        max_win
    } else {
        wei(${maxWinWei})
    }

    Policy {
        version: 1,
        n_targets: ${targets.length},
        targets,
        max_per_tx: tx_cap,
        max_per_window: win_cap,
        window: hours(${windowHours}),
        n_tokens: ${tokens.length},
        tokens,
        n_recipients: ${recipients.length},
        recipients: recs,
        max_actions_per_window: ${maxActions},
        cooldown: seconds(${cooldownSecs}),
        breaker_threshold: ${breakerThreshold},
    }
}

pub const fn default_policy() -> Policy {
    policy_for_agent(max_tx: Wei::zero(), max_win: Wei::zero())
}

// Compile-time invariant guard: aborts compilation if invariant is violated
pub const DEFAULT_POLICY_COMPILED_VALID: u32 = validate_policy_invariants(pol: default_policy())
`;

  return fe;
}

function showExample() {
  const example = {
    max_eth_per_tx: "0.1 ether",
    max_eth_per_window: "0.5 ether",
    window_hours: 24,
    cooldown_seconds: 0,
    breaker_threshold: 3,
    targets: [
      {
        address: "0x1000000000000000000000000000000000000001",
        kind: "erc20",
        selectors: ["approve", "transferFrom", "transfer"]
      },
      {
        address: "0x2000000000000000000000000000000000000002",
        allow_eth_transfer: true
      }
    ],
    tokens: [
      {
        address: "0x1000000000000000000000000000000000000001",
        max_per_tx: "100000000000000000000",
        max_per_window: "500000000000000000000",
        max_approve: "100000000000000000000"
      }
    ],
    recipients: []
  };
  console.log(JSON.stringify(example, null, 2));
}

async function verifyOnChainFingerprint(binHex, abi, expectedFp) {
  const common = new Common({ chain: Mainnet, hardfork: Hardfork.Prague });
  const vm = await createVM({ common });
  const deployerKey = hexToBytes('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
  const deployerAddr = createAddressFromPrivateKey(deployerKey);
  await vm.stateManager.putAccount(deployerAddr, new Account(0n, 10n * 10n ** 18n));

  const safe = '0x10000000000000000000000000000000000000aa';
  const guardian = '0x20000000000000000000000000000000000000bb';
  const deployData = encodeDeployData({
    abi,
    bytecode: binHex,
    args: [safe, guardian],
  });

  const block = createBlock({ header: { number: 1n, timestamp: 1000n, gasLimit: 30_000_000n, baseFeePerGas: 1n } }, { common });
  const tx = createLegacyTx({
    nonce: 0n,
    gasPrice: 1_000_000_000n,
    gasLimit: 15_000_000n,
    value: 0n,
    data: hexToBytes(deployData),
  }, { common }).sign(deployerKey);

  const res = await runTx(vm, { tx, block, skipBlockGasLimitValidation: true });
  if (res.execResult.exceptionError) {
    throw new Error('Contract deploy reverted: ' + res.execResult.exceptionError.error);
  }
  const contractAddr = res.createdAddress;

  const fpCallData = encodeFunctionData({ abi, functionName: 'fingerprint', args: [] });
  const callRes = await vm.evm.runCall({
    caller: deployerAddr,
    to: contractAddr,
    data: hexToBytes(fpCallData),
    gasLimit: 15_000_000n,
    block,
  });

  if (callRes.execResult.exceptionError) {
    throw new Error('fingerprint() call reverted: ' + callRes.execResult.exceptionError.error);
  }

  const returnHex = bytesToHex(callRes.execResult.returnValue);
  const onChainFp = decodeFunctionResult({ abi, functionName: 'fingerprint', data: returnHex });
  const onChainHex = '0x' + onChainFp.toString(16).padStart(64, '0').toLowerCase();
  const expectedHex = expectedFp.toLowerCase();

  if (onChainHex !== expectedHex) {
    throw new Error(`Fingerprint mismatch! Contract returned ${onChainHex}, expected ${expectedHex}`);
  }
  return onChainHex;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--example')) {
    showExample();
    return;
  }

  if (args.includes('--restore')) {
    if (!fs.existsSync(BACKUP_PATH)) {
      console.error('No backup found at', BACKUP_PATH);
      process.exit(1);
    }
    fs.copyFileSync(BACKUP_PATH, CONFIG_FE_PATH);
    console.log('Restored default policy config.fe from backup.');
    return;
  }

  const fileArg = args.find((a) => !a.startsWith('--'));
  if (!fileArg) {
    console.log('Usage: node scripts/build-policy.mjs <policy.json> [--build] [--output <dir>] [--keep-in-place]');
    console.log('       node scripts/build-policy.mjs --restore');
    console.log('       node scripts/build-policy.mjs --example');
    process.exit(0);
  }

  const filePath = path.resolve(process.cwd(), fileArg);
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  let policy;
  try {
    policy = JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse policy JSON:', e.message);
    process.exit(1);
  }

  console.log(`\n1. Validating policy configuration from ${fileArg}...`);
  const fingerprint = calculatePolicyFingerprint(policy);
  const feSource = generateFeSource(policy, fingerprint);
  console.log('   Structural validation passed.');
  console.log(`   Calculated Cryptographic Fingerprint: ${fingerprint}`);

  if (args.includes('--dry-run')) {
    console.log('\n--- Generated Fe Source (dry-run) ---');
    console.log(feSource);
    return;
  }

  // Keep this run's own copy of config.fe and restore exactly that, so a backup left by an earlier
  // run can never overwrite newer work. The backup file is written fresh whenever the generated
  // config stays in place, for `--restore`.
  const originalConfig = fs.readFileSync(CONFIG_FE_PATH);
  const restoreConfig = () => fs.writeFileSync(CONFIG_FE_PATH, originalConfig);
  const shouldBuild = args.includes('--build');
  if (!shouldBuild || args.includes('--keep-in-place')) {
    fs.writeFileSync(BACKUP_PATH, originalConfig);
  }

  fs.writeFileSync(CONFIG_FE_PATH, feSource, 'utf8');

  const outDirIdx = args.indexOf('--output');
  const targetOutDir = outDirIdx !== -1 && args[outDirIdx + 1]
    ? path.resolve(process.cwd(), args[outDirIdx + 1])
    : path.resolve(ROOT, 'out', 'custom_policy');

  if (shouldBuild) {
    console.log('\n2. Compiling custom policy with Fe (compile-time invariant verification)...');
    try {
      execSync('fe fmt ingots/policy/src/config.fe', { cwd: ROOT, stdio: 'inherit' });
      execSync('fe check', { cwd: ROOT, stdio: 'inherit' });
      execSync('fe build ingots/module', { cwd: ROOT, stdio: 'inherit' });

      // Build native CLI if supported on host
      let builtNative = false;
      if (process.platform !== 'win32') {
        try {
          execSync('fe build --backend native', { cwd: ROOT, stdio: 'inherit' });
          builtNative = true;
        } catch {
          console.warn('Native backend build skipped (not available or failed).');
        }
      }

      // Check runtime size
      execSync('fe build ingots/module --emit sizes', { cwd: ROOT });
      const sizesPath = path.join(ROOT, 'ingots', 'module', 'out', 'LeashModule.sizes.txt');
      const sizes = fs.existsSync(sizesPath) ? fs.readFileSync(sizesPath, 'utf8') : '';
      const match = sizes.match(/runtime:\s+(\d+)/);
      const runtimeSize = match ? parseInt(match[1]) : 0;
      console.log(`   LeashModule runtime size: ${runtimeSize} bytes (limit: 24,576 bytes)`);

      // Verify on-chain fingerprint
      console.log('\n3. Verifying on-chain contract fingerprint in EVM...');
      const binPath = path.join(ROOT, 'ingots', 'module', 'out', 'LeashModule.bin');
      const abiPath = path.join(ROOT, 'ingots', 'module', 'out', 'LeashModule.abi.json');
      const binHex = ('0x' + fs.readFileSync(binPath, 'utf8').trim());
      const abi = JSON.parse(fs.readFileSync(abiPath, 'utf8'));

      const onChainFp = await verifyOnChainFingerprint(binHex, abi, fingerprint);
      console.log(`   Contract fingerprint verified on-chain: ${onChainFp}`);

      // Export artifacts
      fs.mkdirSync(targetOutDir, { recursive: true });
      fs.copyFileSync(binPath, path.join(targetOutDir, 'LeashModule.bin'));
      fs.copyFileSync(abiPath, path.join(targetOutDir, 'LeashModule.abi.json'));
      fs.writeFileSync(path.join(targetOutDir, 'fingerprint.txt'), fingerprint + '\n', 'utf8');
      fs.writeFileSync(
        path.join(targetOutDir, 'policy_info.json'),
        JSON.stringify({ fingerprint, runtimeSize, policy }, null, 2),
        'utf8'
      );
      if (builtNative && fs.existsSync(path.join(ROOT, 'out', 'cli'))) {
        fs.copyFileSync(path.join(ROOT, 'out', 'cli'), path.join(targetOutDir, 'cli'));
        fs.chmodSync(path.join(targetOutDir, 'cli'), 0o755);
      }

      console.log('\n===============================================================');
      console.log('  CUSTOM POLICY SUCCESSFULLY COMPILED & VERIFIED');
      console.log('===============================================================');
      console.log(`Policy Fingerprint : ${fingerprint}`);
      console.log(`Runtime Bytecode   : ${runtimeSize} bytes (headroom: ${24576 - runtimeSize} bytes)`);
      console.log(`Artifacts Exported : ${path.relative(ROOT, targetOutDir)}/`);
      console.log(`  - LeashModule.bin`);
      console.log(`  - LeashModule.abi.json`);
      console.log(`  - fingerprint.txt`);
      console.log(`  - policy_info.json`);

      // Restore default config unless keep-in-place requested
      if (!args.includes('--keep-in-place')) {
        restoreConfig();
        console.log(`Cleaned up working tree: restored default config.fe`);
      }
    } catch (err) {
      console.error('\nCompilation or invariant verification failed:', err.message);
      restoreConfig();
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
