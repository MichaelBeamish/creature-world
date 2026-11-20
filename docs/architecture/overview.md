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
Tests sit next to the code they cover (`*.test.ts`). The simulation import boundary is enforced by ESLint
(`no-restricted-imports` in `eslint.config.js`).
Dependency direction: `app → render, input → simulation`. Simulation depends on nothing.

## Data flow (per frame)
```
pointer events ─► input ─► Presence ─┐
                                     ▼
fixed-step loop ─► world.step(dt) : perceive → think (mind) → steer → integrate
                                     ▼
                 renderer.draw(world, alpha)  (interpolates between steps)
                                     ▼
          throttled snapshot (~5 Hz) ─► Vue debug panel
```

## Key concepts
- **World** — owns creatures, presence, time, seeded RNG. `step(dt)` advances the simulation.
- **Creature** — position, velocity, traits, attention, current behavior, emote, animation phases.
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
