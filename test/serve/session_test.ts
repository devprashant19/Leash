import { spawn } from 'child_process';
import * as path from 'path';
import * as assert from 'assert';

interface JsonRpcMessage {
  id?: number | string | null;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
}

async function runSessionTest(): Promise<void> {
  console.log('--- Running Leash Agent Tool (leash serve --stdio) Session Test ---');

  const serverScript = path.resolve(__dirname, '..', '..', 'bin', 'leash-serve.ts');
  const proc = spawn('npx', ['tsx', serverScript], {
    stdio: ['pipe', 'pipe', 'inherit'],
    shell: true,
  });

  const responses: JsonRpcMessage[] = [];
  let buffer = '';

  proc.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.trim()) {
        responses.push(JSON.parse(line.trim()));
      }
    }
  });

  function send(msg: string): void {
    proc.stdin.write(msg + '\n');
  }

  function waitForResponseCount(count: number, timeoutMs = 8000): Promise<void> {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const interval = setInterval(() => {
        if (responses.length >= count) {
          clearInterval(interval);
          resolve();
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(interval);
          reject(new Error(`Timeout waiting for ${count} responses, got ${responses.length}`));
        }
      }, 50);
    });
  }

  // 1. Check fingerprint
  send(JSON.stringify({ id: 1, method: 'fingerprint' }));
  await waitForResponseCount(1);
  assert.strictEqual(responses[0].id, 1);
  assert.strictEqual(
    responses[0].result.fingerprint,
    '0x3efcfc58aec5d1e7e81b5bded7820ed3ed8a0e654cf4aff3bfb793a7494ae6ee'
  );
  console.log('✓ Step 1 PASS: Fingerprint matches golden digest');

  // 2. Check explain
  send(JSON.stringify({ id: 2, method: 'explain' }));
  await waitForResponseCount(2);
  assert.strictEqual(responses[1].id, 2);
  assert.ok(Array.isArray(responses[1].result.rules));
  assert.strictEqual(responses[1].result.rules.length, 20);
  console.log('✓ Step 2 PASS: Explain returns all 20 rules');

  // 3. Check allowed transaction (0.05 ETH to Treasury)
  send(
    JSON.stringify({
      id: 3,
      method: 'check',
      params: {
        to: '0x2000000000000000000000000000000000000002',
        value_wei: '50000000000000000',
        data: '0x',
        op: 'call',
      },
    })
  );
  await waitForResponseCount(3);
  assert.strictEqual(responses[2].id, 3);
  assert.strictEqual(responses[2].result.verdict, 'ALLOW');
  assert.strictEqual(responses[2].result.code, 0);
  console.log('✓ Step 3 PASS: Legitimate 0.05 ETH transaction allowed');

  // 4. Check over-cap transaction (0.80 ETH to Treasury -> PerTxCapExceeded)
  send(
    JSON.stringify({
      id: 4,
      method: 'check',
      params: {
        to: '0x2000000000000000000000000000000000000002',
        value_wei: '800000000000000000',
        data: '0x',
        op: 'call',
      },
    })
  );
  await waitForResponseCount(4);
  assert.strictEqual(responses[3].id, 4);
  assert.strictEqual(responses[3].result.verdict, 'DENY');
  assert.strictEqual(responses[3].result.code, 7);
  assert.strictEqual(responses[3].result.reason, 'PerTxCapExceeded');
  console.log('✓ Step 4 PASS: 0.80 ETH spend rejected with PerTxCapExceeded');

  // 5. Stateful multi-tx planning via record
  send(
    JSON.stringify({
      id: 5,
      method: 'record',
      params: { value_wei: '450000000000000000' }, // 0.45 ETH
    })
  );
  await waitForResponseCount(5);
  assert.strictEqual(responses[4].id, 5);
  assert.strictEqual(responses[4].result.spent_in_window_wei, '450000000000000000');
  console.log('✓ Step 5 PASS: Record updates simulation state to 0.45 ETH');

  // 6. Check tx that exceeds remaining window (0.08 ETH + 0.45 ETH = 0.53 ETH > 0.50 ETH cap)
  send(
    JSON.stringify({
      id: 6,
      method: 'check',
      params: {
        to: '0x2000000000000000000000000000000000000002',
        value_wei: '80000000000000000', // 0.08 ETH <= 0.10 ETH per-tx cap
        data: '0x',
      },
    })
  );
  await waitForResponseCount(6);
  assert.strictEqual(responses[5].id, 6);
  assert.strictEqual(responses[5].result.verdict, 'DENY');
  assert.strictEqual(responses[5].result.code, 8);
  assert.strictEqual(responses[5].result.reason, 'WindowCapExceeded');
  console.log('✓ Step 6 PASS: Simulated multi-tx window cap correctly denied');

  // 7. Malformed JSON resiliency test
  send('{malformed json line');
  await waitForResponseCount(7);
  assert.strictEqual(responses[6].id, null);
  assert.strictEqual(responses[6].error.code, -32700);
  console.log('✓ Step 7 PASS: Server handles malformed JSON without crashing');

  // 8. Server remains operational after error
  send(JSON.stringify({ id: 8, method: 'reset' }));
  await waitForResponseCount(8);
  assert.strictEqual(responses[7].id, 8);
  assert.strictEqual(responses[7].result.status, 'ok');
  console.log('✓ Step 8 PASS: Server operational after error and resets state');

  proc.kill();
  console.log('All 8 scripted tool session steps PASSED green!\n');
}

runSessionTest().catch((err) => {
  console.error('Session test failed:', err);
  process.exit(1);
});
