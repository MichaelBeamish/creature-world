# Progress Log

Newest first. One entry per verified task or significant decision.

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
