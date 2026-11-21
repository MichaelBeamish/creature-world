/**
 * Per-creature movement for one fixed step: the mind's intent becomes blended steering forces,
 * plus water drag and a personal speed limit. Position integration and constraints happen in `stepWorld`.
 */
import type { Creature } from './creature'
import type { IntentKind } from './mindState'
import { MIND } from './mind'
import { PERCEPTION } from './perception'
import { swimBounds } from './scenery'
import { arrive, brake, flee, separate, stayInBounds, wander } from './steering'
import { addScaled, limitLength, vec2 } from './vec2'
import type { World } from './world'

export const MOVEMENT = {
  /** Base cozy top speed (px/s); scaled per creature by energy and by intent. */
  baseSpeed: 35,
  /** Cap on the wander force (px/s²) — keeps idle turns gentle. */
  maxWanderForce: 25,
  /** Cap on purposeful forces (approach, flee, …) — snappier than wandering. */
  maxIntentForce: 90,
  /** Strength of the edge and separation pushes (px/s²) before weighting. */
  boundsStrength: 60,
  separationStrength: 60,
  /** Blend weights. Avoiding walls and each other still matters most. */
  weights: { wander: 1, intent: 2.5, bounds: 2, separation: 2.5 },
  /** Exponential water drag (per second); much stronger while resting or holding ground. */
  drag: 0.4,
  restDrag: 3,
  /** An approaching creature hovers this far from the cursor (px), slowing within `slowRadius`. */
  approachDistance: 75,
  slowRadius: 120,
  /** Fleeing stops once this far from the visitor (px). */
  safeDistance: PERCEPTION.radius + 40,
} as const

/** Speed multiplier per intent: a scared octopus darts, a curious one is eager. */
export const INTENT_SPEED: Record<IntentKind, number> = {
  wander: 1,
  rest: 1,
  approach: 1.3,
  peek: 1.5,
  flee: 2.5,
  hide: 2.5,
  standoff: 1,
}

/** This creature's top speed right now: base × energy (0.88–1.24) × intent. */
export function speedLimit(creature: Creature): number {
  const energyFactor = 0.7 + 0.6 * creature.traits.energy
  return MOVEMENT.baseSpeed * energyFactor * INTENT_SPEED[creature.mind.intent]
}

// Scratch vectors reused every step (no per-frame allocations).
const intentForce = vec2()
const boundsForce = vec2()
const separationForce = vec2()

/** Update the creature's velocity from its intent, avoidance forces, drag, and its speed limit. */
export function stepMovement(creature: Creature, world: World, dt: number): void {
  const { weights } = MOVEMENT
  const intent = creature.mind.intent
  const limit = speedLimit(creature)
  const visitor = world.presence.position

  switch (intent) {
    case 'wander':
      wander(intentForce, creature, world.rng, dt, limit, MOVEMENT.maxWanderForce)
      addScaled(creature.velocity, intentForce, weights.wander * dt)
      break
    case 'rest':
      break
    case 'approach':
      arrive(
        intentForce,
        creature,
        visitor,
        MOVEMENT.approachDistance,
        MOVEMENT.slowRadius,
        limit,
        MOVEMENT.maxIntentForce,
      )
      addScaled(creature.velocity, intentForce, weights.intent * dt)
      break
    case 'peek':
      if (creature.mind.peekPhase === 'in') {
        arrive(
          intentForce,
          creature,
          visitor,
          MIND.peekNear - 20,
          MOVEMENT.slowRadius,
          limit,
          MOVEMENT.maxIntentForce,
        )
      } else {
        flee(intentForce, creature, visitor, MIND.peekFar + 20, limit, MOVEMENT.maxIntentForce)
      }
      addScaled(creature.velocity, intentForce, weights.intent * dt)
      break
    case 'flee':
      flee(intentForce, creature, visitor, MOVEMENT.safeDistance, limit, MOVEMENT.maxIntentForce)
      addScaled(creature.velocity, intentForce, weights.intent * dt)
      break
    case 'hide':
      arrive(
        intentForce,
        creature,
        creature.mind.hideTarget,
        0,
        MOVEMENT.slowRadius,
        limit,
        MOVEMENT.maxIntentForce,
      )
      addScaled(creature.velocity, intentForce, weights.intent * dt)
      break
    case 'standoff':
      brake(intentForce, creature, MOVEMENT.maxIntentForce)
      addScaled(creature.velocity, intentForce, weights.intent * dt)
      break
  }

  stayInBounds(boundsForce, creature, swimBounds(world), MOVEMENT.boundsStrength)
  addScaled(creature.velocity, boundsForce, weights.bounds * dt)
  separate(separationForce, creature, world.creatures, MOVEMENT.separationStrength)
  addScaled(creature.velocity, separationForce, weights.separation * dt)

  // Exponential drag: frame-rate independent (unlike `velocity *= 0.98` per step).
  const holding = intent === 'rest' || intent === 'standoff'
  const damping = Math.exp(-(holding ? MOVEMENT.restDrag : MOVEMENT.drag) * dt)
  creature.velocity.x *= damping
  creature.velocity.y *= damping
  limitLength(creature.velocity, limit)
}
