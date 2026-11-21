/**
 * Turns emote *state* into sound *events*: "this creature has a new emote since we last looked".
 * Audio is an output layer like the renderer — it observes the world and never changes it.
 */
import type { Creature } from '../simulation/creature'
import type { EmoteKind } from '../simulation/expression'
import type { World } from '../simulation/world'

export interface SoundEvent {
  creature: Creature
  kind: EmoteKind
}

/** Returns a function that reports each emote exactly once (emote objects are new per emote). */
export function createEmoteWatcher(): (world: World) => SoundEvent[] {
  const seen = new WeakSet<object>()
  return (world) => {
    const events: SoundEvent[] = []
    for (const creature of world.creatures) {
      const emote = creature.expression.emote
      if (emote && !seen.has(emote)) {
        seen.add(emote)
        events.push({ creature, kind: emote.kind })
      }
    }
    return events
  }
}
