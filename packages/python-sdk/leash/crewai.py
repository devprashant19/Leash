from .client import LeashClient
from .models import TransactionProposal

class LeashCrewAITool:
    """CrewAI tool providing Leash Safe spending limits validation."""
    name: str = "leash_validate_transaction"
    description: str = "Checks whether a proposed Ethereum transaction obeys Safe spending caps and guardrails."

    def __init__(self, client: LeashClient = None):
        self.client = client or LeashClient()

    def run(self, to: str, value_wei: int = 0, data: str = "0x", operation: str = "call") -> str:
        proposal = TransactionProposal(to=to, value_wei=value_wei, data=data, operation=operation)
        result = self.client.evaluate(proposal)
        return f"Verdict: {result.verdict} (Code: {result.code}, Reason: {result.reason}). {result.message}"
