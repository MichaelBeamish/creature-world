# Backlog

Ordered by table position. Task numbers are stable IDs (never renumbered), so new tasks get the next free number.
Each task is small and independently verifiable. Status: `todo` · `planned` · `in-progress` · `done`.
Before starting a task, run `/plan-task <n>` to write a detailed spec and get approval.

| # | Task | Status |
|---|---|---|
| 1 | Project scaffold | done |
| 2 | Canvas stage + game loop | done |
| 3 | Simulation core: world, creature, RNG | done |
| 13 | CI with GitHub Actions | done |
| 14 | Branch + pull-request workflow | done |
| 4 | Draw a static creature | done |
| 5 | Idle animation | done |
| 6 | Wandering + bounds + separation | done |
| 7 | Cursor presence + perception | done |
| 8 | Traits + RuleMind reactions | done |
| 9 | Eyes + emotes | done |
| 10 | Debug overlay | done |
| 11 | Sound + mute toggle | done |
| 12 | MVP polish + success-criteria review | done |
| 15 | Sea floor (sand, rocks, shells) | todo |
| 16 | Bubbles (particle system) | todo |

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
- **Approved spec decisions (2026-11-20):** plain serializable data + functions (no classes), mutated in place;
  hand-written mulberry32 PRNG (state stored in world); creature = id, position, prevPosition, velocity, hue, size,
  tentacleCount; world coords = CSS px; ESLint `no-restricted-globals` bans window/document/rAF/performance/Math.random
  in simulation; not wired into the app until task #4; no new deps.

### 4. Draw a static creature
Procedural body, eyes, tentacles from creature params (color, size, tentacle count).
- **Accept:** 3–5 visibly distinct creatures render at spawn positions.
- **Verify:** visual check (screenshot).
- **Approved spec decisions (2026-11-20):** style **B "Little octopus"** (tall mantle, eyes low, long wavy tapered
  tentacles, soft gradient shading, light fuzz) — preview sketch reviewed by owner; render as a pure function of state;
  stateless hash noise for fur; golden-angle hue spacing (pastel); rejection-sampled non-overlapping spawns using a
  footprint that includes tentacles; seed random per visit, `?seed=` override, logged; default 5 creatures;
  delete `demoDot.ts`; owner does the final visual check.

### 5. Idle animation
Breathing, blinking, tentacle sway, driven by per-creature phases.
- **Accept:** creatures look alive while stationary; animation phases are not synchronized.
- **Verify:** visual check; unit test that blink timing varies by creature.
- **Approved spec decisions (2026-11-20):** animation state in simulation (`breathPhase/Rate`, `swayPhase/Rate`,
  `blinkTimer`, `eyeOpenness`) stepped by `stepAnimation`; phase accumulation (`phase += rate*dt`), not `sin(t*rate)`;
  seeded per-creature phases/rates; blink state machine (2–6 s wait, ~160 ms blink, ~15% double blinks); traveling-wave
  tentacle sway; subtle squash/stretch breathing; no interpolation of phases.

### 6. Wandering + bounds + separation
Steering: wander, soft screen bounds, separation; occasional rest.
- **Accept:** 60s run: no creature leaves the screen or overlaps another (unit test on simulation).
- **Verify:** tests + visual check.
- **Carried over from task #4:** in small windows, spawn footprints can't all fit, so creatures start overlapping;
  separation must resolve this (use `footprint()` from `creature.ts`), including after the window shrinks.
- **Approved spec decisions (2026-11-20):** Reynolds steering (wander circle, soft stay-in-bounds, footprint
  separation) blended into acceleration with water drag and max speed ~35 px/s; hard constraint pass afterwards
  (position-based: separate overlaps, clamp footprints into bounds, few iterations); seeded wander/rest activity
  (6–15 s / 3–8 s); step order activity → steering → velocity → position → constraints → animation; subtle lean
  (≤ ~8°) + tentacle trailing in the renderer; one shared speed until traits (task #8).

### 7. Cursor presence + perception
Input module maps pointer/tap to `Presence`; creatures compute attention from distance and cursor motion.
- **Accept:** attention rises when presence is within radius and decays outside (unit test).
- **Verify:** tests + debug log/visual.
- **Owner decision (2026-11-20):** perception classifies the visitor's behavior into three stimuli — **calm presence**
  (hovering still / slow nearby, builds trust), **sudden movement** (fast flick, startles), **chasing** (cursor keeps
  following one creature, pressure builds). Clicking is out of MVP (roadmap #9).
- **Approved spec decisions (2026-11-20):** `input/pointer.ts` keeps only the latest Pointer Events sample (mouse/pen/
  touch; tap ≈ 1 s presence; `touch-action: none`); app copies it into the world once per fixed step
  (`setPresenceInput`); presence velocity = EMA computed in simulation; perception per creature: attention with fast
  attack (~0.3 s) / slow release (~2 s), `startle` impulse (> 900 px/s, ~0.6 s), `pressure` (heading ≤ 45° toward,
  > 60 px/s, ~1.5 s), `trust` (< 80 px/s nearby, ~4 s); stimulus priority sudden > chasing > calm > none; radius 240 px,
  same for all; no behavior change yet; minimal dev-only `?debug` view (ring + label) that task #10 extends.

### 8. Traits + RuleMind reactions
`Mind` interface; `RuleMind` chooses approach/follow/peek/flee/hide/grumpy stand-off from traits, emotion and stimuli.
- **Accept:** MVP success criterion #3 (Scaredy ends farther than Friendly; sudden movement → Grumpy stands its ground,
  Scaredy flees) passes as unit tests.
- **Owner decision (2026-11-20):** traits are `curiosity`, `boldness` (replaces `shyness`), `energy`, set by an
  **archetype** (Peeker, Friendly, Scaredy, Grumpy — the curiosity × boldness grid in `mvp.md`) + small seeded
  variation; archetypes dealt without replacement so every world has a mix. Emotions (curious, scared, grumpy, content)
  are temporary states; energy also replaces the shared speed from task #6.
- **Approved spec decisions (2026-11-20):** perception → utility-scored emotions (scared = disturbance × (1−boldness);
  grumpy = disturbance × boldness × (1−curiosity); curious = attention × curiosity × trust-boost; content baseline 0.3)
  → dominant emotion with smoothing + hysteresis + minimum duration (fear is an instant reflex) → intent (approach/
  follow, peek, flee, hide = edge point farthest from cursor, stand-off, wander/rest) → Reynolds seek/arrive/flee.
  Archetype dials: Friendly .85/.80, Peeker .80/.25, Scaredy .20/.15, Grumpy .20/.85 (curiosity/boldness) ±0.08;
  energy 0.3–0.9 scales speed; flee ≈ 2.5× speed. `Mind` interface + `ruleMind` (future LLM layered above for
  goals; reflexes stay in RuleMind). Debug labels show archetype/emotion/intent. Record in ADR 0004. One task.
- **Verify:** tests + visual check with contrasting creatures.

### 9. Eyes + emotes
Eyes track the focus target; emotes (`!`, `?`, `♥`, `💢`) pop on state changes; squash/stretch with velocity;
grumpy puff-up + color flush; breathing/sway rates follow the emotion (phase accumulation keeps it smooth).
- **Accept:** noticing the cursor shows a reaction within 1s (criterion #2).
- **Approved spec decisions (2026-11-20):** `simulation/expression.ts` holds gaze (saccade-like darts toward cursor when
  attentive, else travel direction; content creatures occasionally glance at a neighbour), emote events with ~1.5 s
  life and ≥ 2.5 s per-creature cooldown (curious → ?, scared → !, grumpy → 💢, Friendly near trusted visitor → ♥ once
  per visit), and emotion-scaled breath/sway rates (phase accumulation keeps them smooth). Renderer maps emotion levels
  continuously: scared = wide eyes, tiny pupils, shrink, bristling fur, stretch when darting; grumpy = half-lid glare,
  puff-up, red flush, bristling fur; curious = bigger pupils; affection = blush. Emotes are vector-drawn (no emoji
  fonts) with an overshoot pop, float, fade.
- **Verify:** visual check.

### 10. Debug overlay
Toggle (e.g. `D` key) drawing radii/states on canvas, plus a Vue panel with traits and FPS (throttled snapshots).
- **Accept:** overlay shows correct state; no FPS drop with overlay off.
- **Verify:** visual check; Vue panel updates ≤ 5 Hz.
- **Approved spec decisions (2026-11-20):** `D` toggles in dev; `?debug` enables in any build (and then `D` works);
  `app/fpsMeter.ts` (rolling FPS, avg/worst frame work time) + `app/debugSnapshot.ts` (world → plain snapshot, 5 Hz
  publisher) as pure tested TS; `DebugPanel.vue` display-only, collapsible, top-right, fed via `shallowRef`; zero cost
  when off; no Vue component tests (no new deps); owner reads FPS for MVP criterion #4.

### 11. Sound + mute toggle
Soft synthesized chirps (Web Audio) on notice/emote; muted by default; Vue toggle.
- **Accept:** no sound until unmuted; chirps vary by creature.
- **Verify:** manual check.
- **Approved spec decisions (2026-11-21):** sounds triggered by new emote events, detected by an `src/audio/` layer
  observing the world (no simulation change); pure `chirpFor(creature, emote)` sound descriptions — pitch from size
  snapped to a pentatonic scale, timbre from archetype (Friendly sine, Peeker triangle doubled, Scaredy high + vibrato,
  Grumpy filtered buzzy wave), contour from emote (? rising, ! blip, 💢 falling grumble, ♥ two-note coo); Web Audio
  oscillator → low-pass → envelope → stereo pan (by screen x) → quiet master; ≤ 4 voices; `AudioContext` created only
  on the unmute click (autoplay policy); always start muted, preference not stored; accessible `MuteToggle.vue`.

### 12. MVP polish + review
Background, color tuning, timing tweaks; walk through all MVP success criteria.
- **Accept:** all criteria in `mvp.md` checked and recorded in `progress.md`.
- **Verify:** criteria checklist.
- **Carried over from task #5:** honor `prefers-reduced-motion` (tone down sway/breathing amplitude; keep blinks).
- **Approved spec decisions (2026-11-21):** (A) reduced motion read live via `matchMedia`, passed as a motion factor to
  the renderer: sway ×0.3, breathing ×0.4, lean/trailing ×0.5, emotes fade without overshoot, background still;
  wandering and reactions unchanged. (B) polish — owner chose all four: living background (caustics, floating motes,
  vignette), first-visit hint that fades on first interaction, share-ready page meta (description, theme color, Open
  Graph), README for the public repo. (C) MVP review: evidence for all 6 criteria recorded in `progress.md`,
  `mvp.md` marked achieved; criterion #6 informal friend test run by the owner (script provided); touch tap emulated.
  Sea floor and bubbles split out into #15/#16 (owner agreed: keep #12 focused on closing the MVP).

### 15. Sea floor (sand, rocks, shells)
A sandy bottom with seeded rocks and shells (each world different), drawn behind the creatures; the floor becomes the
bottom of the world. Rocks/shells are **data in the simulation** (position, shape, kind), not just pixels, so they
can become interactive later (roadmap #10).
- **Accept:** seeded, deterministic layout; creatures never sink into the floor; readable cozy look (owner check);
  reduced motion respected; all checks pass.
- **Verify:** tests + visual check. Plan with `/plan-task 15` (look and world-bounds decisions with the owner).

### 16. Bubbles (particle system)
Fleeing/startled creatures release a few bubbles that wobble up to the surface and pop. A small particle system:
spawning from events, lifetimes, object pooling (no per-frame allocations).
- **Accept:** bubbles spawn on flee/startle, rise and pop at the surface; bounded particle count; no measurable frame
  cost at 5 creatures; reduced motion respected; all checks pass.
- **Verify:** tests + visual check. Plan with `/plan-task 16`.

### 13. CI with GitHub Actions
`.github/workflows/ci.yml` runs on every push to `main` and every pull request: install with the locked
dependencies, then test, typecheck, lint, format:check, build.
- **Accept:** the workflow passes on GitHub for `main`; a deliberately broken check makes it fail (then revert).
- **Verify:** `gh run list` / `gh run view` show green and red runs as expected.
- **Approved spec decisions (2026-11-20):** triggers push(main) + pull_request + workflow_dispatch; pnpm version from
  `packageManager`, pnpm cache; checks as separate steps (format → lint → typecheck → test → build); Node matrix 22 +
  `lts/*`; `permissions: contents: read`; concurrency cancels stale runs; actions pinned to major tags; red run proven
  via a temporary branch + workflow_dispatch, then deleted; committed directly to main (last time before task #14).

### 14. Branch + pull-request workflow
Each task gets its own branch and pull request; merging the PR becomes the owner's approval gate.
Update `CLAUDE.md` and the skills (`implement-task` creates the branch, `checkpoint` commits/pushes the branch and
opens the PR, merge only with owner approval); protect `main` so it requires green CI.
- **Accept:** docs and skills describe the new flow; this task itself is delivered through the first PR, which
  shows green CI and is merged by the owner.
- **Verify:** the PR page on GitHub shows the task summary, a passing CI check, and the merge.
- **Approved spec decisions (2026-11-20):** branches `task/<n>-<slug>`; one approval at checkpoint covers commit +
  branch push + PR; owner merges ("Squash and merge"); squash-only merges + auto-delete branches; ruleset on `main`:
  PR required, both CI checks required, no force-push/deletion, applies to admins; PR template; skills + CLAUDE.md updated.
