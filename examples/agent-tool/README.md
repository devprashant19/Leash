# Leash Agent Tooling & Integration SDK

This directory provides drop-in tool wrappers for autonomous AI agents (LangChain, AutoGPT, CrewAI, LangGraph, Vercel AI SDK) to integrate Leash policy checks directly into their LLM planning loops.

## Why Agents Need Leash Pre-Flight Checks

1. **Zero On-Chain Reverts**: LLMs often propose out-of-budget transactions, unlisted swap routes, or missing approvals. Leash evaluates the transaction off-chain with 100% mathematical parity against the on-chain Safe module before any transaction is broadcast.
2. **Multi-Step Budget Planning**: Through the `record` simulation method, agents can plan multi-step routes (e.g., swapping on Uniswap and supplying to Aave) and verify that the combined actions will not violate the 24-hour rolling window cap.
3. **Zero Drift Guarantee**: Both the native CLI and the on-chain Safe module compile the identical pure Fe policy ingot and produce the same Keccak-256 policy fingerprint (`0x3efcfc58aec5d1e7e81b5bded7820ed3ed8a0e654cf4aff3bfb793a7494ae6ee`).

## Usage

### TypeScript / JavaScript (LangChain & Vercel AI SDK)
```typescript
import { LeashAgentClient } from './leash_agent';

const client = new LeashAgentClient();

// Pre-flight check
const verdict = await client.check({
  to: '0x2000000000000000000000000000000000000002',
  valueEth: '0.05',
});

if (verdict.verdict === 'ALLOW') {
  console.log('Transaction safe to broadcast!');
} else {
  console.warn(`Denied: ${verdict.reason} (Code ${verdict.code}): ${verdict.message}`);
}
```

### Python (CrewAI, LangGraph, AutoGen)
```python
from leash_agent import LeashAgentClient

client = LeashAgentClient()

# Pre-flight check
verdict = client.check(
    to="0x2000000000000000000000000000000000000002",
    value_eth="0.05"
)
print("Verdict:", verdict["verdict"])
```

