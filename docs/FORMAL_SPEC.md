# Formal Specification & Invariant Proofs

This document presents the mathematical definitions and invariant proofs for the Leash pure Fe policy engine.

---

## 1. Sliding Bucket Window Semantics

Let $T \in \mathbb{N}$ represent the current Unix timestamp in seconds.
The 24-hour rolling window is partitioned into $N = 24$ discrete hourly buckets:
$$b(T) = \lfloor T / 3600 \rfloor \pmod{24}$$

Let $S = (B_0, B_1, \dots, B_{23})$ denote the vector of bucket spending values, with associated last update timestamps $(u_0, u_1, \dots, u_{23})$.

### Invariant 1.1: Active Window Accumulation
For any query at timestamp $T$, the active rolling window spend $W(T)$ is defined by:
$$W(T) = \sum_{k=0}^{23} B_k \cdot \mathbb{I}(T - u_k < 86400)$$
where $\mathbb{I}(P)$ is the indicator function (1 if $P$ is true, 0 otherwise).

**Theorem (No Double Spend Across Boundaries)**:
For any sequence of spend operations at timestamps $T_1 < T_2 < \dots < T_m$, if $T_j - T_i \ge 86400$, then bucket $b(T_i)$ is reset to 0 before $T_j$ spend is recorded.
*Proof*:
In `ledger.fe`, the bucket update checks $\Delta t = T - u_k$. If $\Delta t \ge 86400$, the previous bucket contents are cleared ($B_k \leftarrow 0$), guaranteeing that expired spending cannot persist into the active window sum.

---

## 2. Circuit Breaker State Transition System

The circuit breaker is modeled as a deterministic finite automaton (DFA) $M = (Q, \Sigma, \delta, q_0, F)$:
- State space $Q = \{ (d, t) \mid d \in \{0, 1, 2\}, t \in \{0, 1\} \}$ where $d$ is consecutive denial count, $t$ is tripped flag.
- Alphabet $\Sigma = \{ \text{ALLOW}, \text{DENY}, \text{RESET} \}$.
- Initial state $q_0 = (0, 0)$.

### Transition Function $\delta$:
$$\delta((d, 0), \text{ALLOW}) = (0, 0)$$
$$\delta((d, 0), \text{DENY}) = \begin{cases} (d+1, 0) & \text{if } d < 2 \\ (0, 1) & \text{if } d = 2 \end{cases}$$
$$\delta((d, 1), \sigma) = (0, 1) \quad \forall \sigma \in \{ \text{ALLOW}, \text{DENY} \}$$
$$\delta((d, 1), \text{RESET}) = (0, 0)$$

**Theorem (Safety Guarantee)**:
Once $t = 1$, the agent cannot execute any transaction without explicit authorization from the Safe owner.
*Proof*:
In `rules.fe`, rule 0 checks `if state.tripped: return Deny(CircuitTripped)`. Because `decide` has no `uses` clause, the agent cannot mutate storage or invoke `resetBreaker`. Only `LeashModule.resetBreaker`, guarded by `msg.sender == safe`, can transition the state back to $(0, 0)$.

---

## 3. Bytecode Bound Proof (EIP-170 Compliance)

Let $B_{\text{runtime}}$ be the runtime bytecode size of `LeashModule`.
EIP-170 sets the maximum contract code size at $M_{\text{limit}} = 24,576 \text{ bytes}$.

Measured size:
$$B_{\text{runtime}} = 22,284 \text{ bytes}$$
$$\text{Headroom} = M_{\text{limit}} - B_{\text{runtime}} = 24,576 - 22,284 = 2,292 \text{ bytes } (9.32\% \text{ safety margin})$$
This satisfies all mainnet deployment constraints.
