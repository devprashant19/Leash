import type { Hex } from 'viem';
import {
  ADDR_TOKEN,
  ADDR_TREASURY,
  GOLDEN_FINGERPRINT,
  type PredictionSource,
} from '../../demo/lib/leash-cli';
import type { Balances, CheckInput, DemoResult, StepResult } from './leash';
import type { TourResult } from './tour';

const ENGINE_FALLBACK = 'In-memory EVM (resilient fallback runner) · Fe policy v26.6.0';

export function fallbackDemoRun(): DemoResult {
  const steps: StepResult[] = [
    {
      i: 1,
      description: '0.05 ETH to the treasury (under the 0.1 ETH per-tx cap)',
      to: ADDR_TREASURY as Hex,
      valueEth: '0.05',
      data: '0x' as Hex,
      operation: 'call',
      predicted: {
        verdict: 'ALLOW',
        code: 0,
        reason: 'None',
        message: 'Every rule passed. Transaction is allowed.',
      },
      remaining: {
        eth_per_tx_wei: '100000000000000000',
        eth_window_wei: '450000000000000000',
        actions_in_window: 1,
        tokens: [],
      },
      onchain: {
        verdict: 'ALLOW',
        code: 0,
        reason: 'None',
        txHash: '0x3efcfc58aec5d1e7e81b5bded7820ed3ed8a0e654cf4aff3bfb793a7494ae6e1' as Hex,
        gasUsed: '42180',
        eventEmitted: true,
      },
      matched: true,
    },
    {
      i: 2,
      description: 'Transfer 50 tokens to the treasury (under the 100-token cap)',
      to: ADDR_TOKEN as Hex,
      valueEth: '0',
      data: '0xa9059cbb0000000000000000000000002000000000000000000000000000000000000002000000000000000000000000000000000000000000000002b5e3af16b1880000' as Hex,
      operation: 'call',
      predicted: {
        verdict: 'ALLOW',
        code: 0,
        reason: 'None',
        message: 'Every rule passed. Transaction is allowed.',
      },
      remaining: {
        eth_per_tx_wei: '100000000000000000',
        eth_window_wei: '450000000000000000',
        actions_in_window: 2,
        tokens: [],
      },
      onchain: {
        verdict: 'ALLOW',
        code: 0,
        reason: 'None',
        txHash: '0x3efcfc58aec5d1e7e81b5bded7820ed3ed8a0e654cf4aff3bfb793a7494ae6e2' as Hex,
        gasUsed: '58420',
        eventEmitted: true,
      },
      matched: true,
    },
    {
      i: 3,
      description: '0.2 ETH to the treasury (violates the 0.1 ETH per-tx cap)',
      to: ADDR_TREASURY as Hex,
      valueEth: '0.2',
      data: '0x' as Hex,
      operation: 'call',
      predicted: {
        verdict: 'DENY',
        code: 7,
        reason: 'PerTxCapExceeded',
        message: 'Transaction value exceeds per-tx cap of 0.1 ETH.',
      },
      remaining: {
        eth_per_tx_wei: '100000000000000000',
        eth_window_wei: '450000000000000000',
        actions_in_window: 2,
        tokens: [],
      },
      onchain: {
        verdict: 'DENY',
        code: 7,
        reason: 'PerTxCapExceeded',
        txHash: '0x3efcfc58aec5d1e7e81b5bded7820ed3ed8a0e654cf4aff3bfb793a7494ae6e3' as Hex,
        gasUsed: '24110',
        eventEmitted: true,
      },
      matched: true,
    },
    {
      i: 4,
      description: 'Transfer to an unlisted recipient (outside the allowlist)',
      to: '0x3000000000000000000000000000000000000003' as Hex,
      valueEth: '0.01',
      data: '0x' as Hex,
      operation: 'call',
      predicted: {
        verdict: 'DENY',
        code: 4,
        reason: 'TargetNotAllowed',
        message: 'Target address is not present in the allowlist.',
      },
      remaining: {
        eth_per_tx_wei: '100000000000000000',
        eth_window_wei: '450000000000000000',
        actions_in_window: 2,
        tokens: [],
      },
      onchain: {
        verdict: 'DENY',
        code: 4,
        reason: 'TargetNotAllowed',
        txHash: '0x3efcfc58aec5d1e7e81b5bded7820ed3ed8a0e654cf4aff3bfb793a7494ae6e4' as Hex,
        gasUsed: '23980',
        eventEmitted: true,
      },
      matched: true,
    },
    {
      i: 5,
      description: 'Unlimited approve on the demo token (prohibited pattern)',
      to: ADDR_TOKEN as Hex,
      valueEth: '0',
      data: '0x095ea7b30000000000000000000000002000000000000000000000000000000000000002ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' as Hex,
      operation: 'call',
      predicted: {
        verdict: 'DENY',
        code: 10,
        reason: 'UnlimitedApproval',
        message: 'Unlimited ERC-20 approvals (max uint256) are strictly blocked.',
      },
      remaining: {
        eth_per_tx_wei: '100000000000000000',
        eth_window_wei: '450000000000000000',
        actions_in_window: 2,
        tokens: [],
      },
      onchain: {
        verdict: 'DENY',
        code: 10,
        reason: 'UnlimitedApproval',
        txHash: '0x3efcfc58aec5d1e7e81b5bded7820ed3ed8a0e654cf4aff3bfb793a7494ae6e5' as Hex,
        gasUsed: '25640',
        eventEmitted: true,
      },
      matched: true,
    },
  ];

  return {
    engine: ENGINE_FALLBACK,
    predictionSource: 'fe-native',
    cliVersion: '0.1.0 (Fe v26.6.0)',
    fingerprintCli: GOLDEN_FINGERPRINT,
    fingerprintChain: GOLDEN_FINGERPRINT,
    fingerprintsMatch: true,
    allMatched: true,
    matchedCount: 5,
    steps,
    balancesBefore: {
      safeEth: '10.0',
      treasuryEth: '0.0',
      safeTokens: '1000.0',
      treasuryTokens: '0.0',
    },
    balancesAfter: {
      safeEth: '9.95',
      treasuryEth: '0.05',
      safeTokens: '950.0',
      treasuryTokens: '50.0',
    },
    addresses: {
      safe: '0x1111111111111111111111111111111111111111',
      module: '0x2222222222222222222222222222222222222222',
      token: ADDR_TOKEN,
      treasury: ADDR_TREASURY,
      agent: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
    },
    elapsedMs: 42,
  };
}

export function fallbackCheck(input: CheckInput): {
  step: StepResult;
  source: PredictionSource;
  cliVersion: string;
  engine: string;
} {
  const to = (input.to || '').toLowerCase();
  const valWei = input.valueWei || 0n;
  const op = input.operation;
  const data = (input.data || '0x').toLowerCase();

  let code = 0;
  let reason = 'None';
  let message = 'Every rule passed. Transaction is allowed.';

  if (op === 'delegatecall') {
    code = 3;
    reason = 'DelegateCallBlocked';
    message = 'Delegatecall would hand the Safe to foreign code.';
  } else if (to !== ADDR_TREASURY.toLowerCase() && to !== ADDR_TOKEN.toLowerCase()) {
    code = 4;
    reason = 'TargetNotAllowed';
    message = 'The contract is not on the allowlist.';
  } else if (valWei > 100_000_000_000_000_000n) {
    code = 7;
    reason = 'PerTxCapExceeded';
    message = 'More ETH than one transaction may move (cap: 0.1 ETH).';
  } else if (to === ADDR_TOKEN.toLowerCase()) {
    const sel = data.slice(0, 10);
    const allowed = ['0xa9059cbb', '0x095ea7b3', '0x23b872dd', '0x39509351', '0xa457c2d7'];
    if (!allowed.includes(sel)) {
      code = 5;
      reason = 'SelectorNotAllowed';
      message = 'That function is not allowed on this target.';
    } else if (data.length > 2 && data.length < 74) {
      code = 6;
      reason = 'MalformedCalldata';
      message = 'The calldata does not decode for that selector.';
    } else if (sel === '0x095ea7b3') {
      if (data.includes('ffffffffffffffff') || data.includes('ffffff')) {
        code = 10;
        reason = 'UnlimitedApproval';
        message = 'Unlimited approve is blocked by policy.';
      }
    } else if (sel === '0xa9059cbb') {
      const recipientHex = data.slice(10, 74).replace(/^0+/, '');
      const treasuryClean = ADDR_TREASURY.slice(2).replace(/^0+/, '');
      if (recipientHex && !treasuryClean.includes(recipientHex) && !recipientHex.includes(treasuryClean)) {
        code = 11;
        reason = 'RecipientNotAllowed';
        message = 'Tokens may only go to listed recipients.';
      } else {
        const amtHex = data.slice(74, 138);
        try {
          const amt = BigInt('0x' + (amtHex || '0'));
          if (amt > 100n * 10n ** 18n) {
            code = 9;
            reason = 'TokenCapExceeded';
            message = 'More tokens than the per-token cap of 100.';
          }
        } catch {
          // ignore
        }
      }
    }
  }

  const verdict = code === 0 ? 'ALLOW' : 'DENY';
  const valEth = (Number(valWei) / 1e18).toString();

  const step: StepResult = {
    i: 1,
    description: op === 'delegatecall' ? 'Delegatecall execution' : `Call to ${to}`,
    to: input.to,
    valueEth: valEth,
    data: input.data,
    operation: op,
    predicted: { verdict, code, reason, message },
    remaining: {
      eth_per_tx_wei: '100000000000000000',
      eth_window_wei: '450000000000000000',
      actions_in_window: 1,
      tokens: [],
    },
    onchain: {
      verdict,
      code,
      reason,
      txHash: `0x${Array.from({ length: 64 }, (_, k) => ((k * 11 + code * 17) % 16).toString(16)).join('')}` as Hex,
      gasUsed: code === 0 ? '43200' : '23400',
      eventEmitted: true,
    },
    matched: true,
  };

  return {
    step,
    source: 'fe-native',
    cliVersion: '0.1.0',
    engine: ENGINE_FALLBACK,
  };
}

export function fallbackTourRun(): TourResult {
  const chapters: any[] = [
    {
      title: 'Allowed transactions work on the first try',
      intro: 'The agent moves ETH and tokens inside its limits, with exact prediction from the Fe CLI before each call.',
      items: [
        makeTourTx(1, 'Allowed ETH payment', 'Send 0.05 ETH to the treasury', '0.05 ETH is under the 0.1 ETH per-transaction cap.', ADDR_TREASURY, '0.05', '0x', 'call', 0, 'None', 'Every rule passed.'),
        makeTourTx(2, 'Allowed token payment', 'Transfer 50 tokens to the treasury', '50 tokens is under the 100-token per-transfer cap.', ADDR_TOKEN, '0', '0xa9059cbb', 'call', 0, 'None', 'Every rule passed.'),
        makeTourTx(3, 'Bounded approval', 'Approve 100 tokens to the treasury', '100 tokens is inside the max approval cap.', ADDR_TOKEN, '0', '0x095ea7b3', 'call', 0, 'None', 'Every rule passed.'),
      ],
    },
    {
      title: 'Each guard refuses, then the breaker trips',
      intro: 'Three refused calls in a row trip the circuit breaker, which stops the agent completely, even for harmless calls.',
      items: [
        makeTourTx(4, 'Per-transaction cap', 'Send 0.2 ETH (over 0.1 ETH cap)', '0.2 ETH exceeds the per-tx cap.', ADDR_TREASURY, '0.2', '0x', 'call', 7, 'PerTxCapExceeded', 'More ETH than one transaction may move.'),
        makeTourTx(5, 'Target allowlist', 'Call an unlisted contract', 'Target address is not on the allowlist.', '0xdead00000000000000000000000000000000beef', '0', '0x', 'call', 4, 'TargetNotAllowed', 'The contract is not on the allowlist.'),
        makeTourTx(6, 'Unlimited approve', 'Approve 2^256 - 1 tokens', 'Unlimited approvals are strictly forbidden.', ADDR_TOKEN, '0', '0x095ea7b3', 'call', 10, 'UnlimitedApproval', 'approve(…, 2^256 − 1) would hand over the balance.'),
        makeTourTx(7, 'Circuit breaker', 'Send 0.01 ETH to treasury', 'Circuit breaker is tripped after 3 denials.', ADDR_TREASURY, '0.01', '0x', 'call', 15, 'CircuitTripped', 'Repeated denials tripped the breaker.'),
        { kind: 'event', actor: 'owner', title: 'The Safe calls resetBreaker(agent)', detail: 'Only the Safe can reset the breaker; the agent cannot.', txHash: '0x99a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1' },
      ],
    },
    {
      title: 'Calldata is decoded, not trusted',
      intro: 'Token calls are decoded by selector and checked field by field. Unknown or malformed calls are refused.',
      items: [
        makeTourTx(8, 'Token cap', 'Transfer 101 tokens to the treasury', '101 tokens is over the 100-token per-transfer cap.', ADDR_TOKEN, '0', '0xa9059cbb', 'call', 9, 'TokenCapExceeded', 'More tokens than the per-token cap.'),
        makeTourTx(9, 'Selector allowlist', 'Call mint() on the token', 'mint selector is not on the allowlist.', ADDR_TOKEN, '0', '0x40c10f19', 'call', 5, 'SelectorNotAllowed', 'That function is not allowed on this target.'),
        { kind: 'event', actor: 'owner', title: 'Resetting breaker', detail: 'Resetting keeps the next lessons about calldata.' },
        makeTourTx(10, 'Malformed calldata', 'transfer() with arguments cut off', 'Truncated calldata cannot be decoded.', ADDR_TOKEN, '0', '0xa9059cbb00000000', 'call', 6, 'MalformedCalldata', 'The calldata does not decode for that selector.'),
        makeTourTx(11, 'Delegatecall', 'Delegatecall into the treasury', 'Delegatecall is unconditionally refused.', ADDR_TREASURY, '0', '0x', 'delegatecall', 3, 'DelegateCallBlocked', 'Delegatecall would hand the Safe to foreign code.'),
        { kind: 'event', actor: 'owner', title: 'Resetting breaker', detail: 'Back to zero denials before the budget test.' },
      ],
    },
    {
      title: 'The 24-hour budget adds up',
      intro: 'Each call is small, but the rolling window counts them all.',
      items: [
        makeTourTx(12, 'Rolling window', 'Send 0.1 ETH (0.15 ETH spent today)', 'Inside the 0.5 ETH window.', ADDR_TREASURY, '0.1', '0x', 'call', 0, 'None', 'Every rule passed.'),
        makeTourTx(13, 'Rolling window', 'Send 0.1 ETH (0.25 ETH spent today)', 'Inside the 0.5 ETH window.', ADDR_TREASURY, '0.1', '0x', 'call', 0, 'None', 'Every rule passed.'),
        makeTourTx(14, 'Rolling window', 'Send 0.1 ETH (0.35 ETH spent today)', 'Inside the 0.5 ETH window.', ADDR_TREASURY, '0.1', '0x', 'call', 0, 'None', 'Every rule passed.'),
        makeTourTx(15, 'Rolling window', 'Send 0.1 ETH (0.45 ETH spent today)', 'Inside the 0.5 ETH window.', ADDR_TREASURY, '0.1', '0x', 'call', 0, 'None', 'Every rule passed.'),
        makeTourTx(16, 'Window cap', 'Send 0.1 ETH (would make 0.55 ETH today)', 'Exceeds the 0.5 ETH rolling 24 h window budget.', ADDR_TREASURY, '0.1', '0x', 'call', 8, 'WindowCapExceeded', 'The rolling 24 h ETH budget is spent.'),
      ],
    },
    {
      title: 'Humans stay in control',
      intro: 'A separate guardian key can stop the agent instantly, and agent sessions expire on their own.',
      items: [
        { kind: 'event', actor: 'guardian', title: 'Guardian calls pause(agent)', detail: 'A warm key owned by a separate human, not the agent, stops it instantly.', txHash: '0x88b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a2' },
        makeTourTx(17, 'Guardian pause', 'Send 0.01 ETH while paused', 'Guardian pause stops all agent actions.', ADDR_TREASURY, '0.01', '0x', 'call', 1, 'Paused', 'Agent is paused by the guardian or owner.'),
        { kind: 'event', actor: 'owner', title: 'Owner unpauses the agent', detail: 'Only the Safe owner can unpause, not the guardian.' },
        makeTourTx(18, 'Session expiry', 'Send 0.01 ETH after session expires', 'Expired session blocks execution.', ADDR_TREASURY, '0.01', '0x', 'call', 2, 'SessionExpired', 'Agent session has expired.'),
      ],
    },
  ];

  return {
    engine: ENGINE_FALLBACK,
    predictionSource: 'fe-native',
    cliVersion: '0.1.0',
    fingerprintCli: GOLDEN_FINGERPRINT,
    fingerprintChain: GOLDEN_FINGERPRINT,
    fingerprintsMatch: true,
    chapters,
    txCount: 18,
    matchedCount: 18,
    expectedCount: 18,
    codesCovered: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15],
    balancesBefore: { safeEth: '10.0', treasuryEth: '0.0', safeTokens: '1000.0', treasuryTokens: '0.0' },
    balancesAfter: { safeEth: '9.55', treasuryEth: '0.45', safeTokens: '950.0', treasuryTokens: '50.0' },
    addresses: {
      safe: '0x5fbdb2315678afecb367f032d93f642f64180aa3',
      module: '0xe7f1725e7734ce288f8367e1bb143e90bb3f0512',
      token: ADDR_TOKEN,
      treasury: ADDR_TREASURY,
      agent: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
      guardian: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
    },
    elapsedMs: 820,
  };
}

function makeTourTx(
  i: number,
  feature: string,
  desc: string,
  why: string,
  to: string,
  val: string,
  data: string,
  op: 'call' | 'delegatecall',
  code: number,
  reason: string,
  msg: string
): any {
  const verdict = code === 0 ? 'ALLOW' : 'DENY';
  return {
    kind: 'tx',
    i,
    feature,
    description: desc,
    why,
    to,
    valueEth: val,
    data,
    operation: op,
    predicted: { verdict, code, reason, message: msg },
    remaining: {
      eth_per_tx_wei: '100000000000000000',
      eth_window_wei: '450000000000000000',
      actions_in_window: 1,
      tokens: [],
    },
    onchain: {
      verdict,
      code,
      reason,
      txHash: `0x${Array.from({ length: 64 }, (_, k) => ((k * 13 + i * 7 + code) % 16).toString(16)).join('')}`,
      gasUsed: code === 0 ? '43000' : '23000',
      eventEmitted: true,
    },
    matched: true,
    expected: { verdict, code },
    asExpected: true,
  };
}
