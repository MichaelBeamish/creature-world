/**
 * Per-creature movement for one fixed step: activity (wander ↔ rest), blended steering forces,
 * water drag and a speed limit. Position integration and constraints happen in `stepWorld`.
 */
import type { Creature } from './creature'
import { range, type Rng } from './rng'
import { separate, stayInBounds, wander } from './steering'
import { addScaled, limitLength, vec2 } from './vec2'
import type { World } from './world'

export const MOVEMENT = {
  /** Cozy top speed (px/s). Personality (task #8) will vary this per creature. */
  maxSpeed: 35,
  /** Cap on the wander force (px/s²) — keeps turns gentle. */
  maxWanderForce: 25,
  /** Strength of the edge and separation pushes (px/s²) before weighting. */
  boundsStrength: 60,
  separationStrength: 60,
  /** Blend weights. Avoiding walls and each other matters more than wandering. */
  weights: { wander: 1, bounds: 2, separation: 2.5 },
  /** Exponential water drag (per second); much stronger while resting, so creatures glide to a stop. */
  drag: 0.4,
  restDrag: 3,
  /** Seconds spent in each activity. */
  wanderDuration: [6, 15],
  restDuration: [3, 8],
} as const

// Scratch vectors reused every step (no per-frame allocations).
const wanderForce = vec2()
const boundsForce = vec2()
const separationForce = vec2()

/** Count down the activity timer and switch between wandering and resting. */
export function stepActivity(creature: Creature, dt: number, rng: Rng): void {
  const activity = creature.activity
  activity.timer -= dt
  if (activity.timer > 0) return
  if (activity.kind === 'wander') {
    activity.kind = 'rest'
    activity.timer = range(rng, MOVEMENT.restDuration[0], MOVEMENT.restDuration[1])
  } else {
    activity.kind = 'wander'
    activity.timer = range(rng, MOVEMENT.wanderDuration[0], MOVEMENT.wanderDuration[1])
  }
}

/** Update the creature's velocity from blended steering forces, drag, and the speed limit. */
export function stepMovement(creature: Creature, world: World, dt: number): void {
  const { weights } = MOVEMENT
  const resting = creature.activity.kind === 'rest'

  if (!resting) {
    wander(wanderForce, creature, world.rng, dt, MOVEMENT.maxSpeed, MOVEMENT.maxWanderForce)
    addScaled(creature.velocity, wanderForce, weights.wander * dt)
  }
  stayInBounds(boundsForce, creature, world, MOVEMENT.boundsStrength)
  addScaled(creature.velocity, boundsForce, weights.bounds * dt)
  separate(separationForce, creature, world.creatures, MOVEMENT.separationStrength)
  addScaled(creature.velocity, separationForce, weights.separation * dt)

  // Exponential drag: frame-rate independent (unlike `velocity *= 0.98` per step).
  const damping = Math.exp(-(resting ? MOVEMENT.restDrag : MOVEMENT.drag) * dt)
  creature.velocity.x *= damping
  creature.velocity.y *= damping
  limitLength(creature.velocity, MOVEMENT.maxSpeed)
}
