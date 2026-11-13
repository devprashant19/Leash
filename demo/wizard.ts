import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createPublicClient, http, formatEther } from 'viem';
import { sepolia } from 'viem/chains';

function ask(rl: readline.Interface, query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function main() {
  console.log('\n======================================================');
  console.log('       LEASH — INTERACTIVE SETUP WIZARD               ');
  console.log('       Configure RPC & Ephemeral Testnet Keys         ');
  console.log('======================================================\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const envPath = path.resolve(__dirname, '.env');
  let currentRpc = 'https://ethereum-sepolia-rpc.publicnode.com';

  const rpcInput = await ask(rl, `Sepolia RPC URL [default: ${currentRpc}]: `);
  if (rpcInput.trim()) {
    currentRpc = rpcInput.trim();
  }

  console.log(`\nGenerating fresh testnet keypairs for Owner and Agent...`);
  const ownerPk = generatePrivateKey();
  const agentPk = generatePrivateKey();

  const ownerAccount = privateKeyToAccount(ownerPk);
  const agentAccount = privateKeyToAccount(agentPk);
  const guardianAddress = '0x2000000000000000000000000000000000000002';

  console.log(`\nGenerated Fresh Accounts:`);
  console.log(`  Owner Address:    ${ownerAccount.address}`);
  console.log(`  Agent Address:    ${agentAccount.address}`);
  console.log(`  Guardian Address: ${guardianAddress}\n`);

  console.log(`Please fund the Owner Address with testnet Sepolia ETH:`);
  console.log(`  • Google Cloud Faucet: https://cloud.google.com/application/web3/faucet/ethereum/sepolia`);
  console.log(`  • Alchemy Sepolia Faucet: https://sepoliafaucet.com/\n`);

  const envContent = [
    `# Leash Demo Configuration (.env)`,
    `SEPOLIA_RPC_URL=${currentRpc}`,
    `OWNER_PK=${ownerPk}`,
    `AGENT_PK=${agentPk}`,
    `GUARDIAN_ADDRESS=${guardianAddress}`,
    `SAFE_ADDRESS=`,
    `MODULE_ADDRESS=`,
    `TOKEN_ADDRESS=`
  ].join('\n') + '\n';

  fs.writeFileSync(envPath, envContent);
  console.log(`✓ Secrets securely saved to demo/.env (git-ignored).\n`);

  // Check balance if connected
  try {
    const publicClient = createPublicClient({ chain: sepolia, transport: http(currentRpc) });
    const bal = await publicClient.getBalance({ address: ownerAccount.address });
    console.log(`Current Owner Balance: ${formatEther(bal)} ETH`);
  } catch (e: any) {
    console.log(`Note: Could not query balance on ${currentRpc}: ${e.message}`);
  }

  rl.close();
  console.log(`\nSetup complete! Next run: npm run deploy:sepolia\n`);
}

main().catch((err) => {
  console.error('Wizard error:', err);
  process.exit(1);
});

