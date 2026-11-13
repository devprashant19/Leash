"""
Leash AI Agent Tool Adapter (Python)

Provides pre-flight Safe transaction policy checks for autonomous agents
using LangGraph, CrewAI, AutoGen, or smolagents.
"""

import json
import subprocess
import os
import sys
from typing import Dict, Any, Optional

class LeashAgentClient:
    def __init__(self):
        script_dir = os.path.dirname(os.path.abspath(__file__))
        repo_root = os.path.abspath(os.path.join(script_dir, "..", ".."))
        server_path = os.path.join(repo_root, "bin", "leash-serve.ts")

        # Spawn stdio process
        cmd = ["npx", "tsx", server_path]
        self.proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            shell=True if sys.platform == "win32" else False
        )
        self.req_id = 1

    def _call(self, method: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        req = {
            "id": self.req_id,
            "method": method,
            "params": params or {}
        }
        self.req_id += 1
        payload = json.dumps(req) + "\n"
        self.proc.stdin.write(payload)
        self.proc.stdin.flush()

        resp_line = self.proc.stdout.readline()
        if not resp_line:
            raise RuntimeError("Leash server closed unexpectedly")

        resp = json.loads(resp_line.strip())
        if "error" in resp:
            err = resp["error"]
            raise RuntimeError(f"Leash error [{err.get('code')}]: {err.get('message')}")
        return resp.get("result", {})

    def check(self, to: str, value_eth: Optional[str] = None, value_wei: Optional[str] = None, data: str = "0x", op: str = "call") -> Dict[str, Any]:
        params = {
            "to": to,
            "data": data,
            "op": op
        }
        if value_eth:
            params["value_eth"] = value_eth
        if value_wei:
            params["value_wei"] = value_wei
        return self._call("check", params)

    def record(self, value_wei: str) -> Dict[str, Any]:
        return self._call("record", {"value_wei": value_wei})

    def get_fingerprint(self) -> str:
        res = self._call("fingerprint")
        return res.get("fingerprint", "")

    def explain(self) -> Dict[str, Any]:
        return self._call("explain")

    def close(self):
        if self.proc:
            self.proc.terminate()
            self.proc.wait()

# Example standalone run
if __name__ == "__main__":
    client = LeashAgentClient()
    try:
        print("Connected to Leash daemon.")
        fp = client.get_fingerprint()
        print(f"Policy Fingerprint: {fp}")

        # Check allowed transaction
        allowed = client.check(
            to="0x2000000000000000000000000000000000000002",
            value_eth="0.05"
        )
        print(f"Verdict for 0.05 ETH transfer: {allowed['verdict']} (Code: {allowed['code']})")

        # Check denied over-cap transaction
        denied = client.check(
            to="0x2000000000000000000000000000000000000002",
            value_eth="0.80"
        )
        print(f"Verdict for 0.80 ETH transfer: {denied['verdict']} (Reason: {denied['reason']})")
    finally:
        client.close()
