import { stepAnimation } from './animation'
import { resolveConstraints } from './constraints'
import { createCreature, GOLDEN_ANGLE, type Creature } from './creature'
import { stepActivity, stepMovement } from './movement'
import { stepPerception } from './perception'
import { createPresence, updatePresence, type Presence } from './presence'
import { createRng, range, type Rng } from './rng'
import { addScaled, copyVec2 } from './vec2'

/** The whole simulation state: plain data, so it can be compared, cloned, and snapshotted. */
export interface World {
  /** World size in CSS pixels (matches the canvas). */
  width: number
  height: number
  /** Simulated seconds elapsed. */
  time: number
  /** Number of fixed steps taken. */
  tick: number
  rng: Rng
  creatures: Creature[]
  /** The visitor (cursor/finger). Fed by the app via `setPresenceInput(world.presence, …)`. */
  presence: Presence
}

export interface WorldConfig {
  seed: number
  width: number
  height: number
  creatureCount: number
}

export function createWorld(config: WorldConfig): World {
  const rng = createRng(config.seed)
  const bounds = { width: config.width, height: config.height }
  const baseHue = range(rng, 0, 360)
  const creatures: Creature[] = []
  for (let i = 0; i < config.creatureCount; i++) {
    const hue = baseHue + i * GOLDEN_ANGLE
    creatures.push(createCreature(rng, i + 1, bounds, hue, creatures))
  }
  return {
    width: config.width,
    height: config.height,
    time: 0,
    tick: 0,
    rng,
    creatures,
    presence: createPresence(),
  }
}

/**
 * Advance the world by exactly one fixed step of `dt` seconds. Mutates in place.
 * Order matters (and is fixed, for determinism):
 * presence → perception → activity → steering → velocity → position → constraints → animation.
 */
export function stepWorld(world: World, dt: number): void {
  updatePresence(world.presence, dt)
  for (const creature of world.creatures) {
    copyVec2(creature.prevPosition, creature.position)
    stepPerception(creature.perception, creature.position, world.presence, dt)
    stepActivity(creature, dt, world.rng)
    stepMovement(creature, world, dt)
  }
  for (const creature of world.creatures) {
    // Semi-implicit (symplectic) Euler: velocity was updated first, position uses the new velocity.
    // More stable than explicit Euler for steering/springs, at the same cost.
    addScaled(creature.position, creature.velocity, dt)
  }
  resolveConstraints(world)
  for (const creature of world.creatures) {
    stepAnimation(creature.anim, dt, world.rng)
  }
  world.time += dt
  world.tick++
}

/** Update the world bounds (e.g. after a window resize). The next step's constraints pull everyone inside. */
export function resizeWorld(world: World, width: number, height: number): void {
  world.width = width
  world.height = height
}
