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
- **Creature** — id, position, prevPosition (for interpolation), velocity, appearance, `anim`; later traits,
  attention, current behavior, emote.
- **Animation** — `anim` (breath/sway oscillators, blink state machine) is simulation state stepped by
  `stepAnimation`, because behavior will modulate it. Oscillators accumulate phase (`phase += rate·dt`, wrapped),
  so changing a rate never makes motion jump. The renderer maps it to squash/stretch, eyelids, and tentacle sway.
- **Body proportions** — `BODY` in `creature.ts` (multiples of `size`) is shared by simulation (spawn
  footprint, later collisions) and rendering, so what you see matches the space a creature occupies.
- **Rendering** — `drawScene(ctx, world, alpha)` is a pure function of world state (painter's algorithm, back to
  front). Per-creature detail (fur, tentacle variation) comes from a stateless hash (`render/noise.ts`), never stored.
- **Seed** — random per visit; `?seed=<int>` reproduces a world (seed is logged to the console).
- **Perception** — what a creature currently notices (cursor, nearby creatures) given its radius.
- **Mind** (the seam) — `interface Mind { decide(creature, perception, rng): Intent }`.
  MVP uses `RuleMind` (state machine weighted by traits). A future `LlmMind` can implement the
  same interface asynchronously, producing intents and speech without touching rendering or steering.
- **Intent** — a high-level goal (`wander`, `approach`, `flee`, `hide`, `rest`, `emote`) that steering turns into motion.
- **Steering** — classic steering behaviors (seek, flee, arrive, wander, separation) plus screen bounds.

## Game loop
Fixed timestep (e.g. 60 Hz) with an accumulator, so behavior is deterministic and testable regardless of
frame rate. Rendering interpolates between the last two states for smoothness.

## Testing strategy
- Unit-test simulation with a seeded RNG and fixed `dt` (Vitest, Node environment).
- Rendering is checked visually and through the debug overlay; no pixel tests in the MVP.
