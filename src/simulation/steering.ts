/**
 * Steering behaviors (Craig Reynolds, "Steering Behaviors For Autonomous Characters", 1999).
 *
 * Each behavior writes a *desired force* (an acceleration, px/s²) into `out` and returns it.
 * `movement.ts` blends them with weights. Keeping each behavior small and pure makes them
 * easy to test and to re-weight later (e.g. personality traits in task #8).
 */
import { footprint, type Bounds, type Creature } from './creature'
import { range, type Rng } from './rng'
import { limitLength, setVec2, type Vec2 } from './vec2'

export const STEERING = {
  /** Wander circle: how far ahead it is projected, and its radius (unitless; only the direction matters). */
  wanderDistance: 2,
  wanderRadius: 1,
  /** How fast the wander target drifts around the circle (radians per second, random walk). */
  wanderJitter: 3,
  /** Soft edge zone: inside this distance from an edge, a push back inward ramps up. */
  edgeMargin: 60,
  /** Extra personal space added to the footprints when separating (px). */
  personalSpace: 24,
} as const

/**
 * Wander: steer toward a target that drifts randomly along a circle projected ahead.
 * Small random nudges to the *target* (not the heading) give smooth, curious curves instead of jitter.
 * Mutates `creature.wanderAngle` (its wander state). Returns desiredVelocity − velocity, capped at `maxForce`.
 */
export function wander(
  out: Vec2,
  creature: Creature,
  rng: Rng,
  dt: number,
  maxSpeed: number,
  maxForce: number,
): Vec2 {
  creature.wanderAngle += range(rng, -1, 1) * STEERING.wanderJitter * dt

  // Heading: current direction of travel, or the wander angle itself when (nearly) still.
  const speed = Math.hypot(creature.velocity.x, creature.velocity.y)
  const hx = speed > 1 ? creature.velocity.x / speed : Math.cos(creature.wanderAngle)
  const hy = speed > 1 ? creature.velocity.y / speed : Math.sin(creature.wanderAngle)

  const tx = hx * STEERING.wanderDistance + Math.cos(creature.wanderAngle) * STEERING.wanderRadius
  const ty = hy * STEERING.wanderDistance + Math.sin(creature.wanderAngle) * STEERING.wanderRadius
  const len = Math.hypot(tx, ty) || 1

  // Reynolds' steering = desired velocity − current velocity.
  setVec2(
    out,
    (tx / len) * maxSpeed - creature.velocity.x,
    (ty / len) * maxSpeed - creature.velocity.y,
  )
  return limitLength(out, maxForce)
}

/**
 * Stay in bounds: a push back inward that ramps from 0 (at `edgeMargin` from an edge) to `strength`
 * (when the footprint touches the edge). Zero in the open middle of the pool.
 */
export function stayInBounds(
  out: Vec2,
  creature: Creature,
  bounds: Bounds,
  strength: number,
): Vec2 {
  const f = footprint(creature.position, creature.size)
  const m = STEERING.edgeMargin
  const ramp = (distanceToEdge: number) => Math.min(1, Math.max(0, 1 - distanceToEdge / m))

  const x = ramp(f.x - f.radius) - ramp(bounds.width - (f.x + f.radius))
  const y = ramp(f.y - f.radius) - ramp(bounds.height - (f.y + f.radius))
  return setVec2(out, x * strength, y * strength)
}

/**
 * Separation: push away from every creature whose footprint (plus personal space) is too close,
 * stronger the closer they are. Uses the same footprint as spawning, so spacing matches what you see.
 */
export function separate(
  out: Vec2,
  creature: Creature,
  others: readonly Creature[],
  strength: number,
): Vec2 {
  setVec2(out, 0, 0)
  const mine = footprint(creature.position, creature.size)
  for (const other of others) {
    if (other === creature) continue
    const theirs = footprint(other.position, other.size)
    const desired = mine.radius + theirs.radius + STEERING.personalSpace
    let dx = mine.x - theirs.x
    let dy = mine.y - theirs.y
    let dist = Math.hypot(dx, dy)
    if (dist >= desired) continue
    if (dist === 0) {
      // Exactly on top of each other: pick a deterministic direction from the ids.
      dx = creature.id < other.id ? -1 : 1
      dy = 0
      dist = 1
    }
    const push = (1 - dist / desired) * strength
    out.x += (dx / dist) * push
    out.y += (dy / dist) * push
  }
  return out
}

/**
 * Arrive: steer toward `target`, slowing down inside `slowRadius` and stopping `stopDistance` short of it
 * (so an approaching creature hovers at a comfortable distance instead of bumping into the cursor).
 */
export function arrive(
  out: Vec2,
  creature: Creature,
  target: Vec2,
  stopDistance: number,
  slowRadius: number,
  maxSpeed: number,
  maxForce: number,
): Vec2 {
  const dx = target.x - creature.position.x
  const dy = target.y - creature.position.y
  const dist = Math.hypot(dx, dy)
  const remaining = dist - stopDistance
  const desiredSpeed =
    remaining <= 0 || dist === 0 ? 0 : maxSpeed * Math.min(1, remaining / slowRadius)
  const nx = dist === 0 ? 0 : dx / dist
  const ny = dist === 0 ? 0 : dy / dist
  setVec2(out, nx * desiredSpeed - creature.velocity.x, ny * desiredSpeed - creature.velocity.y)
  return limitLength(out, maxForce)
}

/** Seek: full speed toward `target` (arrive with no slowing zone or stop distance). */
export function seek(
  out: Vec2,
  creature: Creature,
  target: Vec2,
  maxSpeed: number,
  maxForce: number,
): Vec2 {
  return arrive(out, creature, target, 0, 1e-9, maxSpeed, maxForce)
}

/**
 * Flee: full speed directly away from `from` while closer than `safeDistance`; no force once safe.
 * Exactly on top of the threat: flee upward (deterministic).
 */
export function flee(
  out: Vec2,
  creature: Creature,
  from: Vec2,
  safeDistance: number,
  maxSpeed: number,
  maxForce: number,
): Vec2 {
  const dx = creature.position.x - from.x
  const dy = creature.position.y - from.y
  const dist = Math.hypot(dx, dy)
  if (dist >= safeDistance) return setVec2(out, 0, 0)
  const nx = dist === 0 ? 0 : dx / dist
  const ny = dist === 0 ? -1 : dy / dist
  setVec2(out, nx * maxSpeed - creature.velocity.x, ny * maxSpeed - creature.velocity.y)
  return limitLength(out, maxForce)
}

/** Brake: steer toward zero velocity (a creature holding its ground). */
export function brake(out: Vec2, creature: Creature, maxForce: number): Vec2 {
  setVec2(out, -creature.velocity.x, -creature.velocity.y)
  return limitLength(out, maxForce)
}
