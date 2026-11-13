// Response shapes of /api/health, /api/demo and /api/check (mirrors api/_lib/leash.ts).
export type Hex = `0x${string}`;
export type Verdict = 'ALLOW' | 'DENY';
export type PredictionSource = 'fe-native' | 'ts-mirror';

export interface Remaining {
  eth_per_tx_wei?: string;
  eth_window_wei?: string;
  actions_in_window?: number;
}

export interface StepResult {
  i: number;
  description: string;
  to: Hex;
  valueEth: string;
  data: Hex;
  operation: 'call' | 'delegatecall';
  predicted: { verdict: Verdict; code: number; reason: string; message: string };
  remaining?: Remaining;
  onchain: { verdict: Verdict; code: number; reason: string; txHash: Hex; gasUsed: string; eventEmitted: boolean };
  matched: boolean;
}

export interface Balances {
  safeEth: string;
  treasuryEth: string;
  safeTokens: string;
  treasuryTokens: string;
}

export interface DemoResult {
  engine: string;
  predictionSource: PredictionSource;
  cliVersion: string;
  fingerprintCli: string;
  fingerprintChain: string;
  fingerprintsMatch: boolean;
  allMatched: boolean;
  matchedCount: number;
  steps: StepResult[];
  balancesBefore: Balances;
  balancesAfter: Balances;
  addresses: { safe: Hex; module: Hex; token: string; treasury: string; agent: Hex };
  elapsedMs: number;
}

export interface CheckResult {
  engine: string;
  predictionSource: PredictionSource;
  cliVersion: string;
  step: StepResult;
  elapsedMs: number;
}

export interface Health {
  ok?: boolean;
  predictionSource: PredictionSource;
  cliVersion: string;
  fingerprint: string;
}

/** demo/run.json: the run recorded by the Anvil demo. */
export interface RecordedRun {
  network: string;
  feVersion: string;
  fingerprintCli: string;
  fingerprintChain: string;
  fingerprintsMatch: boolean;
  allStepsMatched: boolean;
  steps: Array<{
    i: number;
    description: string;
    predicted: string;
    predictedCode: number;
    onchain: string;
    onchainCode: number;
    matched: boolean;
    txHash: string;
    gasUsed: string;
  }>;
}

export interface TourTx extends StepResult {
  kind: 'tx';
  feature: string;
  why: string;
  expected: { verdict: Verdict; code: number };
  asExpected: boolean;
}
export interface TourEvent {
  kind: 'event';
  actor: 'owner' | 'guardian' | 'clock';
  title: string;
  detail: string;
  txHash?: string;
}
export interface TourChapter { title: string; intro: string; items: Array<TourTx | TourEvent> }
export interface TourResult {
  engine: string;
  predictionSource: PredictionSource;
  cliVersion: string;
  fingerprintCli: string;
  fingerprintChain: string;
  fingerprintsMatch: boolean;
  chapters: TourChapter[];
  txCount: number;
  matchedCount: number;
  expectedCount: number;
  codesCovered: number[];
  balancesBefore: Balances;
  balancesAfter: Balances;
  addresses: { safe: Hex; module: Hex; token: string; treasury: string; agent: Hex; guardian: Hex };
  elapsedMs: number;
}
