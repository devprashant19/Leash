from leash import LeashClient, TransactionProposal, LeashCrewAITool

def test_client_evaluate_allowed():
    client = LeashClient()
    proposal = TransactionProposal(
        to="0x2000000000000000000000000000000000000002",
        value_wei=50000000000000000 # 0.05 ETH
    )
    res = client.evaluate(proposal)
    assert res.verdict == "ALLOW"
    assert res.code == 0
    assert res.allowed is True

def test_client_evaluate_cap_exceeded():
    client = LeashClient()
    proposal = TransactionProposal(
        to="0x2000000000000000000000000000000000000002",
        value_wei=200000000000000000 # 0.2 ETH
    )
    res = client.evaluate(proposal)
    assert res.verdict == "DENY"
    assert res.code == 7
    assert res.reason == "PerTxCapExceeded"

def test_crewai_tool():
    tool = LeashCrewAITool()
    out = tool.run(to="0x2000000000000000000000000000000000000002", value_wei=50000000000000000)
    assert "Verdict: ALLOW" in out
