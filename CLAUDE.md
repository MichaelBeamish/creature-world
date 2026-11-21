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
- `docs/architecture/overview.md` — module boundaries and data flow (the *why*)
- `docs/architecture/code-map.md` — every file, what it exports, and "to change X, edit Y" (the *where*)
- `docs/tasks/backlog.md` — the next task to work on
- `docs/decisions/` — accepted decisions (ADRs); don't contradict them silently

## Working rules
1. **Plan before code.** Every task gets a short spec (`/plan-task`) approved by the owner before implementation.
2. **One task at a time.** Small, independently testable increments. No drive-by features or refactors.
3. **Ask before major decisions.** New dependencies, architecture changes, or deviations from an ADR → discuss first, then record with `/adr`.
4. **Verify before done.** A task is complete only after `/verify-task` passes its acceptance criteria.
5. **Nothing reaches GitHub without explicit approval; only the owner decides to merge.** See *Git workflow* below.
6. **Keep docs current.** Update `docs/progress.md` and the backlog when tasks complete; update architecture docs when structure changes.
   **Check `README.md` on every task** (it is the public front page): update features, controls/URL options, commands,
   the architecture summary, and status/roadmap whenever the task changes them; say "README checked — no change" otherwise.
7. **Verify before you reference.** Before naming a file, function, type or constant (in a spec, code, or docs), look it
   up in `docs/architecture/code-map.md` **and** confirm it in the code (search/read it). Never rely on memory. New things
   are marked *new*. When files or tuning constants are added/renamed/removed, update the code map in the same change —
   `src/codeMap.test.ts` fails CI otherwise.
8. **Prefer simple.** Fewer files, fewer abstractions, no speculative generality — except the deliberate seams named in the architecture doc.

## Git workflow (one branch + pull request per task)
Public repo: MichaelBeamish/creature-world. `main` is protected by a ruleset: changes land only through a PR
with both CI checks green; no direct pushes, force-pushes, or deletion (applies to admins too). Squash merges only.

1. `/plan-task n` → owner approves the spec.
2. `/implement-task n` → creates `task/<n>-<short-slug>` from an up-to-date `main`, then implements.
3. `/verify-task n` → local checks + acceptance criteria; on owner agreement, mark done + progress entry.
4. `/checkpoint` → **one owner approval** covers: commit(s) on the branch, push the branch, open a PR
   (body follows `.github/pull_request_template.md`).
5. CI runs on the PR. When green, tell the owner and share the PR link.
6. **The owner merges** ("Squash and merge" on GitHub, or explicitly tells Claude to). Never merge on your own.
7. After the merge: switch to `main`, `git pull --ff-only`, delete the local branch (GitHub auto-deletes the remote one).

Never commit directly to `main`. Never amend pushed commits, force-push, or skip hooks unless the owner asks.

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
