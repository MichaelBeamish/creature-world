# 0004 — Personality archetypes, utility-scored emotions, layered mind

- **Status:** Accepted
- **Date:** 2026-11-20

## Context
The owner wants creatures to react differently — curious, scared, grumpy — depending on personality and on what the
visitor does (calm presence, sudden movement, chasing). Behavior must stay deterministic and testable, readable to a
visitor within seconds, and leave room for a future LLM-driven mind.

## Decision
- **Personality = archetype on trait dials.** Every creature has `curiosity`, `boldness`, `energy`. An archetype from
  the curiosity × boldness grid (Friendly, Peeker, Scaredy, Grumpy) sets the dials, ± small seeded variation.
  Archetypes are dealt without replacement, so every world has a mix.
- **Emotions are utility-scored.** Each emotion gets a 0..1 score from perception × traits (e.g. scared =
  disturbance × (1 − boldness) + a universal flinch). Levels follow scores with an attack/release envelope; the
  dominant emotion switches with **hysteresis** (margin + minimum hold). **Fear is a reflex**, judged on the target
  scores so it fires within one step.
- **Emotion → intent → steering.** content → wander/rest; curious → approach (bold) or peek (timid); scared → flee,
  or hide when very scared and timid; grumpy → stand-off. Intents map to Reynolds seek/arrive/flee/brake.
- **`Mind` interface; `ruleMind` implements it.** A future LLM mind sits *above* ruleMind (layered / subsumption):
  it would propose slow, high-level goals while ruleMind keeps the fast reflexes every tick.

## Consequences
- ➕ Personality is just numbers: new archetypes or traits don't need new transition code.
- ➕ Table-driven tests can pin down the whole grid (archetype × stimulus → emotion).
- ➕ Readable personalities; guaranteed variety per world.
- ➖ Behavior depends on tuned constants (baselines, margins, wariness); tuning is by feel + scenario tests.
- ➖ Utility scoring is less explicit than a hand-written state machine; the debug view (`?debug`) shows
  archetype · emotion → intent to compensate.
- Alternatives considered: a hand-written FSM per archetype (explicit, but grows with every state pair);
  behavior trees (powerful, overkill for 4 emotions). **Revisit** if moods/needs (roadmap #3, #7) make scoring unwieldy.
