# Architecture Overview

> This explains *how and why* the system works. For *where* each file lives and which constant to edit for a given
> change, see the [code map](code-map.md) (kept in sync by `src/codeMap.test.ts`).

## Layers
```
src/
  simulation/   pure TS: world, creatures, traits, perception, minds, steering, rng   (no DOM, no Vue)
  render/       Canvas 2D: scene background, procedural creature drawing, emotes, debug draw
  input/        DOM pointer events → world "presence" (cursor position, velocity, active)
  audio/        Web Audio: per-creature chirp voices, triggered by new emotes (an output layer, like render/)
  app/          game loop, wiring, Vue shell (overlay UI: mute toggle, debug panel); App.vue is the root
  main.ts       entry point: mounts App.vue
```
Tests sit next to the code they cover (`*.test.ts`). Simulation purity is enforced by ESLint in `eslint.config.js`:
no Vue/render/input/app imports, no browser globals, no `Math.random` / `Date.now`.
Dependency direction: `app → render, input → simulation`. Simulation depends on nothing.

## Data flow (per frame)
```
pointer events ─► input ─► Presence ─┐
                                     ▼
fixed-step loop ─► stepWorld(world, dt) : perceive → think (mind) → steer → integrate
                                     ▼
                 renderer.draw(world, alpha)  (interpolates between steps)
                                     ▼
          throttled snapshot (~5 Hz) ─► Vue debug panel
```

## Key concepts
Simulation state is **plain, serializable data**; behavior is **functions** that mutate it in place
(e.g. `stepWorld(world, dt)`). Easy to test (`toEqual`), clone, snapshot for the debug panel, and later persist.

- **World** — size, time, tick, seeded RNG state, creatures (later: presence). `stepWorld` advances one fixed step.
- **Rng** — mulberry32 PRNG with state stored in the world; the only source of randomness in simulation.
- **Creature** — id, position, prevPosition (for interpolation), velocity, appearance, `anim`, `perception`,
  `archetype` + `traits`, `mind` (emotion + intent), `expression` (gaze, emote).
- **Animation** — `anim` (breath/sway oscillators, blink state machine) is simulation state stepped by
  `stepAnimation`, because behavior will modulate it. Oscillators accumulate phase (`phase += rate·dt`, wrapped),
  so changing a rate never makes motion jump. The renderer maps it to squash/stretch, eyelids, and tentacle sway.
- **Body proportions** — `BODY` in `creature.ts` (multiples of `size`) is shared by simulation (spawn
  footprint, later collisions) and rendering, so what you see matches the space a creature occupies.
- **Rendering** — `drawScene(ctx, world, alpha)` is a pure function of world state (painter's algorithm, back to
  front). Per-creature detail (fur, tentacle variation) comes from a stateless hash (`render/noise.ts`), never stored.
- **Seed** — random per visit; `?seed=<int>` reproduces a world (seed is logged to the console).
- **Input → Presence** — `input/pointer.ts` (Pointer Events: mouse/pen/touch) only keeps the latest sample. Once per
  fixed step the app copies it into `world.presence` (`setPresenceInput`); the simulation derives smoothed velocity
  itself. Input is sampled at the boundary, so the simulation stays DOM-free and tests script cursor paths per tick.
- **Perception** (`perception.ts`) — per creature, the same for all: `attention` (fast attack / slow release),
  `startle`, `pressure`, `trust`, and the current `stimulus` (sudden > chasing > calm > none). Personality decides
  how a creature *feels* about it (task #8).
- **Personality** (`traits.ts`, ADR 0004) — archetype (Friendly, Peeker, Scaredy, Grumpy) sets the trait dials
  `curiosity`, `boldness`, `energy` (+ seeded variation); dealt without replacement.
- **Emotion** (`emotion.ts`) — utility scores from perception × traits → smoothed levels → dominant emotion with
  hysteresis; fear is a reflex (judged on target scores).
- **Mind** (the seam, `mind.ts`) — `interface Mind { think(creature, world, dt) }` writes emotion + intent.
  `ruleMind` runs every step. A future LLM mind sits *above* it (layered): slow high-level goals, while ruleMind
  keeps the reflexes.
- **Interaction** (`interaction.ts`, task #20) — boop and grab-and-drag. Hit-testing uses body proportions the
  simulation owns (`BODY`): a head ellipse, then a tentacle zone below it (the renderer's exact shapes are off-limits
  to the simulation). A press becomes a **boop** (released quickly, barely moved) or a **hold**. Holding is a layer
  *above* the mind (ADR 0004's layering, first real use): intent becomes `held` while emotions keep updating;
  perception treats being held as full attention + pressure, so the existing archetype grid decides the feelings
  (Friendly curious, Peeker/Scaredy scared, Grumpy grumpy). Movement for `held` = a damped spring pulling the *grab
  point* toward the hand **plus a pull offset**: rhythmic yanks in a slowly drifting direction (stateless — a function
  of time), scaled by fear/grumpiness beyond a calm dead zone × energy, eased by curiosity (so a Friendly just
  wiggles); plus a sideways wriggle. A tether caps the lag, and a top speed (`maxHeldSpeed`) turns catch-ups into a
  fast zoom instead of a teleport.
  Constraints still win: a creature in the way can only be shoved at `CONSTRAINTS.shoveSpeed`; the rest of the
  overlap blocks the held creature (so it moves at cursor speed when the way is clear, and no faster than the
  obstacle can get out of the way when it isn't). Sound
  *events* (grab, squeak, boop, ink) are recorded as data and voiced by the audio layer.
- **Shake → ink** (task #21) — while held, the hand's *speed jolts* (how sharply its speed changes; smoothed twice,
  so mouse-event jitter doesn't count, and steady-speed swirls and sweeps score ~0) above a threshold fill a **leaky
  bucket** of stress, capped in fill rate so only *sustained* shaking counts. The limit: base + boldness +
  boldness × curiosity (normal trackpad shake: Scaredy ≈ 1 s, Peeker 1.4 s, Grumpy 1.9 s; the Friendly ≈ 3 s). Near it: a warning
  tell (tremble, darker flush, faster squeaks). Past it: ink (`ink.ts`, a second pooled particle system with analytic
  motion, aimed toward the hand like a smoke screen), the hold ends, a short jet escape (briefly above the normal speed limit), and `perception.rattled = 1`, which
  fades over ~30 s, caps trust at 1 − rattled and dampens curiosity — so even a Friendly keeps its distance for a while.
- **Treasure chest, props & feeding** (task #28) — the chest sits on the sand in the bottom-left corner (`props.ts`:
  fixed px, so an invisible accessible `<button>` — `ChestToggle.vue` — lines up exactly over the canvas drawing and
  calls `toggleChest` at the input boundary). Open, its items float in slots above it; a press on a slot (checked
  before creatures) *carries* the item; released over the water it becomes a **prop** — plain data that sinks with a
  drift and rests on the sand (at most 3 shrimp). Feeding (`feeding.ts`) is a layer in the mind, only when calm:
  by trait dials the Friendly races, the Peeker sneaks in while the hand is away, the Scaredy waits for the hand to
  leave, the Grumpy guards (others keep off) then eats — new intents `eat`, `guard`. Eating: ♥, squish, "nom".
- **Dress-up & chest pages** (task #30) — the chest shows 3 items per page plus ‹ › arrows (`CHEST_PAGES`, wrapping;
  pressable page dots jump straight to a page — task #34), so the inventory can grow without the arc growing. 18 wearables (incl. glowing rave gear), one per spot
  (head / eyes / face; the nose glasses and the clown nose take eyes + face): dropped on a creature they're worn (`creature.dress`, plain data), swapping out
  whatever filled the spot; pressed on a creature they come off (press order: circles → worn items → toys →
  creatures). The renderer draws them inside `drawCreature`'s local frame, so they follow every pose for free. Only
  the Grumpy minds (bold + incurious): it shakes one item off every few seconds (`stepWearables`). Fallen items sink and
  can be picked up again (`itemAt`); after 5 s on the sand they blink for 3 s, then return to the chest. At most 3 of
  each are out.
- **Party** (task #32, in steps a–d) — the disco ball is one more chest item; let go in the water it floats slowly up
  to just below the surface and hangs there spinning. While it's out, `world.party` is on: one **beat clock**
  (`beatsAt`, `PARTY.bpm`) that the lights, the music (32b), the neon reef (32c) and the dancing (32d) all read, so
  they stay in sync, and a fade `level`. The lights are render-only (`render/party.ts`): a dimming layer, sweeping
  beams and mirror-ball spots drawn additively (`'lighter'`), with a light-safe twinkle (smooth, < 3 per second,
  tested); reduced motion holds them still.
- **Held items** (task #33) — two more spots: `hand` (glow stick, cutlass, soda can, magic wand, balloon,
  rose, trident) and `cuffs` (kandi), so cuffs + a held item combine. A tentacle tip only exists in the renderer, so
  `drawTentacles` now returns every curve: the holding tentacle is bent into a raised arm and the item is drawn at its
  tip, rotated to the curve's tangent (the balloon floats straight up on its string); kandi beads are drawn across a
  few curves. The simulation estimates the raised tip (`HAND`) for hit-testing. A let-go balloon floats up off
  the screen (and is back in the chest). Calm creatures **pick up dropped items** by the same trait dials as food
  (`chooseCollect`, a mind layer after food and play): bold + curious goes straight for it, timid + curious waits for the
  hand to move away, timid + incurious only when nobody's around; the Grumpy never — and only into a free spot.
- **Toys** (task #29) — the duck and the ball are props with real (simple) physics: the duck has neutral buoyancy
  (stays at its depth); the ball sinks, bounces with restitution, rolls with friction and pops up when hit; both
  spin, stay in the pool, and a gentle current near the walls eases them out of corners,
  and each exists once (draggable from the water back to the chest; press order slots → toys → creatures). Pushing
  isn't scripted: after constraints, `resolveToyContacts` (`play.ts`) pushes any toy a creature's body touches (with
  the creature's speed + a kick; the duck squeaks). Play is a mind layer after food (intent `play`), by trait dials:
  the Friendly plays *fetch* toward the hand (steering to a point behind the toy, then through it — "kick from
  behind"), the Peeker nudges and backs off, the Grumpy swats toys that come close (a swatted ball flies), the Scaredy plays shyly only when nobody's
  watching (otherwise keeps away).
- **Ink reactions by personality** (task #27) — trait-defined, like everything else. Scaredy/Peeker: ink and flee (above).
  A bold, incurious creature (`standsItsGround`: the Grumpy) gets mad: it recoils, then *chases* the hand for ~4 s
  (intent `chase`, *pursuit with velocity matching* — `chaseForce`: the hand's velocity + a closing speed
  proportional to the gap, capped at ~650 px/s — so walking away fails, dodging works, and it settles just short of
  a still hand) and squirts a small aimed puff whenever the hand
  is within range, at most every 0.5 s; then it glares (being rattled keeps its grumpiness up — `EMOTION.grudge`).
  A bold, curious creature (`forgives`: the Friendly) only hiccups a tiny puff, is *dizzy* for ~3 s (intent `dizzy`:
  loops from a rotating target velocity; spiral eyes, stars, wobble in the renderer), then forgives with a ♥ —
  barely rattled, trust kept. `interactionIntent` is the single override above the mind: held > chase > dizzy.
  Rendering: above normal swimming speed (a chase, a jet escape) a creature *jet swims* — it turns head first
  (`swimAngle`), its tentacles bundle and stream behind, and it pulses in jet strokes (`propulsion`, `JET`).
  Within inking range a chasing Grumpy instead *turns and fires*: it points its tentacles at the hand (`aimAtHand`,
  a function of distance, so it never flips between squirts), keeps its jet strokes going with the tentacles fitted to
  end just short of the cursor, squirts from the tentacle tips, and is drawn in front of the ink (charging out of it).
- **Intent** — `wander`, `rest`, `approach`, `peek`, `flee`, `hide`, `standoff`, plus the interaction overrides `held`,
  `chase`, `dizzy`; `movement.ts` maps each to
  steering (wander, arrive, flee, brake) with a personal speed limit (energy × intent).
- **Steering** (`steering.ts`) — Reynolds steering behaviors as pure functions returning desired forces:
  `wander`, `stayInBounds`, `separate` (later: seek, flee, arrive). `movement.ts` blends them with weights, applies
  exponential water drag and a speed limit, and runs the wander/rest `activity` (becomes part of the mind in task #8).
- **Constraints** (`constraints.ts`) — after integration, a position-based pass separates overlapping footprints
  and clamps footprints into bounds. Steering makes motion natural; constraints guarantee the rules.
- **Expression** (`expression.ts`) — what a creature *shows*: gaze (dart-and-hold toward the visitor, travel
  direction, or a glanced-at neighbour), emote events (? ! 💢 ♥, ~1.5 s, per-creature cooldown) and mood-scaled
  breathing/sway rates. The renderer maps emotion levels continuously to body language (puff, red flush, bristling
  fur, wide eyes, glaring lids, blush); `render/emotes.ts` draws vector emote bubbles.
- **Debug overlay** — `D` toggles it in dev; `?debug` enables it in any build. Canvas layer: `render/debugDraw.ts`.
  Vue layer: `DebugPanel.vue` (display-only) fed by `createDebugSnapshot` — a plain copy published at ≤ 5 Hz into a
  `shallowRef`, so Vue never tracks simulation objects. `fpsMeter.ts` reports FPS and per-frame work time (the
  `frame` hook in `gameLoop.ts`). Zero cost while hidden.
- **Audio** (`src/audio/`) — an output layer that observes the world: `createEmoteWatcher` turns new emotes and
  interaction sound events into sounds (ink itself is silent — owner decision in task #27: the creatures' own voices carry it); `chirpFor` (pure) designs each creature's voice (pentatonic pitch from size, timbre from archetype, contour
  from emote); `synth.ts` plays it (oscillator → low-pass → envelope → stereo pan → quiet master, ≤ 4 voices). Muted by
  default; the AudioContext is created only on the unmute click (browser autoplay policy).
- **Scene & motion** — `render/background.ts` draws water, drifting caustics and floating motes (a pure function of
  time — no particle state) and a vignette. Reduced motion (`app/reducedMotion.ts`, live `matchMedia` watcher) passes
  `MotionSettings` (`render/motion.ts`) to the renderer: decorative sway/breath/lean/trail are toned down, emotes fade in
  without overshoot, the background holds still; wandering and reactions are unchanged.
- **Sea floor** (`scenery.ts`, `render/floor.ts`) — `swimBounds(world)` is the single source of truth for the
  swimmable area (window minus the sand, plus a small allowance so tentacles rest on it); spawning, steering,
  constraints and hiding all use it. Scenery (rocks, shells, seaweed) is plain data with relative positions from an
  independent seeded stream (it never shifts the creatures' random draws), ready for future interaction.
- **Bubbles** (`bubbles.ts`, `render/bubbles.ts`) — a particle system: a fixed 64-slot ring-buffer pool of spawn
  records (no per-frame allocation), analytic closed-form motion (`bubbleAt`), spawned when a creature's intent becomes
  flee/hide (burst), while it keeps darting (trickle), or on entering standoff (Grumpy huff); own random stream.
- **UI shell** — Vue overlays: `DebugPanel`, `MuteToggle` (bottom-right), `ChestToggle` (over the drawn chest),
  `FirstVisitHint` (fades out on first interaction).
- **Step order** — presence (incl. press/release edges) → interaction (boop / hold / carry) → props → perception → mind (emotion, intent) → expression → steering → velocity → position (semi-implicit Euler) → tether → constraints → toy contacts → bubbles → ink → animation.

## Game loop
Fixed timestep (e.g. 60 Hz) with an accumulator, so behavior is deterministic and testable regardless of
frame rate. Rendering interpolates between the last two states for smoothness.

## Testing strategy
- Unit-test simulation with a seeded RNG and fixed `dt` (Vitest, Node environment).
- Rendering is checked visually and through the debug overlay; no pixel tests in the MVP.
