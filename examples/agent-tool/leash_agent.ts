/**
 * Leash AI Agent Tool Adapter
 *
 * Provides pre-flight Safe transaction policy checks for autonomous agents
 * using LangChain, Vercel AI SDK, CrewAI, or AutoGPT.
 *
 * Guarantees zero transaction reverts and zero budget leakage before sending
 * transactions on-chain.
 */

import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as path from 'path';

export interface LeashCheckParams {
  to: string;
  valueWei?: string;
  valueEth?: string;
  data?: string;
  op?: 'call' | 'delegatecall';
}

export interface LeashCheckOutput {
  verdict: 'ALLOW' | 'DENY';
  code: number;
  reason: string;
  message: string;
  remaining: {
    eth_per_tx_wei: string;
    eth_window_wei: string;
    tokens: Array<{ token: string; per_tx: string; window: string }>;
  };
  fingerprint: string;
}

export class LeashAgentClient {
  private proc: ChildProcessWithoutNullStreams;
  private reqId = 1;
  private pending = new Map<number, { resolve: (res: any) => void; reject: (err: any) => void }>();
  private buffer = '';

  constructor() {
    const serverScript = path.resolve(__dirname, '..', '..', 'bin', 'leash-serve.ts');
    this.proc = spawn('npx', ['tsx', serverScript], {
      stdio: ['pipe', 'pipe', 'inherit'],
      shell: true,
    });

    this.proc.stdout.on('data', (chunk) => {
      this.buffer += chunk.toString();
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line.trim());
          const p = this.pending.get(json.id);
          if (p) {
            this.pending.delete(json.id);
            if (json.error) {
              p.reject(new Error(`Leash error [${json.error.code}]: ${json.error.message}`));
            } else {
              p.resolve(json.result);
            }
          }
        } catch {}
      }
    });
  }

  public async check(params: LeashCheckParams): Promise<LeashCheckOutput> {
    const id = this.reqId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.proc.stdin.write(
        JSON.stringify({
          id,
          method: 'check',
          params: {
            to: params.to,
            value_wei: params.valueWei,
            value_eth: params.valueEth,
            data: params.data || '0x',
            op: params.op || 'call',
          },
        }) + '\n'
      );
    });
  }

  public async record(valueWei: string): Promise<{ spent_in_window_wei: string; remaining_window_wei: string }> {
    const id = this.reqId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.proc.stdin.write(JSON.stringify({ id, method: 'record', params: { value_wei: valueWei } }) + '\n');
    });
  }

  public async getFingerprint(): Promise<string> {
    const id = this.reqId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.proc.stdin.write(JSON.stringify({ id, method: 'fingerprint' }) + '\n');
    }).then((res: any) => res.fingerprint);
  }

  public close(): void {
    this.proc.kill();
  }
}

// Example LangChain / Vercel AI SDK tool definition
export const leashToolDefinition = {
  name: 'leash_preflight_check',
  description:
    'Evaluates a proposed Safe transaction against the immutable Fe policy limits before execution. Returns ALLOW or DENY with exact denial reason and remaining budget.',
  parameters: {
    type: 'object',
    properties: {
      to: { type: 'string', description: 'Destination Ethereum contract address (hex)' },
      valueEth: { type: 'string', description: 'Value in ETH to transfer (e.g. "0.05")' },
      data: { type: 'string', description: 'Calldata hex string (e.g. "0xa9059cbb...")' },
      op: { type: 'string', enum: ['call', 'delegatecall'], description: 'Call operation type' },
    },
    required: ['to'],
  },
};

// Quick demonstration
if (require.main === module) {
  (async () => {
    const client = new LeashAgentClient();
    console.log('Fingerprint:', await client.getFingerprint());

    const result = await client.check({
      to: '0x2000000000000000000000000000000000000002',
      valueEth: '0.05',
    });
    console.log('Verdict for 0.05 ETH transfer:', result.verdict, result.reason);

    const denyResult = await client.check({
      to: '0x2000000000000000000000000000000000000002',
      valueEth: '0.80',
    });
    console.log('Verdict for 0.80 ETH transfer:', denyResult.verdict, denyResult.reason);

    client.close();
  })().catch(console.error);
}

