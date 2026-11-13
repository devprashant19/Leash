import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { setupLocalEnvironment } from './lib/safe';
import { runScenario } from './lib/scenario';

async function isPortOpen(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'web3_clientVersion', params: [], id: 1 })
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function startAnvil(): Promise<{ proc?: ChildProcess; port: number }> {
  const port = 8545;
  const running = await isPortOpen(port);
  if (running) {
    console.log(`[demo] Using existing Anvil instance on http://127.0.0.1:${port}`);
    return { port };
  }

  // Uses `anvil` from PATH (Foundry); set ANVIL_PATH to override.
  const anvilPath = process.env.ANVIL_PATH || 'anvil';
  console.log(`[demo] Starting ephemeral Anvil node (${anvilPath}) on port ${port}...`);

  const proc = spawn(anvilPath, ['--port', port.toString(), '--silent'], {
    stdio: 'ignore',
    detached: false
  });

  // Wait for anvil to be ready
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if (await isPortOpen(port)) {
      console.log(`[demo] Anvil node ready.`);
      return { proc, port };
    }
  }

  throw new Error('Failed to start Anvil on port ' + port);
}

async function main() {
  console.log('\n======================================================');
  console.log('       LEASH — AGENT SAFE SPENDING LIMIT DEMO         ');
  console.log('       Fe Builders Challenge 2026 Submission          ');
  console.log('======================================================\n');

  const { proc, port } = await startAnvil();
  const rpcUrl = `http://127.0.0.1:${port}`;

  try {
    console.log('[demo] 1. Deploying Safe, LeashModule, and Demo Tokens...');
    const env = await setupLocalEnvironment(rpcUrl);
    console.log(`[demo]    Safe Address:        ${env.safe}`);
    console.log(`[demo]    LeashModule Address: ${env.module}`);
    console.log(`[demo]    Token Address:       ${env.token}`);
    console.log(`[demo]    Agent Session Key:   ${env.agent}\n`);

    console.log('[demo] 2. Running 5-Transaction Cross-Verification Scenario...');
    const agentPk = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
    const result = await runScenario(rpcUrl, env.module, env.safe, agentPk);

    console.log('\n---------------------------------------------------------------------------------------------------------');
    console.log('| # | Proposed Transaction                            | CLI Predicted           | On-Chain Result   | Match |');
    console.log('---------------------------------------------------------------------------------------------------------');

    for (const step of result.steps) {
      const num = step.i.toString().padEnd(2);
      const desc = step.description.padEnd(47).slice(0, 47);
      const pred = step.predicted.padEnd(23).slice(0, 23);
      const onchain = step.onchain.padEnd(17).slice(0, 17);
      const match = step.matched ? ' ✓ PASS' : ' ✗ FAIL';
      console.log(`| ${num}| ${desc} | ${pred} | ${onchain} |${match} |`);
    }
    console.log('---------------------------------------------------------------------------------------------------------\n');

    console.log(
      `[demo] Prediction source: ${result.predictionSource}` +
        (result.predictionSource === 'fe-native'
          ? ' (real Fe-built leash binary)'
          : ' (TypeScript mirror: no native leash binary on this host; build one with `fe build --backend native` on Linux/macOS)')
    );
    console.log(`[demo] Cryptographic Policy Fingerprint:`);
    console.log(`       CLI Fingerprint:      ${result.fingerprintCli}`);
    console.log(`       On-Chain Fingerprint: ${result.fingerprintChain}`);
    console.log(`       Fingerprints Match:   ${result.fingerprintsMatch ? '✓ IDENTICAL (0 DRIFT)' : '✗ MISMATCH'}\n`);

    const outLocal = path.resolve(__dirname, 'run.local.json');
    const outCanonical = path.resolve(__dirname, 'run.json');
    fs.writeFileSync(outLocal, JSON.stringify(result, null, 2));
    fs.writeFileSync(outCanonical, JSON.stringify(result, null, 2));
    console.log(`[demo] Results written to demo/run.json and demo/run.local.json`);

    if (!result.allStepsMatched || !result.fingerprintsMatch) {
      console.error('[demo] ✗ FAILURE: Mismatch between off-chain prediction and on-chain verdict!');
      process.exit(1);
    }

    console.log('\n[demo] ✓ SUCCESS: All 5 predictions matched on-chain execution with zero drift!\n');
  } finally {
    if (proc) {
      proc.kill();
    }
  }
}

main().catch((err) => {
  console.error('[demo] Fatal error during demo execution:', err);
  process.exit(1);
});

