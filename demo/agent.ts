import * as fs from 'fs';
import * as path from 'path';
import { type Hex, type Address } from 'viem';
import { sepolia } from 'viem/chains';
import { runScenario } from './lib/scenario';

function loadDeployment() {
  const depPath = path.resolve(__dirname, 'deployments', 'sepolia.json');
  if (!fs.existsSync(depPath)) {
    console.error('Error: demo/deployments/sepolia.json not found. Run "npm run deploy:sepolia" first.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(depPath, 'utf8'));
}

function loadEnv() {
  const envPath = path.resolve(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    console.error('Error: demo/.env not found.');
    process.exit(1);
  }
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  const env: Record<string, string> = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
      }
    }
  }
  return env;
}

async function main() {
  console.log('\n======================================================');
  console.log('       LEASH — SCRIPTED AGENT SEPOLIA RUNNER          ');
  console.log('======================================================\n');

  const env = loadEnv();
  const dep = loadDeployment();
  const rpcUrl = env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
  const agentPk = env.AGENT_PK as Hex;

  if (!agentPk) {
    console.error('Error: AGENT_PK must be set in demo/.env');
    process.exit(1);
  }

  console.log(`[agent] Target Network: Sepolia Testnet`);
  console.log(`[agent] Safe Address:   ${dep.safe}`);
  console.log(`[agent] Module Address: ${dep.module}`);
  console.log(`[agent] Agent Address:  ${dep.agent}\n`);

  console.log(`[agent] Executing 5-Transaction Canonical Scenario on Sepolia...`);
  const result = await runScenario(rpcUrl, dep.module as Address, dep.safe as Address, agentPk, sepolia);
  console.log(`[agent] Prediction source: ${result.predictionSource}`);

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

  console.log(`[agent] Cryptographic Policy Fingerprints:`);
  console.log(`        CLI Fingerprint:      ${result.fingerprintCli}`);
  console.log(`        On-Chain Fingerprint: ${result.fingerprintChain}`);
  console.log(`        Match:                ${result.fingerprintsMatch ? '✓ IDENTICAL (0 DRIFT)' : '✗ MISMATCH'}\n`);

  const runPath = path.resolve(__dirname, 'run.json');
  fs.writeFileSync(runPath, JSON.stringify(result, null, 2));
  console.log(`[agent] ✓ Recorded live on-chain verdicts to demo/run.json`);

  if (!result.allStepsMatched || !result.fingerprintsMatch) {
    console.error('[agent] ✗ ERROR: Prediction drift detected on Sepolia!');
    process.exit(1);
  }

  console.log(`[agent] ✓ SUCCESS: All 5 predictions matched Sepolia transactions with 0 drift!\n`);
}

main().catch((err) => {
  console.error('[agent] Error during Sepolia run:', err);
  process.exit(1);
});

