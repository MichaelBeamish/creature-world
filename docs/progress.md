# Progress Log

Newest first. One entry per verified task or significant decision.

## 2026-11-20 — Task #4: Draw a static creature ✅
- **Done:** style B "Little octopus" (owner picked it from a 3-style preview): tapered Bézier tentacles with
  rounded tips, light fuzz, gradient-shaded mantle, eyes with highlights. `drawScene` (pure, painter's algorithm,
  interpolated); `render/noise.ts` stateless hash for per-creature detail; shared `BODY` proportions + spawn
  `footprint`; rejection-sampled non-overlapping spawns; golden-angle hues; `?seed=` / random seed (logged).
  Deleted the temporary `demoDot.ts`.
- **Verified:** 38/38 tests (non-overlap across 6 seeds, hue spacing ≥ 30°, footprint in bounds, hash range and
  uniformity, seed parsing); same seed → byte-identical screenshots; frames 0.5 s vs 4 s identical (no flicker);
  sharp at 2× DPR; owner approved the look.
- **Known limitation:** very small windows can't fit 5 footprints, so creatures overlap at spawn → resolved by
  separation in task #6 (owner chose to defer).
- **Learned / notes:** rejection sampling with capped attempts; golden-angle color spacing; stateless noise keeps
  rendering a pure function of state; painter's algorithm.
- **Next:** task #5 (idle animation).

## 2026-11-20 — Task #14: Branch + pull-request workflow ✅
- **Done:** one branch (`task/<n>-<slug>`) and PR per task; `/checkpoint` = one approval for commit + push + PR;
  owner merges ("Squash and merge"). PR template added; CLAUDE.md Git workflow section; implement/verify/checkpoint
  skills updated. Repo: squash-only, auto-delete merged branches, squash commits keep commit messages.
  Ruleset "Protect main": PR required, both CI checks required, no force-push or deletion, no bypass.
- **Verified:** API read-back of repo settings and effective rules on `main`; local checks pass; delivered as PR #1
  with green CI, merged by the owner.
- **Learned / notes:** feature branches + PRs as the review gate; squash merge tradeoffs; rulesets vs classic branch
  protection; required checks match job names (rename the CI job → update the ruleset); `git branch -D` after squash.
- **Next:** task #4 (draw a static creature) — first task through the full PR flow.

## 2026-11-20 — Task #13: CI with GitHub Actions ✅
- **Done:** `.github/workflows/ci.yml` — on push to `main`, PRs, and manual dispatch; Node 22 + latest LTS matrix;
  pnpm from `packageManager` with store cache; `--frozen-lockfile`; format → lint → typecheck → test → build as
  separate steps; read-only token; concurrency cancels stale runs. Added tasks #13/#14 to the backlog (stable IDs).
- **Verified:** run 44842531643 green on both Node versions; rerun restored the pnpm cache; temporary branch
  `ci-red-check` with a failing test → run 44842663363 failed at the Test step on both jobs (and GitHub emailed the
  owner); branch deleted, `main` untouched.
- **Learned / notes:** CI as the shared source of truth; matrix builds; least-privilege tokens and action pinning
  (major tag vs SHA); lockfile-keyed caching. GitHub notifies on failed runs (email / mobile app).
- **Next:** task #14 (branch + pull-request workflow), delivered as the first PR.

## 2026-11-20 — Task #3: Simulation core ✅
- **Done:** `rng.ts` (mulberry32; `createRng`/`next`/`range`/`int`/`pick`, state as plain data); `vec2.ts` (in-place
  helpers); `creature.ts` (seeded spawn: position, hue, size, tentacles); `world.ts` (`createWorld`, `stepWorld` with
  prevPosition + Euler integration, `resizeWorld`). ESLint now also bans browser globals, `Math.random`, `Date.now`
  in simulation. Not yet wired into the app (task #4).
- **Verified:** 30/30 tests (17 new: determinism after 600 steps, seed sensitivity, spawn bounds, RNG range and
  uniformity); lint probe → 7 errors from 3 rules; typecheck, format, build pass; app unchanged, no console errors.
- **Learned / notes:** seeded PRNG with state in the world = reproducible "randomness"; data-oriented design
  (plain data + functions) vs OOP; in-place mutation to avoid GC stutter.
- **Next:** task #4 (draw a static creature).

## 2026-11-20 — Task #2: Canvas stage + game loop ✅
- **Done:** `fixedStep.ts` (pure 60 Hz accumulator: steps, carry-over, alpha, 250 ms frame cap, 10-step cap);
  `gameLoop.ts` (rAF driver, idempotent start/stop); `render/stage.ts` (DPR-aware canvas + ResizeObserver);
  `WorldCanvas.vue` (template ref, non-reactive loop/stage, cleanup in `onBeforeUnmount`); temporary `demoDot.ts`.
- **Verified:** 13/13 tests (incl. 30/60/144 FPS → identical 60 steps/s); typecheck, lint, format, build pass;
  headless Chrome at DPR 2: canvas = viewport, buffer = 2×, no scrollbars, ~60 FPS, no console errors;
  HMR edits keep a single loop (60 rAF calls/s); owner confirmed smooth motion and clean resizing.
- **Learned / notes:** "Fix Your Timestep" pattern, spiral-of-death caps, DPR backing store vs CSS size,
  keeping per-frame objects out of Vue reactivity. Also: GitHub repo created (public) and push rule added to workflow.
- **Next:** task #3 (simulation core: world, creature, seeded RNG).

## 2026-11-20 — Task #1: Project scaffold ✅
- **Done:** Vite 8 + Vue 3.5 + TypeScript 6 (strict) via `create-vite` (demo content removed); Vitest 5; ESLint 10 flat config
  (typescript-eslint, eslint-plugin-vue, eslint-config-prettier); Prettier; pnpm 12.21.0 pinned; Node >=22.12.0.
  Sample tests for `clamp` and `lerp`. ESLint `no-restricted-imports` enforces the simulation layer boundary.
- **Verified:** test (6/6), typecheck, lint, format:check, build all exit 0; lint probe confirmed the layer rule;
  headless Chrome rendered the placeholder with no console errors.
- **Learned / notes:** TypeScript pinned to `~6.0.3` because `vue-tsc` and `typescript-eslint` don't support TS 7 yet;
  `@types/node` and `env.d.ts` not needed; Vite doesn't type-check in dev (use editor or `pnpm typecheck`).
  Added the owner's Mentoring preference to CLAUDE.md.
- **Next:** task #2 (canvas stage + game loop).

## 2026-11-20 — Discovery & documentation
- Defined vision, MVP ("The Tide Pool"), architecture, backlog, and skills workflow.
- Owner approved architecture, stack, and MVP scope; ADRs 0001–0003 accepted.
- Added root `.gitignore` (incl. `.claude/settings.local.json`).
- Next: backlog task #1 (project scaffold).
