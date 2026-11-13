# Leash — Final Contest Submission (Fe Builders Challenge 2026)

**Submission Target Deadline:** November 24, 2026, 23:59 UTC (18:00 UTC target submission)  
**Contest Track:** Fe Builders Challenge 2026  
**License:** Apache-2.0  

---

## 1. Submission Form Fields (Copy-Paste Ready)

### Project Title
```text
Leash — Safe Wallet Agent Spending Guard in Pure Fe
```

### Short Pitch (30 words)
```text
Leash gives AI agents a Safe wallet with spending limits written once in Fe: the same pure policy enforces them on-chain and predicts them off-chain, so the two can never drift.
```

### Fe-Specific Highlight (30 words)
```text
Every policy rule is an effect-checked function, so a reviewer can read from signatures alone which code can move funds, and the identical source builds for both EVM and native targets.
```

### GitHub Repository URL
```text
https://github.com/devprashant19/Leash
```

### 40-Character Commit SHA
```text
# Run `git rev-parse HEAD` to get the exact 40-character commit SHA of tag v1.0.0-submission:
# Example: 317f505d39849f2bf452bcead96362157c2f531b
```

### Submission Release Tag
```text
v1.0.0-submission
```

### 2-Minute Demo Video
```text
URL: <paste the unlisted YouTube link of the recorded demo here>
Video Script & Storyboard: docs/video-script.md
```

### Verification & Reproduction Command
```bash
# Requires Fe 26.6.0, Node 20+, Foundry (Anvil/Cast)
make setup && make all && make demo
```

---

## 2. Contest Submission Checklist

- [x] **Core contribution in Fe**: `ingots/policy`, `ingots/module`, `ingots/cli`, and `ingots/testkit` are 100% pure Fe. TypeScript is restricted strictly to testnet orchestration scripts and dashboard.
- [x] **OSI licence**: Apache-2.0 ([`LICENSE`](../LICENSE)). Set the repository to Public before submitting (GitHub → Settings → General → Change visibility).
- [x] **Exact Fe compiler version**: Pinned to `fe 26.6.0 (5b3f96a)` across `Makefile`, `.github/workflows/ci.yml`, and `README.md`.
- [x] **Reproducible build instructions**: `make setup`, `make test`, `make build`, and `make demo` documented and tested.
- [x] **Appropriate automated tests**:
  - `fe test`: 159 passed on the EVM backend; `fe test --backend native`: 119 passed; the 77 shared policy tests pass on both backends (`scripts/count-tests.sh`).
  - Cross-backend parity suite: 10,000 transactions verified across EVM and Native backends with golden digest `0x3a8d3e9925f2e47c6f4becdbeee4d3bcacb81b1f36a595fa9a1f975c1c5175a8`.
  - Mutation testing: Confirmed operator mutant immediately fails 11 test assertions.
  - Adversarial exploit suite: 25 attack tests neutralizing reentrancy, delegatecall hijacks, cap evasion, unlimited approvals, and privilege escalation.
- [x] **EIP-170 Compliance**: Runtime code size is **22,029 bytes** (+2,547 bytes headroom below the 24,576-byte EVM limit).
- [x] **Demo & Local Verification**: 5-transaction canonical rogue agent scenario runs on local Anvil node in **5 seconds** with **100% agreement and 0 drift**.
- [x] **Declaration of pre-existing work & AI use**: `DECLARATION.md` and complete audit log in `docs/ai-log.md` detailing every AI-assisted change.
- [x] **All commits in contest window**: All commits created and dated between Nov 3 and Nov 24, 2026. Starter repo tagged as `starter`.
- [x] **Feature freeze**: tagged at `v0.1.0-freeze`. Roadmap Stages 9–12 (DeFi guards, override and escalation, Aave and USD caps, agent tooling) were built on `main` after that tag.

---

## 3. Key Repository Links

- **Main Documentation**: [README.md](../README.md)
- **Architecture Specification**: [docs/ARCHITECTURE.md](ARCHITECTURE.md)
- **Rule Order Specification**: [docs/RULES.md](RULES.md)
- **Security & Threat Model**: [docs/THREAT_MODEL.md](THREAT_MODEL.md)
- **Gas & Headroom Benchmarks**: [docs/GAS.md](GAS.md)
- **Fe Language Findings (E7)**: [docs/FE_FINDINGS.md](FE_FINDINGS.md)
- **AI Log & Evidence**: [docs/ai-log.md](ai-log.md)
- **Contest Attributions**: [DECLARATION.md](../DECLARATION.md)
- **Demo Video Script**: [docs/video-script.md](video-script.md)
- **Interactive Dashboard**: [demo/dashboard/index.html](../demo/dashboard/index.html)
- **Local Anvil Demo**: [demo/local.ts](../demo/local.ts)
