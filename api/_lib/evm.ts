/**
 * A minimal in-memory EVM (ethereumjs, Prague rules) for running the real Fe-compiled
 * contracts inside a serverless function, without an Anvil process.
 */
import { createVM, runTx, type VM } from '@ethereumjs/vm';
import { Common, Mainnet, Hardfork } from '@ethereumjs/common';
import { createLegacyTx } from '@ethereumjs/tx';
import { createBlock } from '@ethereumjs/block';
import {
  Account,
  bytesToHex,
  createAddressFromPrivateKey,
  createAddressFromString,
  hexToBytes,
  type Address as EjsAddress,
} from '@ethereumjs/util';
import type { Hex } from 'viem';

export interface TxResult {
  hash: Hex;
  success: boolean;
  gasUsed: bigint;
  createdAddress?: Hex;
  logs: Array<{ address: Hex; topics: Hex[]; data: Hex }>;
  error?: string;
  returnData: Hex;
}

export interface Signer {
  address: Hex;
  key: Uint8Array;
  nonce: bigint;
}

export class Chain {
  private constructor(
    private vm: VM,
    private common: Common,
    /** Current block timestamp, in seconds. Every transaction mines a block 12 s later. */
    public now: bigint,
    private blockNumber: bigint
  ) {}

  static async create(startTime: bigint): Promise<Chain> {
    const common = new Common({ chain: Mainnet, hardfork: Hardfork.Prague });
    const vm = await createVM({ common });
    return new Chain(vm, common, startTime, 1n);
  }

  async signer(privateKey: Hex, balanceWei: bigint): Promise<Signer> {
    const key = hexToBytes(privateKey);
    const addr = createAddressFromPrivateKey(key);
    await this.vm.stateManager.putAccount(addr, new Account(0n, balanceWei));
    return { address: addr.toString() as Hex, key, nonce: 0n };
  }

  async setBalance(address: Hex, wei: bigint): Promise<void> {
    const addr = createAddressFromString(address);
    const acc = (await this.vm.stateManager.getAccount(addr)) ?? new Account();
    acc.balance = wei;
    await this.vm.stateManager.putAccount(addr, acc);
  }

  async balanceOf(address: Hex): Promise<bigint> {
    const acc = await this.vm.stateManager.getAccount(createAddressFromString(address));
    return acc?.balance ?? 0n;
  }

  async getCode(address: Hex): Promise<Uint8Array> {
    return this.vm.stateManager.getCode(createAddressFromString(address));
  }

  async putCode(address: Hex, code: Uint8Array): Promise<void> {
    const addr = createAddressFromString(address);
    if (!(await this.vm.stateManager.getAccount(addr))) {
      await this.vm.stateManager.putAccount(addr, new Account());
    }
    await this.vm.stateManager.putCode(addr, code);
  }

  private block() {
    return createBlock(
      {
        header: {
          number: this.blockNumber,
          timestamp: this.now,
          gasLimit: 30_000_000n,
          baseFeePerGas: 1n,
        },
      },
      { common: this.common }
    );
  }

  /** Signs and executes a transaction in its own block, then advances time by 12 s. */
  async send(from: Signer, to: Hex | undefined, data: Hex, value = 0n): Promise<TxResult> {
    const tx = createLegacyTx(
      {
        nonce: from.nonce,
        gasPrice: 1_000_000_000n,
        gasLimit: 15_000_000n,
        to: to ? createAddressFromString(to) : undefined,
        value,
        data: hexToBytes(data),
      },
      { common: this.common }
    ).sign(from.key);
    from.nonce += 1n;

    const res = await runTx(this.vm, { tx, block: this.block(), skipBlockGasLimitValidation: true });
    this.blockNumber += 1n;
    this.now += 12n;

    const logs = (res.receipt.logs ?? []).map(([addr, topics, logData]) => ({
      address: bytesToHex(addr) as Hex,
      topics: topics.map((t) => bytesToHex(t) as Hex),
      data: bytesToHex(logData) as Hex,
    }));
    const err = res.execResult.exceptionError;
    return {
      hash: bytesToHex(tx.hash()) as Hex,
      success: !err,
      gasUsed: res.totalGasSpent,
      createdAddress: res.createdAddress ? (res.createdAddress.toString() as Hex) : undefined,
      logs,
      error: err ? String(err.error) : undefined,
      returnData: bytesToHex(res.execResult.returnValue) as Hex,
    };
  }

  /** Read-only call at the current block time. */
  async call(from: Hex, to: Hex, data: Hex): Promise<Hex> {
    const res = await this.vm.evm.runCall({
      caller: createAddressFromString(from) as EjsAddress,
      to: createAddressFromString(to) as EjsAddress,
      data: hexToBytes(data),
      gasLimit: 15_000_000n,
      block: this.block(),
    });
    if (res.execResult.exceptionError) {
      throw new Error(`call reverted: ${String(res.execResult.exceptionError.error)}`);
    }
    return bytesToHex(res.execResult.returnValue) as Hex;
  }
}
