# Creature World — Project Instructions

A browser world of furry, octopus-like creatures that feel alive and notice the visitor.
Portfolio + learning project. The owner is an experienced Vue developer returning after a break (since 2022):
explain modern practices and important tradeoffs as we go.

## Read first
- `docs/product/mvp.md` — what we are building now (and what we are NOT)
- `docs/architecture/overview.md` — module boundaries and data flow
- `docs/tasks/backlog.md` — the next task to work on
- `docs/decisions/` — accepted decisions (ADRs); don't contradict them silently

## Working rules
1. **Plan before code.** Every task gets a short spec (`/plan-task`) approved by the owner before implementation.
2. **One task at a time.** Small, independently testable increments. No drive-by features or refactors.
3. **Ask before major decisions.** New dependencies, architecture changes, or deviations from an ADR → discuss first, then record with `/adr`.
4. **Verify before done.** A task is complete only after `/verify-task` passes its acceptance criteria.
5. **Never commit without explicit approval.** Use `/checkpoint`, which proposes a message and waits for a "yes".
6. **Keep docs current.** Update `docs/progress.md` and the backlog when tasks complete; update architecture docs when structure changes.
7. **Prefer simple.** Fewer files, fewer abstractions, no speculative generality — except the deliberate seams named in the architecture doc.

## Stack (see ADRs)
Vite · TypeScript (strict) · Vue 3 `<script setup>` for UI shell only · Canvas 2D rendering ·
framework-free simulation in plain TS · Vitest · ESLint + Prettier · pnpm.

## Code conventions
- Simulation code (`src/simulation/`) must not import Vue, the DOM, or rendering code.
- Rendering reads simulation state; it never mutates it.
- Per-frame data never goes through Vue reactivity. Vue only sees low-frequency UI state.
- Randomness goes through a seeded RNG so behavior is reproducible in tests.
- Name things after the creature domain (`perceive`, `mood`, `traits`), not generic jargon.

## Commands
_None yet — added by backlog task #1 (scaffold)._
