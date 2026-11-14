# @leash/sdk

> Deterministic Safe Wallet Guardrails for Autonomous AI Agents

`@leash/sdk` allows autonomous AI agents (LangChain, Eliza, AutoGen, CrewAI) to pre-flight verify all proposed on-chain actions against the formal Leash policy rules before execution.

## Features
- **Zero Drift**: Exact same evaluation semantics as the Fe-compiled `LeashModule` on-chain.
- **Built-in Safe Packager**: Automatically encodes transaction proposals into Safe `tryExecute` calls.
- **Framework Adapters**: Ready-to-use tool definitions for LangChain and action handlers for Eliza.

## Installation
```bash
npm install @leash/sdk
```

## Quick Start
```typescript
import { LeashClient, SafeLeashPackager } from '@leash/sdk';

const client = new LeashClient();

// 1. Evaluate proposal
const result = await client.evaluate({
  to: '0x2000000000000000000000000000000000000002',
  valueWei: '50000000000000000', // 0.05 ETH
});

if (result.allowed) {
  // 2. Package for Safe execution
  const packed = SafeLeashPackager.formatTryExecute({
    to: '0x2000000000000000000000000000000000000002',
    valueWei: '50000000000000000',
  });
  console.log('Execute on Safe with calldata:', packed.data);
} else {
  console.error(`Blocked by Leash: [${result.code}] ${result.reason} - ${result.message}`);
}
```
