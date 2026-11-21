/**
 * The mind: perception × personality → emotion → intent (what to do next).
 *
 * `Mind` is the seam for future minds. `ruleMind` is fast, deterministic and runs every step.
 * A future LLM-driven mind would sit *above* it (layered / subsumption architecture): an LLM is too
 * slow to steer every tick, so it would suggest high-level goals while ruleMind keeps the reflexes.
 */
import { footprint, type Creature } from './creature'
import { stepEmotion } from './emotion'
import { range, type Rng } from './rng'
import { swimBounds } from './scenery'
import type { World } from './world'

export interface Mind {
  /** Update `creature.mind` (emotion + intent) for one fixed step. */
  think(creature: Creature, world: World, dt: number): void
}

export const MIND = {
  /** Bold creatures (≥ this) approach when curious; timid ones peek instead. */
  boldThreshold: 0.5,
  /** Scared enough (fear level × timidity) to hide rather than just flee. */
  hideThreshold: 0.8,
  /** Peek: dart back when closer than `peekNear`, creep in again once farther than `peekFar` (px). */
  peekNear: 110,
  peekFar: 200,
  /** Seconds spent in each calm activity (the content rhythm). */
  wanderDuration: [6, 15],
  restDuration: [3, 8],
} as const

export const ruleMind: Mind = {
  think(creature, world, dt) {
    const mind = creature.mind
    const { perception, traits } = creature
    stepEmotion(mind.emotion, perception, traits, dt)
    stepActivity(creature, dt, world.rng) // the calm wander/rest rhythm keeps ticking underneath

    const previous = mind.intent
    switch (mind.emotion.kind) {
      case 'content':
        mind.intent = creature.activity.kind
        break
      case 'curious':
        mind.intent = traits.boldness >= MIND.boldThreshold ? 'approach' : 'peek'
        break
      case 'scared':
        mind.intent =
          (1 - traits.boldness) * mind.emotion.levels.scared >= MIND.hideThreshold ? 'hide' : 'flee'
        break
      case 'grumpy':
        mind.intent = 'standoff'
        break
    }

    if (mind.intent === 'peek') {
      if (previous !== 'peek') mind.peekPhase = 'in'
      else if (mind.peekPhase === 'in' && perception.distance < MIND.peekNear)
        mind.peekPhase = 'out'
      else if (mind.peekPhase === 'out' && perception.distance > MIND.peekFar) mind.peekPhase = 'in'
    }

    if (mind.intent === 'hide' && previous !== 'hide') {
      chooseHideTarget(creature, world)
    }
  },
}

/** The calm rhythm underneath every mood: count down and switch between wandering and resting. */
export function stepActivity(creature: Creature, dt: number, rng: Rng): void {
  const activity = creature.activity
  activity.timer -= dt
  if (activity.timer > 0) return
  if (activity.kind === 'wander') {
    activity.kind = 'rest'
    activity.timer = range(rng, MIND.restDuration[0], MIND.restDuration[1])
  } else {
    activity.kind = 'wander'
    activity.timer = range(rng, MIND.wanderDuration[0], MIND.wanderDuration[1])
  }
}

/** The world corner (inset so the creature fits) farthest from the visitor. */
function chooseHideTarget(creature: Creature, world: World): void {
  const f = footprint(creature.position, creature.size)
  const offsetY = f.y - creature.position.y
  const r = f.radius
  const from = world.presence.position
  let best = { x: r, y: r - offsetY }
  let bestDist = -1
  for (const fx of [r, world.width - r]) {
    for (const fy of [r, swimBounds(world).height - r]) {
      const d = Math.hypot(fx - from.x, fy - from.y)
      if (d > bestDist) {
        bestDist = d
        best = { x: fx, y: fy - offsetY }
      }
    }
  }
  creature.mind.hideTarget.x = best.x
  creature.mind.hideTarget.y = best.y
}
