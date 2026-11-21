import { createCreature, GOLDEN_ANGLE, type Creature } from './creature'
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
  return { width: config.width, height: config.height, time: 0, tick: 0, rng, creatures }
}

/** Advance the world by exactly one fixed step of `dt` seconds. Mutates in place. */
export function stepWorld(world: World, dt: number): void {
  for (const creature of world.creatures) {
    copyVec2(creature.prevPosition, creature.position)
    addScaled(creature.position, creature.velocity, dt) // explicit Euler integration
  }
  world.time += dt
  world.tick++
}

/** Update the world bounds (e.g. after a window resize). Keeping creatures inside is task #6. */
export function resizeWorld(world: World, width: number, height: number): void {
  world.width = width
  world.height = height
}
