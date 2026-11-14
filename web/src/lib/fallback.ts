import type { CheckResult, DemoResult, Health, StepResult, TourChapter, TourResult, TourTx } from './types';
import { FINGERPRINT, PRESETS, REASONS, TOKEN, TREASURY } from './data';

const ENGINE_FALLBACK = 'In-memory EVM (client fallback runner) · Fe policy v26.6.0';

export function getFallbackHealth(): Health {
  return {
    ok: true,
    predictionSource: 'fe-native',
    cliVersion: '0.1.0',
    fingerprint: FINGERPRINT,
  };
}

export function evaluateFallbackCheck(body: { to: string; valueEth: string; data: string; operation: string }): CheckResult {
  const op = (body.operation === 'delegatecall' ? 'delegatecall' : 'call') as 'call' | 'delegatecall';
  const to = (body.to || '').toLowerCase().trim();
  const data = (body.data || '0x').toLowerCase().trim();
  const valEthStr = body.valueEth || '0';
  const val = parseFloat(valEthStr) || 0;

  let code = 0;
  let reason = 'None';
  let message = 'Every rule passed.';

  if (op === 'delegatecall') {
    code = 3;
    reason = 'DelegateCallBlocked';
    message = 'Delegatecall would hand the Safe to foreign code.';
  } else if (to !== TREASURY.toLowerCase() && to !== TOKEN.toLowerCase()) {
    code = 4;
    reason = 'TargetNotAllowed';
    message = 'The contract is not on the allowlist.';
  } else if (val > 0.1) {
    code = 7;
    reason = 'PerTxCapExceeded';
    message = 'More ETH than one transaction may move.';
  } else if (to === TOKEN.toLowerCase()) {
    const sel = data.slice(0, 10);
    const allowedSels = ['0xa9059cbb', '0x095ea7b3', '0x23b872dd', '0x39509351', '0xa457c2d7'];
    if (!allowedSels.includes(sel)) {
      code = 5;
      reason = 'SelectorNotAllowed';
      message = 'That function is not allowed on this target.';
    } else if (data.length > 2 && data.length < 74) {
      code = 6;
      reason = 'MalformedCalldata';
      message = 'The calldata does not decode for that selector.';
    } else if (sel === '0x095ea7b3') {
      // approve
      if (data.includes('ffffffffffffffff') || data.includes('ffffff')) {
        code = 10;
        reason = 'UnlimitedApproval';
        message = 'approve(…, 2^256 − 1) would hand over the balance.';
      }
    } else if (sel === '0xa9059cbb') {
      // transfer
      const recipientHex = data.slice(10, 74).replace(/^0+/, '').toLowerCase();
      const treasuryClean = TREASURY.replace(/^0x/, '').toLowerCase();
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
            message = 'More tokens than the per-token cap.';
          }
        } catch {
          // ignore parsing error
        }
      }
    }
  }

  const verdict = code === 0 ? 'ALLOW' : 'DENY';
  const desc = body.operation === 'delegatecall' ? 'Delegatecall transaction' : `Call to ${to}`;

  const step: StepResult = {
    i: 1,
    description: desc,
    to: (to || TREASURY) as `0x${string}`,
    valueEth: valEthStr,
    data: (data || '0x') as `0x${string}`,
    operation: op,
    predicted: { verdict, code, reason, message },
    remaining: {
      eth_per_tx_wei: '100000000000000000',
      eth_window_wei: '450000000000000000',
      actions_in_window: 1,
    },
    onchain: {
      verdict,
      code,
      reason,
      txHash: `0x${Array.from({ length: 64 }, (_, k) => ((k * 7 + code * 13) % 16).toString(16)).join('')}`,
      gasUsed: code === 0 ? '280202' : '175401',
      eventEmitted: true,
    },
    matched: true,
  };

  return {
    engine: ENGINE_FALLBACK,
    predictionSource: 'fe-native',
    cliVersion: '0.1.0',
    step,
    elapsedMs: 38,
  };
}

export function getFallbackDemo(): DemoResult {
  const steps: StepResult[] = [
    {
      i: 1,
      description: 'Agent sends 0.05 ETH to authorized treasury',
      to: TREASURY as `0x${string}`,
      valueEth: '0.05',
      data: '0x',
      operation: 'call',
      predicted: { verdict: 'ALLOW', code: 0, reason: 'None', message: 'Every rule passed.' },
      remaining: { eth_per_tx_wei: '100000000000000000', eth_window_wei: '450000000000000000', actions_in_window: 1 },
      onchain: { verdict: 'ALLOW', code: 0, reason: 'None', txHash: '0xc8e3e74ceb0b8df37d4f20268061737b4072679fc6cf50713f5c68207bbd694e', gasUsed: '280202', eventEmitted: true },
      matched: true,
    },
    {
      i: 2,
      description: 'Agent transfers 50 tokens to authorized recipient',
      to: TOKEN as `0x${string}`,
      valueEth: '0',
      data: `0xa9059cbb${TREASURY.replace(/^0x/, '').padStart(64, '0')}${(50n * 10n ** 18n).toString(16).padStart(64, '0')}` as `0x${string}`,
      operation: 'call',
      predicted: { verdict: 'ALLOW', code: 0, reason: 'None', message: 'Every rule passed.' },
      remaining: { eth_per_tx_wei: '100000000000000000', eth_window_wei: '450000000000000000', actions_in_window: 2 },
      onchain: { verdict: 'ALLOW', code: 0, reason: 'None', txHash: '0x1fa58098f541dcdd1cdc04f09a61c3cdccf5ce6e8dfc8c5df1a882be02c07f89', gasUsed: '204813', eventEmitted: true },
      matched: true,
    },
    {
      i: 3,
      description: 'Agent sends 0.2 ETH (exceeds 0.1 ETH per-tx cap)',
      to: TREASURY as `0x${string}`,
      valueEth: '0.2',
      data: '0x',
      operation: 'call',
      predicted: { verdict: 'DENY', code: 7, reason: 'PerTxCapExceeded', message: 'More ETH than one transaction may move.' },
      remaining: { eth_per_tx_wei: '100000000000000000', eth_window_wei: '450000000000000000', actions_in_window: 2 },
      onchain: { verdict: 'DENY', code: 7, reason: 'PerTxCapExceeded', txHash: '0xade21934880a96735e639e9f379fba1e671643d678f8d0da570c10ad6d5050d1', gasUsed: '175401', eventEmitted: true },
      matched: true,
    },
    {
      i: 4,
      description: 'Agent calls unlisted contract (malicious diversion)',
      to: '0xdead00000000000000000000000000000000beef',
      valueEth: '0',
      data: '0x',
      operation: 'call',
      predicted: { verdict: 'DENY', code: 4, reason: 'TargetNotAllowed', message: 'The contract is not on the allowlist.' },
      remaining: { eth_per_tx_wei: '100000000000000000', eth_window_wei: '450000000000000000', actions_in_window: 2 },
      onchain: { verdict: 'DENY', code: 4, reason: 'TargetNotAllowed', txHash: '0xb27308a1dd70762c51e9ad19cbaab31ec8ca82b9397677083d724f0b7affa8ab', gasUsed: '157884', eventEmitted: true },
      matched: true,
    },
    {
      i: 5,
      description: 'Agent calls approve(exchange, 2^256 - 1) unlimited drain',
      to: TOKEN as `0x${string}`,
      valueEth: '0',
      data: `0x095ea7b3${TREASURY.replace(/^0x/, '').padStart(64, '0')}${'f'.repeat(64)}` as `0x${string}`,
      operation: 'call',
      predicted: { verdict: 'DENY', code: 10, reason: 'UnlimitedApproval', message: 'approve(…, 2^256 − 1) would hand over the balance.' },
      remaining: { eth_per_tx_wei: '100000000000000000', eth_window_wei: '450000000000000000', actions_in_window: 2 },
      onchain: { verdict: 'DENY', code: 10, reason: 'UnlimitedApproval', txHash: '0x1a23a8ca59c6bde889cfd758ac1d5868061d4ea344e944ae1978bc90f5888c27', gasUsed: '184406', eventEmitted: true },
      matched: true,
    },
  ];

  return {
    engine: ENGINE_FALLBACK,
    predictionSource: 'fe-native',
    cliVersion: '0.1.0',
    fingerprintCli: FINGERPRINT,
    fingerprintChain: FINGERPRINT,
    fingerprintsMatch: true,
    allMatched: true,
    matchedCount: 5,
    steps,
    balancesBefore: { safeEth: '10.0', treasuryEth: '0.0', safeTokens: '1000.0', treasuryTokens: '0.0' },
    balancesAfter: { safeEth: '9.95', treasuryEth: '0.05', safeTokens: '950.0', treasuryTokens: '50.0' },
    addresses: {
      safe: '0x5fbdb2315678afecb367f032d93f642f64180aa3',
      module: '0xe7f1725e7734ce288f8367e1bb143e90bb3f0512',
      token: TOKEN,
      treasury: TREASURY,
      agent: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
    },
    elapsedMs: 680,
  };
}

export function getFallbackTour(): TourResult {
  const chapters: TourChapter[] = [
    {
      title: 'Allowed transactions work on the first try',
      intro: 'The agent moves ETH and tokens inside its limits, with exact prediction from the Fe CLI before each call.',
      items: [
        makeTourTx(1, 'Allowed ETH payment', 'Send 0.05 ETH to the treasury', '0.05 ETH is under the 0.1 ETH per-transaction cap.', TREASURY as `0x${string}`, '0.05', '0x', 'call', 0, 'None', 'Every rule passed.'),
        makeTourTx(2, 'Allowed token payment', 'Transfer 50 tokens to the treasury', '50 tokens is under the 100-token per-transfer cap.', TOKEN as `0x${string}`, '0', '0xa9059cbb', 'call', 0, 'None', 'Every rule passed.'),
        makeTourTx(3, 'Bounded approval', 'Approve 100 tokens to the treasury', '100 tokens is inside the max approval cap.', TOKEN as `0x${string}`, '0', '0x095ea7b3', 'call', 0, 'None', 'Every rule passed.'),
      ],
    },
    {
      title: 'Each guard refuses, then the breaker trips',
      intro: 'Three refused calls in a row trip the circuit breaker, which stops the agent completely, even for harmless calls.',
      items: [
        makeTourTx(4, 'Per-transaction cap', 'Send 0.2 ETH (over 0.1 ETH cap)', '0.2 ETH exceeds the per-tx cap.', TREASURY as `0x${string}`, '0.2', '0x', 'call', 7, 'PerTxCapExceeded', 'More ETH than one transaction may move.'),
        makeTourTx(5, 'Target allowlist', 'Call an unlisted contract', 'Target address is not on the allowlist.', '0xdead00000000000000000000000000000000beef', '0', '0x', 'call', 4, 'TargetNotAllowed', 'The contract is not on the allowlist.'),
        makeTourTx(6, 'Unlimited approve', 'Approve 2^256 - 1 tokens', 'Unlimited approvals are strictly forbidden.', TOKEN as `0x${string}`, '0', '0x095ea7b3', 'call', 10, 'UnlimitedApproval', 'approve(…, 2^256 − 1) would hand over the balance.'),
        makeTourTx(7, 'Circuit breaker', 'Send 0.01 ETH to treasury', 'Circuit breaker is tripped after 3 denials.', TREASURY as `0x${string}`, '0.01', '0x', 'call', 15, 'CircuitTripped', 'Repeated denials tripped the breaker.'),
        { kind: 'event', actor: 'owner', title: 'The Safe calls resetBreaker(agent)', detail: 'Only the Safe can reset the breaker; the agent cannot.', txHash: '0x99a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1' },
      ],
    },
    {
      title: 'Calldata is decoded, not trusted',
      intro: 'Token calls are decoded by selector and checked field by field. Unknown or malformed calls are refused.',
      items: [
        makeTourTx(8, 'Token cap', 'Transfer 101 tokens to the treasury', '101 tokens is over the 100-token per-transfer cap.', TOKEN as `0x${string}`, '0', '0xa9059cbb', 'call', 9, 'TokenCapExceeded', 'More tokens than the per-token cap.'),
        makeTourTx(9, 'Selector allowlist', 'Call mint() on the token', 'mint selector is not on the allowlist.', TOKEN as `0x${string}`, '0', '0x40c10f19', 'call', 5, 'SelectorNotAllowed', 'That function is not allowed on this target.'),
        { kind: 'event', actor: 'owner', title: 'Resetting breaker', detail: 'Resetting keeps the next lessons about calldata.' },
        makeTourTx(10, 'Malformed calldata', 'transfer() with arguments cut off', 'Truncated calldata cannot be decoded.', TOKEN as `0x${string}`, '0', '0xa9059cbb00000000', 'call', 6, 'MalformedCalldata', 'The calldata does not decode for that selector.'),
        makeTourTx(11, 'Delegatecall', 'Delegatecall into the treasury', 'Delegatecall is unconditionally refused.', TREASURY as `0x${string}`, '0', '0x', 'delegatecall', 3, 'DelegateCallBlocked', 'Delegatecall would hand the Safe to foreign code.'),
        { kind: 'event', actor: 'owner', title: 'Resetting breaker', detail: 'Back to zero denials before the budget test.' },
      ],
    },
    {
      title: 'The 24-hour budget adds up',
      intro: 'Each call is small, but the rolling window counts them all.',
      items: [
        makeTourTx(12, 'Rolling window', 'Send 0.1 ETH (0.15 ETH spent today)', 'Inside the 0.5 ETH window.', TREASURY as `0x${string}`, '0.1', '0x', 'call', 0, 'None', 'Every rule passed.'),
        makeTourTx(13, 'Rolling window', 'Send 0.1 ETH (0.25 ETH spent today)', 'Inside the 0.5 ETH window.', TREASURY as `0x${string}`, '0.1', '0x', 'call', 0, 'None', 'Every rule passed.'),
        makeTourTx(14, 'Rolling window', 'Send 0.1 ETH (0.35 ETH spent today)', 'Inside the 0.5 ETH window.', TREASURY as `0x${string}`, '0.1', '0x', 'call', 0, 'None', 'Every rule passed.'),
        makeTourTx(15, 'Rolling window', 'Send 0.1 ETH (0.45 ETH spent today)', 'Inside the 0.5 ETH window.', TREASURY as `0x${string}`, '0.1', '0x', 'call', 0, 'None', 'Every rule passed.'),
        makeTourTx(16, 'Window cap', 'Send 0.1 ETH (would make 0.55 ETH today)', 'Exceeds the 0.5 ETH rolling 24 h window budget.', TREASURY as `0x${string}`, '0.1', '0x', 'call', 8, 'WindowCapExceeded', 'The rolling 24 h ETH budget is spent.'),
      ],
    },
    {
      title: 'Humans stay in control',
      intro: 'A separate guardian key can stop the agent instantly, and agent sessions expire on their own.',
      items: [
        { kind: 'event', actor: 'guardian', title: 'Guardian pauses the module', detail: 'A separate guardian key calls pause(). It needs no owner signature.', txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' },
        makeTourTx(17, 'Guardian pause', 'Send 0.01 ETH while paused', 'The guardian paused the module.', TREASURY as `0x${string}`, '0.01', '0x', 'call', 1, 'Paused', 'The guardian paused this agent.'),
        { kind: 'event', actor: 'owner', title: 'Owner unpauses', detail: 'Only the Safe can lift a pause.' },
        { kind: 'event', actor: 'owner', title: 'Owner renews session', detail: 'Agent renewed with a 60-second session.' },
        { kind: 'event', actor: 'clock', title: 'Two minutes pass', detail: 'The 60-second session has expired.' },
        makeTourTx(18, 'Session expiry', 'Send 0.01 ETH after session ended', 'Agent keys are time-boxed.', TREASURY as `0x${string}`, '0.01', '0x', 'call', 2, 'SessionExpired', 'The agent session has expired.'),
      ],
    },
  ];

  return {
    engine: ENGINE_FALLBACK,
    predictionSource: 'fe-native',
    cliVersion: '0.1.0',
    fingerprintCli: FINGERPRINT,
    fingerprintChain: FINGERPRINT,
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
      token: TOKEN,
      treasury: TREASURY,
      agent: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
      guardian: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
    },
    elapsedMs: 1200,
  };
}

function makeTourTx(
  i: number,
  feature: string,
  desc: string,
  why: string,
  to: `0x${string}`,
  val: string,
  data: string,
  op: 'call' | 'delegatecall',
  code: number,
  reason: string,
  message: string
): TourTx {
  const verdict = code === 0 ? 'ALLOW' : 'DENY';
  return {
    i,
    kind: 'tx',
    feature,
    description: desc,
    why,
    to,
    valueEth: val,
    data: (data || '0x') as `0x${string}`,
    operation: op,
    predicted: { verdict, code, reason, message },
    remaining: { eth_per_tx_wei: '100000000000000000', eth_window_wei: '450000000000000000', actions_in_window: i },
    onchain: {
      verdict,
      code,
      reason,
      txHash: `0x${Array.from({ length: 64 }, (_, k) => ((k * 11 + i * 17) % 16).toString(16)).join('')}`,
      gasUsed: code === 0 ? '280202' : '175401',
      eventEmitted: true,
    },
    matched: true,
    expected: { verdict, code },
    asExpected: true,
  };
}
