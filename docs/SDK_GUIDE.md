# Leash Agent SDK Integration Guide

This guide documents integrating autonomous AI agents with Leash guardrails across multiple language ecosystems (TypeScript and Python).

## Architecture

```
                    ┌────────────────────────┐
                    │ Autonomous AI Agent    │
                    │ (LangChain/Eliza/Crew) │
                    └───────────┬────────────┘
                                │ 1. Proposes Tx
                                ▼
                    ┌────────────────────────┐
                    │ Leash Client SDK       │
                    │ (@leash/sdk)           │
                    └───────────┬────────────┘
                                │ 2. Pre-flight Check
                                ▼
            ┌────────────────────────────────────────┐
            │ Pure Fe Policy Engine (Zero Drift)     │
            │ · Fingerprint: 0x3efcfc58...           │
            │ · Spending Caps & Allowlist Checks     │
            └───────────┬────────────────────────────┘
                        │
         ┌──────────────┴──────────────┐
         ▼                             ▼
   [ALLOW: Verdict 0]           [DENY: Codes 1-20]
         │                             │
         ▼                             ▼
 Submit to Safe via LeashModule     Agent planning loop aborts
 (Execution Guaranteed)             (Gas wasted: 0)
```

## Available SDKs
1. **TypeScript / JavaScript**: [`@leash/sdk`](../packages/leash-sdk/)
2. **Python**: [`leash-agent-sdk`](../packages/python-sdk/)
