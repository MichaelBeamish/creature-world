# Architecture Overview

## Layers
```
src/
  simulation/   pure TS: world, creatures, traits, perception, minds, steering, rng   (no DOM, no Vue)
  render/       Canvas 2D: scene background, procedural creature drawing, emotes, debug draw
  input/        DOM pointer events → world "presence" (cursor position, velocity, active)
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
- **Intent** — `wander`, `rest`, `approach`, `peek`, `flee`, `hide`, `standoff`; `movement.ts` maps each to
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
- **Step order** — presence → perception → mind (emotion, intent) → expression → steering → velocity → position (semi-implicit Euler) → constraints → animation.

## Game loop
Fixed timestep (e.g. 60 Hz) with an accumulator, so behavior is deterministic and testable regardless of
frame rate. Rendering interpolates between the last two states for smoothness.

## Testing strategy
- Unit-test simulation with a seeded RNG and fixed `dt` (Vitest, Node environment).
- Rendering is checked visually and through the debug overlay; no pixel tests in the MVP.
