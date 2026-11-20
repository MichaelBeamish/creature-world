# 0002 — Framework-free, deterministic simulation

- **Status:** Accepted
- **Date:** 2026-11-20

## Context
Creature behavior is the heart of the product and must be testable, tunable, and later extendable with an AI "mind".

## Decision
`src/simulation/` is plain TypeScript with no DOM, Vue, or rendering imports. It advances on a fixed timestep
and uses a seeded RNG. Decision-making sits behind a `Mind` interface (MVP: rule-based state machine weighted by traits).

## Consequences
- ➕ Behavior is unit-testable and reproducible ("same seed → same outcome").
- ➕ A future LLM-driven mind plugs in without rewriting movement or rendering.
- ➖ Slightly more upfront structure (loop accumulator, interpolation, RNG plumbing).
- Alternative considered: a game engine/ECS library. Overkill for 3–5 creatures and hides the learning.
