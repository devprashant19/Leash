# ADR-003: Default Deny Policy Execution

## Context
Security policies for autonomous AI agents must operate under a strict failure model. Autonomous agents can encounter unexpected LLM responses, prompt injections, or malicious tool calls. Any ambiguity in policy evaluation risks unauthorized capital leakage.

## Decision
We enforce a strict **Default Deny** architecture across both on-chain and off-chain policy engines:
1. Every transaction is rejected unless an explicit allowlist rule and all cap invariants are satisfied.
2. Incomplete or malformed inputs result in `Deny(MalformedCalldata)` rather than panicking or allowing execution.
3. Every match statement on target kinds, operations, or selectors must be exhaustive with no permissive wildcards.
4. If an optional rule or guard cannot verify its preconditions (e.g. invalid ABI decoding or stale oracle data), it defaults to `Deny`.

## Consequences
- **Positive**:
  - Maximizes security: unconfigured targets, functions, or assets are blocked by default.
  - Fail-safe operation: unexpected states never permit funds movement.
- **Negative**:
  - Every legitimate interaction (contracts, functions, tokens, recipients) must be explicitly configured in the policy.

## Status
Accepted.
