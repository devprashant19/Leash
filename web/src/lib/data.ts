// Static content: presets, deny codes, rules. Addresses match the policy the demo deploys.
export const TREASURY = '0x2000000000000000000000000000000000000002';
export const TOKEN = '0x1000000000000000000000000000000000000001';
export const FINGERPRINT = '0x3efcfc58aec5d1e7e81b5bded7820ed3ed8a0e654cf4aff3bfb793a7494ae6ee';
export const REPO = 'https://github.com/devprashant19/Leash';

const pad = (h: string) => h.replace(/^0x/, '').padStart(64, '0');
const tokens = (n: number) => (BigInt(n) * 10n ** 18n).toString(16);
const MAX = 'f'.repeat(64);

export interface Preset { label: string; to: string; valueEth: string; data: string; operation?: 'call' | 'delegatecall' }
export const PRESETS: Preset[] = [
  { label: '0.05 ETH to treasury', to: TREASURY, valueEth: '0.05', data: '0x' },
  { label: '0.2 ETH (over cap)', to: TREASURY, valueEth: '0.2', data: '0x' },
  { label: 'Transfer 50 tokens', to: TOKEN, valueEth: '0', data: '0xa9059cbb' + pad(TREASURY) + pad(tokens(50)) },
  { label: 'Transfer 101 tokens', to: TOKEN, valueEth: '0', data: '0xa9059cbb' + pad(TREASURY) + pad(tokens(101)) },
  { label: 'Unlimited approve', to: TOKEN, valueEth: '0', data: '0x095ea7b3' + pad(TREASURY) + MAX },
  { label: 'Unlisted contract', to: '0xdead00000000000000000000000000000000beef', valueEth: '0', data: '0x' },
  { label: 'Delegatecall', to: TREASURY, valueEth: '0', data: '0x', operation: 'delegatecall' },
];

export const REASONS: Array<{ name: string; msg: string }> = [
  { name: 'None', msg: 'Every rule passed.' },
  { name: 'Paused', msg: 'The guardian paused this agent.' },
  { name: 'SessionExpired', msg: 'The agent session has expired.' },
  { name: 'DelegateCallBlocked', msg: 'Delegatecall would hand the Safe to foreign code.' },
  { name: 'TargetNotAllowed', msg: 'The contract is not on the allowlist.' },
  { name: 'SelectorNotAllowed', msg: 'That function is not allowed on this target.' },
  { name: 'MalformedCalldata', msg: 'The calldata does not decode for that selector.' },
  { name: 'PerTxCapExceeded', msg: 'More ETH than one transaction may move.' },
  { name: 'WindowCapExceeded', msg: 'The rolling 24 h ETH budget is spent.' },
  { name: 'TokenCapExceeded', msg: 'More tokens than the per-token cap.' },
  { name: 'UnlimitedApproval', msg: 'approve(…, 2^256 − 1) would hand over the balance.' },
  { name: 'RecipientNotAllowed', msg: 'Tokens may only go to listed recipients.' },
  { name: 'RateLimited', msg: 'Too many actions inside the window.' },
  { name: 'CooldownActive', msg: 'The cooldown since the last action has not passed.' },
  { name: 'OutsideTradingHours', msg: 'Outside the hours this agent may act.' },
  { name: 'CircuitTripped', msg: 'Repeated denials tripped the breaker.' },
  { name: 'SwapNotAllowed', msg: 'Swaps are disabled for this agent.' },
  { name: 'LendingNotAllowed', msg: 'Lending calls are disabled for this agent.' },
  { name: 'PriceUnavailable', msg: 'No fresh price to value the action.' },
  { name: 'UsdCapExceeded', msg: 'Above the USD-denominated cap.' },
  { name: 'EscalationRequired', msg: 'A human co-signature is required.' },
];

// Each card quotes the real Fe source (trimmed), with its location.
export interface Rule { title: string; text: string; code: string[]; at: string }
export const RULES: Rule[] = [
  { title: 'Per-transaction cap', text: 'One call can move at most 0.1 ETH. Bigger asks are refused before they reach the Safe.', at: 'policy/src/rules.fe:246', code: ['// 9. PerTxCapExceeded', 'if tx.value > policy.max_per_tx {', '    return Verdict::Deny(', '        DenyReason::PerTxCapExceeded)', '}'] },
  { title: 'Rolling 24 h window', text: 'A running budget across the last day, so many small calls cannot add up to a drain.', at: 'policy/src/rules.fe:252', code: ['let spent = spent_in_window(', '    state.eth_window, tx.now)', 'let total = checked_add_saturate(', '    spent, tx.value.as_wei())', 'if total > policy.max_per_window.as_wei() {'] },
  { title: 'Recipient allowlist', text: 'Tokens move only to addresses the owner listed, never to whoever the prompt suggests.', at: 'policy/src/rules.fe:99', code: ['fn check_transfer(_ to: Address, …) {', '    if !is_recipient_allowed(to, policy) {', '        Option::Some(', '            DenyReason::RecipientNotAllowed)'] },
  { title: 'Token selectors', text: 'transfer, approve and transferFrom are decoded and checked, never waved through as opaque bytes.', at: 'policy/src/rules.fe:125', code: ['match decode_erc20(tx.data) {', '    Erc20Call::Malformed => …,', '    Erc20Call::Unknown => …,', '    Erc20Call::Transfer(to, amt) =>', '        check_transfer(to, amt, …),'] },
  { title: 'Unlimited approvals', text: 'approve(spender, 2^256 − 1) is the classic drain. It is denied by name.', at: 'policy/src/rules.fe:130', code: ['Erc20Call::Approve(spender, amt) => {', '    if amt == U256_MAX', '        || amt > token_rule.max_approve…', '        Option::Some(', '            DenyReason::UnlimitedApproval)'] },
  { title: 'Delegatecall', text: 'Delegatecall would run foreign code with the Safe’s storage. Leash blocks it outright.', at: 'policy/src/rules.fe:217', code: ['match tx.op {', '    Operation::DelegateCall => {', '        return Verdict::Deny(', '            DenyReason::DelegateCallBlocked)', '    },'] },
  { title: 'Circuit breaker', text: 'Three denials trip the breaker. Every later call returns code 15 until the owner resets it.', at: 'module/src/lib.fe:156', code: ['cfg.denials += 1', 'if cfg.denials >= 3 {', '    cfg.tripped = true', '    log.emit(CircuitTrippedEvent { agent })', '}'] },
  { title: 'Guardian pause', text: 'A separate guardian key can pause the agent instantly, without touching the owner keys.', at: 'module/src/lib.fe:219', code: ['Pause uses (ctx, safe, guardian,', '           mut paused, mut log) {', '    if caller != safe && caller != guardian {', '        revert_error(NotGuardian {})', '    }'] },
];
