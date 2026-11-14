# leash-agent-sdk (Python)

> Python SDK for Autonomous AI Agents using Leash Safe Guardrails

## Installation
```bash
pip install leash-agent-sdk
```

## Quick Start
```python
from leash import LeashClient, TransactionProposal

client = LeashClient()

proposal = TransactionProposal(
    to="0x2000000000000000000000000000000000000002",
    value_wei=50000000000000000 # 0.05 ETH
)

eval_res = client.evaluate(proposal)
if eval_res.allowed:
    print("Proposal permitted by Leash policy!")
else:
    print(f"Blocked: {eval_res.reason} ({eval_res.message})")
```
