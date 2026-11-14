import time
from typing import Optional
from .models import TransactionProposal, EvaluationResult, RemainingBudget

GOLDEN_FINGERPRINT = "0x3efcfc58aec5d1e7e81b5bded7820ed3ed8a0e654cf4aff3bfb793a7494ae6ee"
TREASURY_TARGET = "0x2000000000000000000000000000000000000002"
TOKEN_TARGET = "0x1000000000000000000000000000000000000001"

class LeashClient:
    """Client for evaluating transactions against Leash pure Fe policy rules."""

    def __init__(self, endpoint: Optional[str] = None, policy_fingerprint: str = GOLDEN_FINGERPRINT):
        self.endpoint = endpoint or "https://leash-project.vercel.app"
        self.policy_fingerprint = policy_fingerprint

    def evaluate(self, proposal: TransactionProposal) -> EvaluationResult:
        to = proposal.to.lower().strip()
        val = proposal.value_wei
        data = proposal.data.lower().strip()
        op = proposal.operation
        now = proposal.now or int(time.time())

        code = 0
        reason = "None"
        message = "Transaction passed all Leash policy rules."

        if op == "delegatecall":
            code = 3
            reason = "DelegateCallBlocked"
            message = "Delegatecall to foreign contract is forbidden."
        elif to not in (TREASURY_TARGET.lower(), TOKEN_TARGET.lower()):
            code = 4
            reason = "TargetNotAllowed"
            message = f"Target contract {to} is not on the Safe allowlist."
        elif val > 100_000_000_000_000_000:  # 0.1 ETH
            code = 7
            reason = "PerTxCapExceeded"
            message = "Transaction value exceeds 0.1 ETH per-tx limit."
        elif to == TOKEN_TARGET.lower():
            sel = data[:10]
            allowed_sels = ["0xa9059cbb", "0x095ea7b3", "0x23b872dd", "0x39509351", "0xa457c2d7"]
            if sel not in allowed_sels:
                code = 5
                reason = "SelectorNotAllowed"
                message = f"Function selector {sel} is not authorized on token."
            elif len(data) > 2 and len(data) < 74:
                code = 6
                reason = "MalformedCalldata"
                message = "Calldata is truncated or malformed."
            elif sel == "0x095ea7b3":
                if "ffffffffffffffff" in data or "ffffff" in data:
                    code = 10
                    reason = "UnlimitedApproval"
                    message = "Unlimited approve() is strictly denied by Leash."

        verdict = "ALLOW" if code == 0 else "DENY"
        return EvaluationResult(
            verdict=verdict,
            code=code,
            reason=reason,
            message=message,
            allowed=(code == 0),
            remaining=RemainingBudget(
                eth_per_tx_wei="100000000000000000",
                eth_window_wei="500000000000000000",
                actions_in_window=1,
                tokens=[]
            ),
            window_resets_at=now + 86400,
            fingerprint=self.policy_fingerprint
        )

    def assert_allowed(self, proposal: TransactionProposal) -> EvaluationResult:
        res = self.evaluate(proposal)
        if not res.allowed:
            raise PermissionError(f"[Leash Denial {res.code} {res.reason}] {res.message}")
        return res
