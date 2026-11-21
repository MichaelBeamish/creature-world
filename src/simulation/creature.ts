import { int, range, type Rng } from './rng'
import { vec2, type Vec2 } from './vec2'

export interface Bounds {
  width: number
  height: number
}

/**
 * A creature as plain, serializable data. Behavior lives in functions elsewhere.
 * Traits, perception, and mind are added in later backlog tasks.
 */
export interface Creature {
  id: number
  /** Center position in world units (CSS pixels). */
  position: Vec2
  /** Position at the previous step — lets the renderer interpolate. */
  prevPosition: Vec2
  /** Units per second. */
  velocity: Vec2
  /** Body color hue in degrees [0, 360). */
  hue: number
  /** Body radius in world units. */
  size: number
  tentacleCount: number
}

export const CREATURE_LIMITS = {
  minSize: 28,
  maxSize: 48,
  minTentacles: 5,
  maxTentacles: 8,
  /** Keep spawns this far from the edges (shrinks on tiny worlds). */
  spawnMargin: 80,
} as const

/** Spawn a creature at rest, with seeded random position and appearance. */
export function createCreature(rng: Rng, id: number, bounds: Bounds): Creature {
  const marginX = Math.min(CREATURE_LIMITS.spawnMargin, bounds.width / 2)
  const marginY = Math.min(CREATURE_LIMITS.spawnMargin, bounds.height / 2)
  const x = range(rng, marginX, bounds.width - marginX)
  const y = range(rng, marginY, bounds.height - marginY)

  return {
    id,
    position: vec2(x, y),
    prevPosition: vec2(x, y),
    velocity: vec2(0, 0),
    hue: range(rng, 0, 360),
    size: range(rng, CREATURE_LIMITS.minSize, CREATURE_LIMITS.maxSize),
    tentacleCount: int(rng, CREATURE_LIMITS.minTentacles, CREATURE_LIMITS.maxTentacles),
  }
}
