/**
 * Turns emote *state* into sound *events*: "this creature has a new emote since we last looked",
 * plus the interaction's sound events (grab, struggle squeaks, boop).
 * Audio is an output layer like the renderer — it observes the world and never changes it.
 */
import type { Creature } from '../simulation/creature'
import type { InteractionSoundKind } from '../simulation/interaction'
import type { World } from '../simulation/world'
import type { VoiceKind } from './voice'

export interface SoundEvent {
  creature: Creature
  /** A chirp, or the ink puff. */
  kind: VoiceKind | 'ink'
}

/** Returns a function that reports each emote and interaction sound exactly once (each is a new object). */
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
    for (const sound of world.interaction.sounds) {
      if (seen.has(sound)) continue
      seen.add(sound)
      const creature = world.creatures.find((c) => c.id === sound.creatureId)
      if (creature) events.push({ creature, kind: sound.kind satisfies InteractionSoundKind })
    }
    return events
  }
}
