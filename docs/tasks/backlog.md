# Backlog

Ordered. Each task is small and independently verifiable. Status: `todo` · `planned` · `in-progress` · `done`.
Before starting a task, run `/plan-task <n>` to write a detailed spec and get approval.

| # | Task | Status |
|---|---|---|
| 1 | Project scaffold | done |
| 2 | Canvas stage + game loop | done |
| 3 | Simulation core: world, creature, RNG | todo |
| 4 | Draw a static creature | todo |
| 5 | Idle animation | todo |
| 6 | Wandering + bounds + separation | todo |
| 7 | Cursor presence + perception | todo |
| 8 | Traits + RuleMind reactions | todo |
| 9 | Eyes + emotes | todo |
| 10 | Debug overlay | todo |
| 11 | Sound + mute toggle | todo |
| 12 | MVP polish + success-criteria review | todo |

---

### 1. Project scaffold
Vite + Vue 3 + TS (strict), Vitest, ESLint + Prettier, pnpm; folder layout from the architecture doc; commands in CLAUDE.md.
- **Accept:** `pnpm dev` serves a page; `pnpm test`, `pnpm lint`, `pnpm typecheck` pass with one sample test.
- **Verify:** run all four commands.
- **Approved spec decisions (2026-11-20):** install pnpm globally via npm and pin it in `packageManager`;
  `engines.node >=22.12.0`; deps: `vue` + dev `vite`, `@vitejs/plugin-vue`, `typescript`, `vue-tsc`, `@vue/tsconfig`,
  `vitest`, `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-vue`, `eslint-config-prettier`, `prettier`.
  Also: strip `create-vite` demo content; lint rule blocks vue/render/input/app imports in `src/simulation/`;
  sample test `src/simulation/math.test.ts` (`clamp`, `lerp`); `format:check` and `build` must pass too.

### 2. Canvas stage + game loop
Full-viewport, DPR-aware canvas; fixed-timestep loop with interpolation alpha; resize handling.
- **Accept:** a test dot moves smoothly; loop step count is correct for a given elapsed time (unit test).
- **Verify:** tests + visual check on resize.
- **Approved spec decisions (2026-11-20):** 60 Hz fixed step with accumulator + render interpolation (alpha);
  frame delta capped at 250 ms + max steps per frame; DPR-aware canvas via ResizeObserver; loop/stage kept out of
  Vue reactivity, stopped in `onBeforeUnmount`; temporary `src/app/demoDot.ts` (delete in task #4); no new deps.

### 3. Simulation core
`World`, `Creature`, seeded `rng`, `world.step(dt)`; no DOM imports.
- **Accept:** same seed → identical world state after N steps (unit test).
- **Verify:** tests; grep confirms no DOM/Vue imports in `src/simulation/`.

### 4. Draw a static creature
Procedural body, eyes, tentacles from creature params (color, size, tentacle count).
- **Accept:** 3–5 visibly distinct creatures render at spawn positions.
- **Verify:** visual check (screenshot).

### 5. Idle animation
Breathing, blinking, tentacle sway, driven by per-creature phases.
- **Accept:** creatures look alive while stationary; animation phases are not synchronized.
- **Verify:** visual check; unit test that blink timing varies by creature.

### 6. Wandering + bounds + separation
Steering: wander, soft screen bounds, separation; occasional rest.
- **Accept:** 60s run: no creature leaves the screen or overlaps another (unit test on simulation).
- **Verify:** tests + visual check.

### 7. Cursor presence + perception
Input module maps pointer/tap to `Presence`; creatures compute attention from distance and cursor motion.
- **Accept:** attention rises when presence is within radius and decays outside (unit test).
- **Verify:** tests + debug log/visual.

### 8. Traits + RuleMind reactions
`Mind` interface; `RuleMind` chooses approach/follow/peek/flee/hide from traits and attention.
- **Accept:** MVP success criterion #3 (shy ends farther than curious) passes as a unit test.
- **Verify:** tests + visual check with contrasting creatures.

### 9. Eyes + emotes
Eyes track the focus target; emotes (`!`, `?`, `♥`) pop on state changes; squash/stretch with velocity.
- **Accept:** noticing the cursor shows a reaction within 1s (criterion #2).
- **Verify:** visual check.

### 10. Debug overlay
Toggle (e.g. `D` key) drawing radii/states on canvas, plus a Vue panel with traits and FPS (throttled snapshots).
- **Accept:** overlay shows correct state; no FPS drop with overlay off.
- **Verify:** visual check; Vue panel updates ≤ 5 Hz.

### 11. Sound + mute toggle
Soft synthesized chirps (Web Audio) on notice/emote; muted by default; Vue toggle.
- **Accept:** no sound until unmuted; chirps vary by creature.
- **Verify:** manual check.

### 12. MVP polish + review
Background, color tuning, timing tweaks; walk through all MVP success criteria.
- **Accept:** all criteria in `mvp.md` checked and recorded in `progress.md`.
- **Verify:** criteria checklist.
