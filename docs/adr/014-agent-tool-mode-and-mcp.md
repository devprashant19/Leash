# ADR-014: Autonomous Agent Tool Mode (`leash serve --stdio`) & Model Context Protocol (MCP) Integration

## Status
Accepted

## Context
When autonomous AI agents (operating on frameworks like LangChain, AutoGPT, CrewAI, or Claude Desktop) propose transactions for execution from a Safe wallet, invoking external command-line processes (`leash check ...`) for every sub-step introduces process spawn latency, potential shell parsing bugs, and lacks stateful multi-step budget simulation.
To enable seamless LLM reasoning and planning:
1. Agents need a persistent, high-throughput line-delimited JSON-RPC daemon over `stdin`/`stdout`.
2. Agents need stateful in-memory simulation (`record` and `reset`) to test multi-transaction routes (e.g. swapping on Uniswap followed by supplying collateral on Aave) against the 24-hour rolling window cap before sending anything on-chain.
3. Industry-standard AI environments increasingly rely on Anthropic's Model Context Protocol (MCP) for tool discovery and execution.

## Decision
We implement a dedicated Agent Tooling Architecture:

1. **Persistent Line-Delimited JSON-RPC Daemon (`bin/leash-serve.ts` & `leash serve --stdio`)**:
   - Protocol: Line-delimited JSON-RPC 2.0. Each request is a single newline-terminated JSON object; each response is a single newline-terminated JSON object with matching `id`.
   - Methods:
     - `check`: Predicts allow/deny verdict, deny reason code, and remaining allowance for any proposed transaction.
     - `record`: Stateful planning mode! Updates in-memory rolling window spend and returns the remaining allowance across a multi-step execution plan.
     - `reset`: Clears simulated session spend back to initial state.
     - `fingerprint`: Returns the immutable Keccak-256 policy fingerprint (`0x3efcfc58aec5d1e7e81b5bded7820ed3ed8a0e654cf4aff3bfb793a7494ae6ee`).
     - `explain`: Returns structured JSON breakdown of all 20 policy rules and active caps.
   - Fault Tolerance: Malformed JSON or invalid methods return standard JSON-RPC error objects (`-32700`, `-32601`) and the daemon stays alive indefinitely.

2. **Model Context Protocol (MCP) Server (`examples/mcp-server/index.ts`)**:
   - Exposes tools to MCP clients:
     - `leash_check_transaction`: Evaluates transaction validity before execution.
     - `leash_get_budget`: Inspects active ETH and token allowances.
     - `leash_get_policy_fingerprint`: Verifies policy alignment.

3. **Multi-Language Agent SDK (`examples/agent-tool/`)**:
   - TypeScript client (`leash_agent.ts`) with tool schemas for LangChain and Vercel AI SDK.
   - Python client (`leash_agent.py`) for CrewAI, LangGraph, and AutoGen.

4. **Multi-Chain Deployment Pipeline (`demo/lib/chains.ts`)**:
   - Unified configuration supporting Ethereum Sepolia, Base Sepolia, Arbitrum Sepolia, and Optimism Sepolia with identical policy fingerprints.

## Consequences
- AI agents can evaluate hundreds of proposed transactions per second with zero process spawn overhead.
- Multi-tx planning allows agents to self-correct and re-route before incurring gas fees or Safe reverts.
- MCP compatibility enables native tool use in modern AI coding and assistant workflows.

