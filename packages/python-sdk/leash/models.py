from typing import Literal, Optional, List, Dict, Any
from pydantic import BaseModel, Field

class TransactionProposal(BaseModel):
    to: str = Field(description="20-byte destination address (0x...)")
    value_wei: int = Field(default=0, description="Amount in wei")
    data: str = Field(default="0x", description="Hex calldata")
    operation: Literal["call", "delegatecall"] = Field(default="call")
    now: Optional[int] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class RemainingBudget(BaseModel):
    eth_per_tx_wei: str
    eth_window_wei: str
    actions_in_window: int
    tokens: List[Dict[str, str]] = Field(default_factory=list)

class EvaluationResult(BaseModel):
    verdict: Literal["ALLOW", "DENY"]
    code: int
    reason: str
    message: str
    remaining: RemainingBudget
    window_resets_at: int
    fingerprint: str
    allowed: bool
