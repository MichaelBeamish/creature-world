/**
 * Cheering up the Grumpy (task #38): give him the **rose** and he turns into a Friendly — in a way you can't miss.
 *
 *   0 – 2.5 s  sceptical: he freezes and eyes it, a suspicious tilt, a "?", still flushed red (he doesn't shake it off)
 * 2.5 – 3.5 s  perks up: the flush drains, a little hop and stretch, a "!"
 * 3.5 – 5.5 s  hearts: a burst of hearts (drawn by the renderer) — and he *becomes* a Friendly right here, so his
 *              heart chirp is already in the Friendly's voice.
 *
 * Afterwards he acts exactly like a Friendly: behavior comes from the trait dials, so switching them is enough. He
 * keeps his own color and energy (and the rose). The timing lives in world data (`creature.cheerUp`), so it's tested.
 */
import type { Creature } from './creature'
import { showEmote } from './expression'
import { ARCHETYPES } from './traits'
import type { World } from './world'

export const CHEER_UP = {
  /** Seconds of each phase: sceptical, perking up, hearts. */
  doubt: 2.5,
  perk: 1,
  hearts: 2,
  /** While sceptical he stays at least this flushed (0..1 of grumpy). */
  doubtFlush: 0.6,
  /** How fast the flush drains while he perks up (per second). */
  drain: 4,
} as const

export type CheerUpPhase = 'doubt' | 'perk' | 'hearts'

/** Start the moment (the rose just landed in a Grumpy's tentacle). */
export function startCheerUp(world: World, c: Creature): void {
  if (c.cheerUp) return
  c.cheerUp = { since: world.time, stage: 0 }
  c.dress.shakeAt = Infinity // he doesn't shake this off
  c.dress.shakingSince = -Infinity
}

/** Which phase of the moment a creature is in (null if none). */
export function cheerUpPhase(c: Creature, time: number): CheerUpPhase | null {
  if (!c.cheerUp) return null
  const t = time - c.cheerUp.since
  if (t < CHEER_UP.doubt) return 'doubt'
  if (t < CHEER_UP.doubt + CHEER_UP.perk) return 'perk'
  return 'hearts'
}

/** He's a Friendly now: the Friendly's dials (his own energy), no grudge, nothing to sulk about. */
function becomeFriendly(c: Creature): void {
  c.archetype = 'friendly'
  c.traits = { ...ARCHETYPES.friendly, energy: c.traits.energy }
  c.mind.emotion.levels.grumpy = 0
  c.mind.dance = null // a new dance style (bounce instead of sulk)
  c.dress.shakeAt = Infinity
}

/** Advance one fixed step: the emotes on cue, the flush, the switch, and the end of the moment. */
export function stepCheerUps(world: World, dt: number): void {
  for (const c of world.creatures) {
    const cheer = c.cheerUp
    if (!cheer) continue
    const t = world.time - cheer.since
    const levels = c.mind.emotion.levels
    if (cheer.stage === 0) {
      showEmote(c, 'question') // …a rose? for me?
      cheer.stage = 1
    }
    if (t < CHEER_UP.doubt) {
      levels.grumpy = Math.max(levels.grumpy, CHEER_UP.doubtFlush)
    } else if (t < CHEER_UP.doubt + CHEER_UP.perk) {
      if (cheer.stage === 1) {
        showEmote(c, 'exclaim')
        cheer.stage = 2
      }
      levels.grumpy *= Math.exp(-CHEER_UP.drain * dt)
    } else if (t < CHEER_UP.doubt + CHEER_UP.perk + CHEER_UP.hearts) {
      if (cheer.stage === 2) {
        becomeFriendly(c)
        showEmote(c, 'heart')
        cheer.stage = 3
      }
    } else {
      c.cheerUp = null // done: just a Friendly now
    }
  }
}
