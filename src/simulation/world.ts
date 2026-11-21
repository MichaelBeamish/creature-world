import { createCreature, type Creature } from './creature'
import { createRng, type Rng } from './rng'
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
  const creatures = Array.from({ length: config.creatureCount }, (_, i) =>
    createCreature(rng, i + 1, bounds),
  )
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
