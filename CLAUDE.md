# Creature World — Project Instructions

A browser world of furry, octopus-like creatures that feel alive and notice the visitor.
Portfolio + learning project. The owner is an experienced Vue developer returning after a break (since 2022).

## Mentoring (owner preference)
Claude leads development, and the owner wants to grow as a developer along the way.
- When implementing something **important**, briefly explain the concepts, architectural choices, and techniques behind it.
- Focus on what helps the owner **confidently maintain the app** or **discuss it in a technical interview**:
  the *why*, the tradeoffs, the alternatives, and the name of the pattern.
- **Skip trivial code.** Keep explanations short (a few bullets), and put them at the end of a task summary rather than in the middle of the work.

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
5. **Never commit or push without explicit approval.** Use `/checkpoint`, which proposes a message and waits for a "yes",
   then asks separately whether to push to `origin` (public GitHub repo: MichaelBeamish/creature-world).
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
Requires Node >= 22.12 and pnpm (version pinned in `package.json` → `packageManager`).

| Command | Purpose |
|---|---|
| `pnpm install` | Install dependencies |
| `pnpm dev` | Dev server with hot reload (http://localhost:5173) |
| `pnpm build` | Type-check, then production build to `dist/` |
| `pnpm preview` | Serve the production build locally |
| `pnpm test` | Run unit tests once (Vitest) |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm typecheck` | Type-check app + config (`vue-tsc -b`) |
| `pnpm lint` | ESLint (incl. simulation layer-boundary rule) |
| `pnpm format` / `pnpm format:check` | Prettier write / check (Markdown excluded) |

Before marking a task done, `test`, `typecheck`, `lint`, `format:check`, and `build` must all pass.
CI (`.github/workflows/ci.yml`) runs the same five checks on Node 22 and latest LTS for every push to `main`
and every pull request; it must be green.
TypeScript is pinned to 6.x: `vue-tsc` and `typescript-eslint` don't support TypeScript 7 yet.
