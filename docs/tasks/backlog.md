# Backlog

Ordered by table position. Task numbers are stable IDs (never renumbered), so new tasks get the next free number.
Each task is small and independently verifiable. Status: `todo` · `planned` · `in-progress` · `done` · `dropped` (kept for the record, with the reason).
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
| 17 | Code map + drift check | done |
| 15 | Sea floor (sand, rocks, shells) | done |
| 16 | Bubbles (particle system) | done |
| 18 | Tentacle root corner peeks out (small fix) | done |
| 20 | Boop + drag with struggle | done |
| 21 | Shake → ink | done |
| 27 | Ink reactions: Grumpy chase, Friendly dizzy | done |
| 28 | Treasure chest + shrimp (feeding) | done |
| 29 | Toys: rubber duck + soccer ball | todo |
| 30 | Dress-up: hats, sunglasses, fake beards | todo |
| 31 | Glow sticks | todo |
| 32 | Party: disco ball + club lights + music | todo |
| 22 | Feeding | dropped |
| 23 | Petting (slow strokes) | todo |
| 24 | Pop bubbles | dropped |
| 25 | Names + personality card | todo |
| 26 | Move shells (creatures investigate) | todo |
| 19 | "Hear them?" sound nudge | todo |

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

### 17. Code map + drift check
A "where things are" map so the growing codebase stays navigable and nobody (human or AI) references files, functions
or constants that don't exist. `docs/architecture/code-map.md`: every folder and file with a one-line purpose and key
exports, plus a "to change X, edit Y" table of tuning knobs. A unit test fails CI if a file in `src/` is missing from
the map or the map names a file that doesn't exist. Workflow: "verify before you reference" in `CLAUDE.md` and
`/plan-task` (specs name exact files/symbols, confirmed in the code); `/verify-task` checks the code map like the README.
- **Accept:** map covers every `src/` file; drift test fails on an unmapped or stale entry (proven, then reverted);
  tuning-knob table points at real constants; workflow docs updated; all checks pass.
- **Verify:** tests + a deliberate drift to see CI-style failure. Plan with `/plan-task 17`.
- **Approved spec decisions (2026-11-21):** map lists every non-test `src/` file (purpose + key exports) per folder;
  tests follow the "next to the code" convention; "to change X, edit Y" knob table (~30 rows, incl. private render/audio
  constants); "common changes" recipes (new archetype, emote, stimulus, knob). `src/codeMap.test.ts` (node fs, no new deps)
  fails on unmapped/stale files and on knob constants/keys that don't exist. Workflow: code map in CLAUDE.md "Read
  first" + "verify before you reference" rule; `/plan-task` lists exact files/symbols (confirmed or *new*);
  `/verify-task` checks the code map with the README; README links the code map.

### 15. Sea floor (sand, rocks, shells)
A sandy bottom with seeded rocks and shells (each world different), drawn behind the creatures; the floor becomes the
bottom of the world. Rocks/shells are **data in the simulation** (position, shape, kind), not just pixels, so they
can become interactive later (roadmap #10).
- **Accept:** seeded, deterministic layout; creatures never sink into the floor; readable cozy look (owner check);
  reduced motion respected; all checks pass.
- **Verify:** tests + visual check. Plan with `/plan-task 15` (look and world-bounds decisions with the owner).
- **Approved spec decisions (2026-11-21):** look **B "Moonlit reef"** (owner's pick from a 3-style preview): cool
  blue-grey sand with a wavy top edge and grain, dark mossy rocks, softly glowing shells, gently swaying seaweed
  (holds still under reduced motion). *New* `swimBounds(world)` (area above the sand + a small allowance so tentacles
  rest on it) replaces the full window height in spawning (`randomPosition`), steering (`stepMovement` →
  `stayInBounds`), constraints (`keepInBounds`) and hiding (`chooseHideTarget`). Scenery = data in *new*
  `simulation/scenery.ts` (`kind`: rock/shell/seaweed, relative `u`/`depth`, size, variant) from an independent
  seeded stream, so creature spawns don't shift; *new* `render/floor.ts` drawn between background and creatures.
  Floor ≈ 15% of height, clamped 70–130 px.

### 16. Bubbles (particle system)
Fleeing/startled creatures release a few bubbles that wobble up to the surface and pop. A small particle system:
spawning from events, lifetimes, object pooling (no per-frame allocations).
- **Accept:** bubbles spawn on flee/startle, rise and pop at the surface; bounded particle count; no measurable frame
  cost at 5 creatures; reduced motion respected; all checks pass.
- **Verify:** tests + visual check. Plan with `/plan-task 16`.
- **Approved spec decisions (2026-11-21):** bubble records live in the simulation (*new* `src/simulation/bubbles.ts`:
  fixed 64-slot ring-buffer pool of spawn events, per-creature last intent + trickle timers, independent seeded
  stream) with **analytic motion** (`bubbleAt`: rise, wobble, slight growth, pop at surface/lifetime); burst of 2–3
  when intent becomes `flee`/`hide`, trickle every 0.6–1.2 s while fleeing fast, **Grumpy huff** (1 bubble on
  entering `standoff`) — halved after owner feedback; *new* `src/render/bubbles.ts` draws them after creatures, before emotes; reduced motion =
  no wobble.

### 18. Tentacle root corner peeks out (small fix)
Owner noticed: sometimes a corner of an outer tentacle's root (usually the right-most) is slightly visible outside
the body. Confirmed in code: `taperedCurve` in `src/render/drawCreature.ts` rounds the **tip** (an arc at `p3`) but
ends the **root** with a flat edge `size * 0.36` wide; outer roots sit at ±0.75 × size, near the body edge, so when
the body shrinks (breathing inhale, scared shrink) a corner pokes out.
- **Fix idea (owner's):** round the root end like the tip (a semicircle at `p0`); if needed, tuck outer roots in.
- **Accept:** no root corner visible outside the body across breathing, scared shrink, grumpy puff, and lean
  (close-up screenshots); all checks pass. Low priority — do when convenient.
- **Approved spec decisions (2026-11-22):** measured cause: at the body's smallest (scared shrink + breathing low
  point) the outer root *center* (±0.75, 0.75 × size) is already outside the ellipse (≈ 1.08). Fix: rounded root cap
  in `taperedCurve` (mirrors the tip) **and** outer roots tucked in slightly (values chosen by a test); outline math
  extracted into a pure *new* `tentacleOutline` so a unit test (*new* `src/render/drawCreature.test.ts`) proves every
  root-cap point stays inside the smallest body for 5–8 tentacles; before/after close-ups for the owner.

### 19. "Hear them?" sound nudge
Owner decision (2026-11-22): keep sound muted by default (browser autoplay policy + portfolio etiquette), but make
it discoverable. When the first-visit hint fades (the visitor's first interaction — `hintVisible` in
`src/app/WorldCanvas.vue`), show a small "hear them?" label beside the speaker button (`src/app/MuteToggle.vue`) for a
few seconds; it disappears when sound is turned on or after the timeout, and appears only once per visit.
- **Accept:** shown once, after the first interaction; gone on unmute or after ~5 s; never while sound is on;
  accessible (doesn't steal focus; the button's label is unchanged); respects reduced motion; all checks pass.

### Interaction milestone (#20–#26) — owner decision 2026-11-22
The visitor can now *play* with the creatures, not only be noticed by them (vision principle 2 updated). Priority:
before #19 and the deploy. Keep it soft: no damage, creatures always recover, consequences are gentle (e.g. lower
trust). Each task gets its own `/plan-task` spec and PR; personality must show in every interaction.

### 20. Boop + drag with struggle
Click a creature = **boop** (squish, blink, per-personality reaction). Press-and-hold = **grab**: the creature hangs
from the cursor on a spring (lags, tugs, wriggles), tentacles dangle and trail (follow-through), and it makes a
struggle sound in its own voice. A "held" state sits above the mind (layered, ADR 0004); release → it reacts by
personality (Friendly may ♥, Scaredy flees, Grumpy glares). Hit-testing reuses `mantleRadii`/body geometry.
- **Accept:** reliable hit-testing (mouse + touch); spring drag stays in the swim area; struggle strength and reaction
  by archetype; sounds only when unmuted; deterministic with scripted pointer input; all checks pass.
- **Approved spec decisions (2026-11-22):** grab **head and tentacles** (owner): head ellipse from `BODY` + tolerance, and
  a fan-shaped tentacle zone below it (simulation can't import render geometry; slightly generous); head beats tentacle,
  top-most creature wins; the spring pulls the *grab point* to the cursor and the renderer stretches the grabbed
  tentacle's tip to it. Struggle = **tug + wriggle** (owner), strength from fear/grumpy levels × energy; tether ~50 px.
  Pointer sample gains `pressed`; press/release edges in simulation; boop = release < ~0.25 s and < ~8 px movement.
  *New* `simulation/interaction.ts`; *new* intent `'held'` overrides the mind's action while emotions keep updating
  (holding = max pressure in perception, so the archetype grid yields the held emotions); boop squash = damped spring
  in `anim`; sound events (grab squeak, struggle squeaks 0.4–0.8 s, boop blip) played via new chirp contours;
  cursor `grab`/`grabbing`; vision principle 2 updated.

### 21. Shake → ink
While held, rapid direction changes build a **stress** meter (personality sets the threshold: Scaredy low, Friendly
high). Past it: an **ink cloud** bursts (pooled particles, like bubbles), a *pfft* sound (filtered noise — new synth
capability), the creature slips free, flees/hides, and its **trust drops** for a while.
- **Accept:** gentle shaking doesn't ink; hard shaking does, by archetype; ink cloud spreads and fades (bounded pool);
  trust consequence measurable; reduced motion respected; all checks pass.
- **Approved spec decisions (2026-11-22):** stress = hand *acceleration* above a threshold while held (leaky bucket:
  decays when calm; smooth sweeps don't count); threshold from boldness/curiosity (≈ Scaredy 1 s < Peeker 1.5 s <
  Grumpy 2.5 s < Friendly 3.5 s of hard shaking). Warning tell near the limit: tremble + faster squeaks + darker
  flush (reduced motion: no tremble). Ink: **deep indigo smoke** (owner), *new* `simulation/ink.ts` pooled puffs with
  analytic motion, own random stream, ~4 s; *new* `render/ink.ts` drawn after creatures, before bubbles. Escape:
  hold ends (fresh press needed), startle + dash, `!` emote. *New* `Perception.rattled` (**~30 s**, owner) caps trust
  at 1 − rattled. *pfft* = new synth noise burst (`puff()`, `puffFor`), only when unmuted. `rattled` in debug panel.

### 22. Feeding — dropped (owner, 2026-11-22): replaced by #28
> Food comes from the treasure chest (#28) instead of appearing where you click empty water; shrimp only.

Click empty water to drop a food pellet that slowly sinks. Curious creatures race for it, timid ones wait until the
visitor backs off, the Grumpy guards it; eating shows a happy reaction. Shows every personality at once.
- **Accept:** pellets sink and rest on the sand; creatures' approach order/behavior differs by archetype (scenario
  test); a pellet is eaten once; bounded count; all checks pass.

### 23. Petting (slow strokes)
Slowly stroking over a creature's head (a gentle drag-free hover motion, or slow press-drag) = petting: trust builds
faster; Friendly purrs (sound) and blushes; Scaredy relaxes slowly; Grumpy tolerates it only once it trusts you.
- **Accept:** stroke detection distinguishes petting from chasing/grabbing; per-archetype response; all checks pass.

### 24. Pop bubbles — dropped (owner, 2026-11-22)
> Not worth it: the bubbles are small and pop on their own within seconds, so visitors would hardly notice.

Click a rising bubble to pop it early with a tiny *plip* (only when unmuted).
- **Accept:** hit-testing on bubbles; pop animation reused; does not grab a creature behind it; all checks pass.

### 25. Names + personality card
Each creature gets a generated, seeded name; clicking/tapping it (when not grabbing) shows a small card: name,
personality, current mood. Helps visitors connect with individuals (addresses "personalities are hard to tell apart").
- **Accept:** deterministic names per seed; accessible card (keyboard-dismissable, readable); doesn't clash with
  boop/drag; all checks pass.

### 26. Move shells (creatures investigate)
Drag a shell along the sand; curious creatures come to inspect it where it lands. First step of roadmap #10.
- **Accept:** shells are draggable (scenery data updates), stay on the sand, never end up under a rock; curious
  archetypes investigate; all checks pass.


### 27. Ink reactions: Grumpy chase, Friendly dizzy — owner request 2026-11-22
Make the two bold personalities' ink reactions as distinct as the Scaredy's escape (refines #21).
- **Grumpy gets mad and chases:** replaces #21's double squirt. After its first squirt it switches to a *chase*
  (~4 s): it swims at the cursor (faster than its normal swim, slower than a hand, so the visitor can escape) and,
  whenever the cursor is within inking range (~80 px), squirts a small aimed puff — at most every 0.5 s — each with 💢
  and a *pfft*. Then it gives up into the existing standoff + grudge. Ends early if the visitor leaves the pool.
  Likely a new intent (`chase`) driven by the interaction layer; the ink pool may need to grow (more puffs).
- **Friendly gets dizzy, then forgives** (owner's choice): no cloud — only a tiny "hiccup" puff. Dizzy for ~3 s:
  spiral eyes, little stars, wobbly loop-de-loop swimming. Then it shakes it off, drifts back to the visitor and
  nuzzles with a ♥ — no grudge (rattled clears quickly), the opposite of the Grumpy.
- Scaredy and Peeker keep #21's ink-and-flee.
- **Accept:** Grumpy chases for a bounded time, inks only within range and never more often than every 0.5 s, gives
  up and stands off; it is fast — walking away isn't enough, but a visitor can dodge it (owner feedback); Friendly hiccup-puff + dizzy + returns with ♥ and isn't rattled long;
  reduced motion (dizzy wobble toned down); sounds only when unmuted; deterministic; all checks pass.
- **Approved spec decisions (2026-11-22):** `interactionIntent` generalises the override above the mind (held >
  chase/dizzy); *new* intents `chase`, `dizzy`; trait-defined *new* `forgives` (bold + curious) next to
  `standsItsGround`. Grumpy: chase ~4 s at ~200 px/s (`arrive` toward the cursor), inks within ~80 px at most every
  0.5 s, ends on leaving/grab → standoff + grudge; replaces `followUp`. Friendly: tiny hiccup puff + 'hic' chirp, dizzy
  ~3 s (spiral eyes, orbiting stars, wobble tilt, loop swimming from a rotating target velocity), then squish + ♥;
  low, short rattled, trust kept. `spawnInk` gains count/scale; `INK.capacity` 128. Reduced motion: `dizzyWobble`.

### Treasure chest milestone (#28–#32) — owner decision 2026-11-22
Items come from a **treasure chest on the sand in the bottom-left corner** (where the mute button is now; the mute
button moves to the bottom-right). Click it: it creaks open and the items float up in an arc above it; **drag** an
item into the pool (or onto a creature, for dress-up); click again to close. Each item exists once: shrimp gets
eaten; toys, glow sticks and dress-up items can be dragged back into the chest — no clutter. Items are **props**:
plain simulation data (position, floats/sinks, kind) that creatures perceive like the visitor, so personality decides
who investigates. The chest UI belongs to the world (rendered on the sand), dragging reuses the grab system.

### 28. Treasure chest + shrimp (feeding)
The chest (bottom-left, mute → bottom-right), opening/closing, items floating out, drag-to-place; the props
foundation; **shrimp** (the only food): sinks slowly, rests on the sand, is eaten once. Each personality shows: the
Friendly races for it, the Peeker sneaks in, the Grumpy guards it, the Scaredy waits until the visitor backs off;
eating shows a happy reaction.
- **Accept:** chest opens/closes and items can be dragged out (mouse + touch); mute button moved; shrimp sinks,
  rests and is eaten once; approach behaviour differs by archetype (scenario tests); bounded props; all checks pass.
- **Approved spec decisions (2026-11-22):** **sunken wooden chest** (wood, brass bands, moss, barnacles; golden glow)
  and **at most 3 shrimp** in the water (owner). *New* `simulation/props.ts` (chest: open/slots/hit-test; props:
  sink/drift/rest, bounded), *new* `simulation/feeding.ts` (*new* intents `eat`, `guard`; Friendly races, Peeker sneaks
  while the hand is > ~150 px away, Scaredy waits for > ~300 px or no hand, Grumpy guards then eats), carrying in
  `interaction.ts` (slots checked before creatures), *new* `ChestToggle.vue` accessible button over the drawn chest
  (`toggleChest`), scenery keeps the chest corner clear, mute → bottom-right, 'nom' chirp; *new* `render/chest.ts`,
  `render/props.ts`.

### 29. Toys: rubber duck + soccer ball
A rubber duck floats and bobs at the surface; a soccer ball sinks slowly and bounces softly on the sand. Curious
creatures nudge them around (the duck drifts and spins). Both can be dragged back into the chest.
- **Accept:** float/sink/bounce physics stay in the pool; creatures nudge them by personality; deterministic;
  all checks pass.

### 30. Dress-up: hats, sunglasses, fake beards
Drop an accessory on a creature and it wears it (drawn on the creature, moving with it); it reacts by personality —
the Friendly shows off, the Scaredy is nervous then proud, the Grumpy tries to shake it off (and secretly keeps the
sunglasses). Drag it off to take it back.
- **Accept:** hit-testing a drop onto a creature; accessories follow body motion (incl. lean/jet/dizzy); reactions
  by archetype; removable; all checks pass.

### 31. Glow sticks
A creature grabs a glow stick and holds it in a tentacle; it glows softly in the water (and is waved at the party).
- **Accept:** a stick is held by one creature at a time and follows its tentacle; glow rendering; returnable to the
  chest; all checks pass.

### 32. Party: disco ball + club lights + music
The disco ball and club lights come out together: the pool dims, the disco ball throws moving spots of light, colored
beams sweep, an **original synthesized tech-house / bass-house groove** plays (four-on-the-floor kick, offbeat hats,
rolling bassline, chord stabs — the vibe of an Austin dance festival, not a copy of any real track or artist; no
festival branding in the app), and the creatures **dance to the beat** in their own style (glow sticks waving).
- **Light safety:** no strobes — at most 3 flashes per second (WCAG 2.3.1); slow sweeps and color fades; under reduced
  motion a calm static colored glow.
- **Accept:** party toggles on/off from the chest; music only when unmuted and in sync with the dance beat (one beat
  clock); light-safe (tested flash rate); dancing differs by archetype; performance holds 60 fps; all checks pass.

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
