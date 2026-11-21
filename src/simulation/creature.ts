import { createAnimation, type CreatureAnimation } from './animation'
import { createPerception, type Perception } from './perception'
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
  /** Center of the mantle (head) in world units (CSS pixels). */
  position: Vec2
  /** Position at the previous step — lets the renderer interpolate. */
  prevPosition: Vec2
  /** Units per second. */
  velocity: Vec2
  /** Body color hue in degrees [0, 360). */
  hue: number
  /** Mantle half-width in world units; all body proportions scale with it. */
  size: number
  tentacleCount: number
  /** Idle-animation state (breathing, sway, blinking). */
  anim: CreatureAnimation
  /** Wander steering: angle of the target point on the wander circle (radians). */
  wanderAngle: number
  /** What the creature is doing right now, and for how many more seconds. */
  activity: Activity
  /** What it notices about the visitor (attention, stimulus, …). */
  perception: Perception
}

export interface Activity {
  kind: 'wander' | 'rest'
  /** Seconds left before switching activity. */
  timer: number
}

export const CREATURE_LIMITS = {
  minSize: 24,
  maxSize: 40,
  minTentacles: 5,
  maxTentacles: 8,
} as const

/**
 * Body proportions as multiples of `size`. Shared by simulation (spacing/collision)
 * and rendering, so what you see is what the simulation thinks it occupies.
 */
export const BODY = {
  /** Mantle half-height (it is taller than wide). */
  mantleHalfHeight: 1.27,
  /** Where tentacles attach, below the mantle center. */
  tentacleRootY: 0.75,
  /** Typical tentacle length. */
  tentacleLength: 2.9,
} as const

/** Golden angle in degrees: successive hues stay well spread around the color wheel. */
export const GOLDEN_ANGLE = 137.50776405003785

/** Space a creature needs, as a circle (covers mantle + tentacles). */
export interface Footprint {
  x: number
  y: number
  radius: number
}

const FOOTPRINT_OFFSET_Y = 1.2 // circle center sits below the mantle center
const FOOTPRINT_RADIUS = 2.4

export function footprint(position: Vec2, size: number): Footprint {
  return {
    x: position.x,
    y: position.y + size * FOOTPRINT_OFFSET_Y,
    radius: size * FOOTPRINT_RADIUS,
  }
}

export function footprintsOverlap(a: Footprint, b: Footprint): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < a.radius + b.radius
}

const MAX_SPAWN_ATTEMPTS = 30

/**
 * Spawn a creature at rest. Position uses rejection sampling: try random spots until one
 * doesn't overlap `others`; if none fits, keep the candidate with the most clearance.
 * Deterministic, because every draw comes from the seeded rng.
 */
export function createCreature(
  rng: Rng,
  id: number,
  bounds: Bounds,
  hue: number,
  others: readonly Creature[] = [],
): Creature {
  const size = range(rng, CREATURE_LIMITS.minSize, CREATURE_LIMITS.maxSize)
  const tentacleCount = int(rng, CREATURE_LIMITS.minTentacles, CREATURE_LIMITS.maxTentacles)

  let best = randomPosition(rng, bounds, size)
  let bestClearance = clearance(best, size, others)
  for (let attempt = 1; attempt < MAX_SPAWN_ATTEMPTS && bestClearance < 0; attempt++) {
    const candidate = randomPosition(rng, bounds, size)
    const c = clearance(candidate, size, others)
    if (c > bestClearance) {
      best = candidate
      bestClearance = c
    }
  }

  return {
    id,
    position: vec2(best.x, best.y),
    prevPosition: vec2(best.x, best.y),
    velocity: vec2(0, 0),
    hue: ((hue % 360) + 360) % 360,
    size,
    tentacleCount,
    anim: createAnimation(rng),
    wanderAngle: range(rng, 0, Math.PI * 2),
    // Start mid-way through a wander period so creatures don't all rest at the same moment.
    activity: { kind: 'wander', timer: range(rng, 2, 15) },
    perception: createPerception(),
  }
}

/** A position whose whole footprint fits inside the bounds (or the center, if it can't fit). */
function randomPosition(rng: Rng, bounds: Bounds, size: number): Vec2 {
  const r = size * FOOTPRINT_RADIUS
  const cx = r * 2 <= bounds.width ? range(rng, r, bounds.width - r) : bounds.width / 2
  const cy = r * 2 <= bounds.height ? range(rng, r, bounds.height - r) : bounds.height / 2
  return vec2(cx, cy - size * FOOTPRINT_OFFSET_Y)
}

/** Smallest gap to any other footprint (negative = overlapping). Infinity when alone. */
function clearance(position: Vec2, size: number, others: readonly Creature[]): number {
  const mine = footprint(position, size)
  let min = Infinity
  for (const other of others) {
    const theirs = footprint(other.position, other.size)
    min = Math.min(
      min,
      Math.hypot(mine.x - theirs.x, mine.y - theirs.y) - mine.radius - theirs.radius,
    )
  }
  return min
}
