import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  encodeFunctionData,
  type Address,
  type Hex,
  type Hash
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import type { Chain } from 'viem';
import { getLeashModuleArtifact } from './artifacts';
import {
  predictVerdict,
  predictionSource,
  cliFingerprint,
  ADDR_TOKEN,
  ADDR_TREASURY,
  type PredictionSource
} from './leash-cli';

export interface StepRecord {
  i: number;
  description: string;
  predicted: string;
  predictedCode: number;
  onchain: string;
  onchainCode: number;
  matched: boolean;
  txHash: Hash;
  gasUsed: string;
  remainingEthWindowWei: string;
}

export interface ScenarioTx {
  i: number;
  description: string;
  to: Address;
  value: bigint;
  data: Hex;
  operation: number;
}

const U256_MAX = 2n ** 256n - 1n;

/** The 5 canonical scenario transactions, shared by the Anvil demo and the web demo. */
export function canonicalScenarios(): ScenarioTx[] {
  return [
    {
      i: 1,
      description: 'Agent sends 0.05 ETH to authorized treasury',
      to: ADDR_TREASURY as Address,
      value: parseEther('0.05'),
      data: '0x' as Hex,
      operation: 0
    },
    {
      i: 2,
      description: 'Agent transfers 50 tokens to authorized recipient',
      to: ADDR_TOKEN as Address,
      value: 0n,
      // ERC20 transfer(treasury, 50 * 10^18)
      data: ('0xa9059cbb' +
        ADDR_TREASURY.slice(2).padStart(64, '0') +
        (50n * 10n ** 18n).toString(16).padStart(64, '0')) as Hex,
      operation: 0
    },
    {
      i: 3,
      description: 'Agent sends 0.2 ETH (exceeds 0.1 ETH per-tx cap)',
      to: ADDR_TREASURY as Address,
      value: parseEther('0.2'),
      data: '0x' as Hex,
      operation: 0
    },
    {
      i: 4,
      description: 'Agent calls unlisted contract (malicious diversion)',
      to: '0xdead00000000000000000000000000000000beef' as Address,
      value: 0n,
      data: '0x' as Hex,
      operation: 0
    },
    {
      i: 5,
      description: 'Agent calls approve(exchange, 2^256 - 1) unlimited drain',
      to: ADDR_TOKEN as Address,
      value: 0n,
      // ERC20 approve(treasury, 2^256 - 1)
      data: ('0x095ea7b3' +
        ADDR_TREASURY.slice(2).padStart(64, '0') +
        U256_MAX.toString(16).padStart(64, '0')) as Hex,
      operation: 0
    }
  ];
}

export interface ScenarioRunResult {
  network: string;
  moduleAddress: Address;
  safeAddress: Address;
  feVersion: string;
  /** 'fe-native' = predictions came from the real Fe-built `leash` binary. */
  predictionSource: PredictionSource;
  fingerprintCli: string;
  fingerprintChain: string;
  fingerprintsMatch: boolean;
  allStepsMatched: boolean;
  steps: StepRecord[];
}

export async function runScenario(
  rpcUrl: string,
  moduleAddress: Address,
  safeAddress: Address,
  agentPk: Hex,
  chain: Chain = foundry
): Promise<ScenarioRunResult> {
  const agentAccount = privateKeyToAccount(agentPk);
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account: agentAccount, chain, transport: http(rpcUrl) });
  const source = predictionSource();
  const fingerprintCli = cliFingerprint();
  const moduleArtifact = getLeashModuleArtifact();

  // 1. Check policy fingerprints from both sides
  const chainFingerprintBigInt = (await publicClient.readContract({
    address: moduleAddress,
    abi: moduleArtifact.abi,
    functionName: 'fingerprint'
  })) as bigint;

  const hexFp = '0x' + chainFingerprintBigInt.toString(16).padStart(64, '0');
  const fingerprintsMatch = hexFp.toLowerCase() === fingerprintCli.toLowerCase();

  const steps: StepRecord[] = [];
  const scenarios = canonicalScenarios();

  let currentSpentWei = 0n;

  for (const s of scenarios) {
    // 1. Off-chain prediction via Leash CLI rule engine
    const block = await publicClient.getBlock();
    const now = Number(block.timestamp);

    const prediction = predictVerdict({
      to: s.to,
      valueWei: s.value,
      data: s.data,
      op: 'call',
      now
    });

    // 2. On-chain execution in rogue agent mode using tryExecute
    // Returns (bool success, uint8 code)
    const txHash = await walletClient.writeContract({
      address: moduleAddress,
      abi: moduleArtifact.abi,
      functionName: 'tryExecute',
      args: [s.to, s.value, s.data, s.operation]
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    // Read result directly from on-chain event logs emitted by tryExecute
    let onchainOk = false;
    let onchainCode = 0;

    const DENIED_TOPIC = '0x5a996ad3cf9f71f2a144d6fb5568ee58738616f6ce2ea3a82145dd73a8e0bd5f'.toLowerCase();
    const ALLOWED_TOPIC = '0x3f2cb0327226f9a7cb65780f2a37f378b6f04733d485c1a50958850550870603'.toLowerCase();

    for (const log of receipt.logs) {
      const topic0 = log.topics[0]?.toLowerCase();
      if (topic0 === ALLOWED_TOPIC) {
        onchainOk = true;
        onchainCode = 0;
        break;
      } else if (topic0 === DENIED_TOPIC) {
        onchainOk = false;
        onchainCode = Number(BigInt(log.data));
        break;
      }
    }

    const onchainVerdict = onchainOk ? 'ALLOW' : 'DENY';

    const matched = prediction.verdict === onchainVerdict && prediction.code === onchainCode;

    if (onchainOk) {
      currentSpentWei += s.value;
    }

    const remainingWin = 500_000_000_000_000_000n > currentSpentWei
      ? 500_000_000_000_000_000n - currentSpentWei
      : 0n;

    steps.push({
      i: s.i,
      description: s.description,
      predicted: prediction.verdict === 'ALLOW' ? 'ALLOW' : `DENY (${prediction.reason})`,
      predictedCode: prediction.code,
      onchain: onchainVerdict === 'ALLOW' ? 'ALLOW' : `DENY (code ${onchainCode})`,
      onchainCode,
      matched,
      txHash,
      gasUsed: receipt.gasUsed.toString(),
      remainingEthWindowWei: remainingWin.toString()
    });
  }

  const allStepsMatched = steps.every((st) => st.matched);

  return {
    network: chain.id === foundry.id ? 'anvil-local' : chain.name.toLowerCase(),
    moduleAddress,
    safeAddress,
    feVersion: '26.6.0',
    predictionSource: source,
    fingerprintCli,
    fingerprintChain: hexFp,
    fingerprintsMatch,
    allStepsMatched,
    steps
  };
}
