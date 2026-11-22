/**
 * The bridge between the 60 FPS world and Vue's reactive UI.
 *
 * A few times per second (not every frame), the app copies just the numbers the debug panel needs
 * into a fresh plain object and hands it to Vue via a `shallowRef`. Vue only tracks "the snapshot was
 * replaced" — it never proxies or watches the simulation itself (ADR 0001).
 */
import type { EmotionKind } from '../simulation/emotion'
import type { IntentKind } from '../simulation/mindState'
import type { Stimulus } from '../simulation/perception'
import type { Archetype } from '../simulation/traits'
import type { World } from '../simulation/world'
import type { FrameStats } from './fpsMeter'

export interface CreatureSnapshot {
  id: number
  hue: number
  archetype: Archetype
  emotion: EmotionKind
  intent: IntentKind
  stimulus: Stimulus
  curiosity: number
  boldness: number
  energy: number
  attention: number
  trust: number
  /** After inking (task #21): fades over ~30 s; caps trust. */
  rattled: number
}

export interface DebugSnapshot {
  seed: number
  tick: number
  frame: FrameStats
  creatures: CreatureSnapshot[]
}

/** A plain, independent copy: later changes to the world don't affect it. */
export function createDebugSnapshot(world: World, seed: number, frame: FrameStats): DebugSnapshot {
  return {
    seed,
    tick: world.tick,
    frame: { ...frame },
    creatures: world.creatures.map((c) => ({
      id: c.id,
      hue: c.hue,
      archetype: c.archetype,
      emotion: c.mind.emotion.kind,
      intent: c.mind.intent,
      stimulus: c.perception.stimulus,
      curiosity: c.traits.curiosity,
      boldness: c.traits.boldness,
      energy: c.traits.energy,
      attention: c.perception.attention,
      trust: c.perception.trust,
      rattled: c.perception.rattled,
    })),
  }
}

/** Throttle: returns true at most once per `intervalMs` (e.g. 200 ms → ≤ 5 updates per second). */
export function createPublisher(intervalMs: number): (now: number) => boolean {
  let last = -Infinity
  return (now) => {
    if (now - last < intervalMs) return false
    last = now
    return true
  }
}
