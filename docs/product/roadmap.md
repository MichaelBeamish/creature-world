# Roadmap (post-MVP)

Ideas, not commitments. Each becomes a planned milestone only after discussion.

1. **Deploy & polish** — public hosting, README with GIF, performance pass.
2. **Social life** — greetings, follow-the-leader, play-chase, friendships between creatures.
3. **Richer moods** — mood that drifts over time (sleepy, playful, startled) and influences behavior.
4. **Expressive voice** — procedural creature "language" (pitch/rhythm chirps tied to mood).
5. **Conversation** — LLM-driven mind for a creature you click on; speech bubbles; needs a small backend proxy for API keys, rate limits, and safety.
6. **Memory** — creatures remember the visitor across sessions (local storage first).
7. **Ecosystem** — food, day/night, creatures that sleep, new creatures appearing.
8. **Mobile-first interactions** — touch gestures as first-class input.
9. **Direct interaction: pick up / drag, boop, shake** — the visitor can physically play with creatures.
   - Fits the architecture: input layer → events/state in simulation → renderer; animation stays a layer on top.
   - Drag: a "held" state follows the pointer; hit-testing uses the shared `BODY` proportions.
   - Boop: an event → velocity impulse, squash impulse, forced blink/emote; temporarily faster breathing/sway
     (phase accumulation keeps it smooth).
   - Shake: input measures drag speed/direction changes → a "dizzy" mind state.
   - Needs **secondary motion**: tentacles trail/dangle based on `velocity` with a small damped spring
     (follow-through), and a squash spring in `anim`.
   - Determinism holds for a given input-event sequence, so tests can feed synthetic input.
   - Note: shifts the vision from "noticed, not controlled" toward play — decide deliberately.
