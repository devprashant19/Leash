from .client import LeashClient
from .models import TransactionProposal

class LeashAutoGenHook:
    """Pre-execution guard hook for Microsoft AutoGen agents."""

    def __init__(self, client: LeashClient = None):
        self.client = client or LeashClient()

    def pre_send_hook(self, agent, recipient, messages):
        # Inspect messages for proposed transactions
        return messages
