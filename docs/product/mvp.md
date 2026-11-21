# MVP — "The Tide Pool"

**Goal:** a visitor opens the page and, within 10 seconds, a creature notices their cursor and reacts in a way that fits its personality.

## In scope
- **Scene:** one full-viewport, softly lit pool background.
- **Creatures:** 3–5, procedurally drawn (round furry body, eyes, 5–8 wobbly tentacles), each with its own color and size.
- **Idle life:** breathing (body scale pulse), blinking, tentacle sway, wandering, occasional resting.
- **Perception:** each creature has a perception radius and an attention value, and reads *how* the visitor behaves:
  - **calm presence** — cursor hovering still or moving slowly nearby (builds trust over time),
  - **sudden movement** — a fast flick nearby (startles),
  - **chasing** — the cursor keeps following one creature (pressure builds).
- **Personality = archetype on trait dials.** Every creature has the same dials — `curiosity` (do I want to get
  closer?), `boldness` (when startled: stand my ground or run?), `energy` (how quick/intense) — set by an
  **archetype** plus small seeded variation. Archetypes are dealt without replacement, so a world always has a mix:

  |  | **Timid** (low boldness) | **Bold** (high boldness) |
  |---|---|---|
  | **Curious** | **Peeker** — creeps closer, darts back when startled, returns | **Friendly** — comes right up, follows the cursor |
  | **Not curious** | **Scaredy** — keeps its distance, hides when startled | **Grumpy** — ignores you until bothered, then puffs up, flushes red, 💢 |

  Reactions: approach · follow · peek (approach then retreat) · flee · hide · grumpy stand-off.
  Emotions (curious, scared, grumpy, content) are temporary states; personality sets how likely and strong they are.
- **Expression:** eyes track the cursor; body squash/stretch with motion; emotes (`!`, `?`, `♥`, `💢`);
  grumpy puff-up + color flush; breathing/sway speed follows the emotion.
- **Sound (optional, muted by default):** soft chirps on notice/emote, with a mute toggle.
- **Social (minimal):** creatures don't overlap and occasionally glance at a nearby creature.
- **Debug overlay (dev only):** perception radii, current behavior state, trait values, FPS.
- **Mobile fallback:** a tap acts as a brief cursor presence. No further mobile tuning.

## Out of scope (see `roadmap.md`)
LLM conversation · persistence · needs/hunger/lifecycle · rich creature-to-creature play ·
multiple scenes · creature customization · backend · mobile optimization ·
clicking / booping / dragging creatures (roadmap #9).

## Success criteria
1. With the cursor still or absent, creatures visibly idle (breathe, blink, wander) for 60s without freezing, overlapping, or leaving the screen.
2. Moving the cursor within a creature's perception radius produces a visible reaction (eyes + emote or movement) within 1s.
3. Given the same cursor input and seed, a **Scaredy** ends farther from the cursor than a **Friendly** one, and a
   sudden movement makes a **Grumpy** stand its ground (grumpy emotion) while a **Scaredy** flees (unit tests).
4. Holds ~60 FPS with 5 creatures on a typical laptop (debug overlay FPS ≥ 55).
5. Simulation logic has unit tests; lint, type-check, and tests all pass.
6. A first-time viewer can describe at least two creatures as "different" without being told (informal check with 1–2 people).
