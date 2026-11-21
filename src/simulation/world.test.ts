import { describe, expect, it } from 'vitest'
import { CREATURE_LIMITS, footprint, footprintsOverlap } from './creature'
import { createRng, range } from './rng'
import { createWorld, resizeWorld, stepWorld, type World, type WorldConfig } from './world'

const DT = 1 / 60
const CONFIG: WorldConfig = { seed: 1234, width: 1280, height: 720, creatureCount: 5 }

/** Give creatures seeded velocities so stepping actually moves them (wandering arrives in task #6). */
function pushCreatures(world: World, seed: number) {
  const rng = createRng(seed)
  for (const c of world.creatures) {
    c.velocity.x = range(rng, -100, 100)
    c.velocity.y = range(rng, -100, 100)
  }
}

describe('createWorld', () => {
  it('creates identical worlds from the same config', () => {
    expect(createWorld(CONFIG)).toEqual(createWorld(CONFIG))
  })

  it('creates different worlds from different seeds', () => {
    expect(createWorld(CONFIG)).not.toEqual(createWorld({ ...CONFIG, seed: 4321 }))
  })

  it('spawns the requested number of creatures with unique ids', () => {
    const ids = createWorld(CONFIG).creatures.map((c) => c.id)
    expect(ids).toHaveLength(5)
    expect(new Set(ids).size).toBe(5)
  })

  it('spawns creatures at rest, with their whole footprint inside the bounds and appearance in range', () => {
    const world = createWorld({ ...CONFIG, creatureCount: 200 })
    for (const c of world.creatures) {
      const f = footprint(c.position, c.size)
      expect(f.x - f.radius).toBeGreaterThanOrEqual(0)
      expect(f.x + f.radius).toBeLessThanOrEqual(CONFIG.width)
      expect(f.y - f.radius).toBeGreaterThanOrEqual(0)
      expect(f.y + f.radius).toBeLessThanOrEqual(CONFIG.height)
      expect(c.prevPosition).toEqual(c.position)
      expect(c.velocity).toEqual({ x: 0, y: 0 })
      expect(c.hue).toBeGreaterThanOrEqual(0)
      expect(c.hue).toBeLessThan(360)
      expect(c.size).toBeGreaterThanOrEqual(CREATURE_LIMITS.minSize)
      expect(c.size).toBeLessThan(CREATURE_LIMITS.maxSize)
      expect(c.tentacleCount).toBeGreaterThanOrEqual(CREATURE_LIMITS.minTentacles)
      expect(c.tentacleCount).toBeLessThanOrEqual(CREATURE_LIMITS.maxTentacles)
    }
  })

  it('falls back to the center of a world too small for a creature', () => {
    const world = createWorld({ ...CONFIG, width: 50, height: 40 })
    for (const c of world.creatures) {
      const f = footprint(c.position, c.size)
      expect([f.x, f.y]).toEqual([25, 20])
    }
  })

  it('spawns creatures whose footprints do not overlap (several seeds)', () => {
    for (const seed of [1, 2, 3, 42, 1234, 99999]) {
      const { creatures } = createWorld({ ...CONFIG, seed })
      for (let i = 0; i < creatures.length; i++) {
        for (let j = i + 1; j < creatures.length; j++) {
          const a = creatures[i]!
          const b = creatures[j]!
          expect(
            footprintsOverlap(footprint(a.position, a.size), footprint(b.position, b.size)),
          ).toBe(false)
        }
      }
    }
  })

  it('spaces hues at least 30° apart around the color wheel', () => {
    for (const seed of [1, 7, 1234]) {
      const hues = createWorld({ ...CONFIG, seed }).creatures.map((c) => c.hue)
      for (let i = 0; i < hues.length; i++) {
        for (let j = i + 1; j < hues.length; j++) {
          const d = Math.abs(hues[i]! - hues[j]!)
          expect(Math.min(d, 360 - d)).toBeGreaterThanOrEqual(30)
        }
      }
    }
  })
})

describe('stepWorld', () => {
  it('is deterministic: same seed → identical state after 600 steps', () => {
    const a = createWorld(CONFIG)
    const b = createWorld(CONFIG)
    pushCreatures(a, 9)
    pushCreatures(b, 9)
    for (let i = 0; i < 600; i++) {
      stepWorld(a, DT)
      stepWorld(b, DT)
    }
    expect(a).toEqual(b)
    expect(a.tick).toBe(600)
    expect(a.time).toBeCloseTo(10, 9)
  })

  it('stores the pre-step position in prevPosition and moves by the updated velocity × dt', () => {
    // A single creature in open water: no walls or neighbours, so constraints don't intervene.
    const world = createWorld({ ...CONFIG, creatureCount: 1 })
    const c = world.creatures[0]!
    c.position.x = CONFIG.width / 2
    c.position.y = CONFIG.height / 2 - 40
    c.velocity.x = 20
    c.velocity.y = -10
    const before = { ...c.position }
    stepWorld(world, DT)
    expect(c.prevPosition).toEqual(before)
    // Steering updates velocity first; position then integrates the *new* velocity (semi-implicit Euler).
    expect(c.position.x).toBeCloseTo(before.x + c.velocity.x * DT, 9)
    expect(c.position.y).toBeCloseTo(before.y + c.velocity.y * DT, 9)
  })
})

describe('resizeWorld', () => {
  it('updates the world bounds', () => {
    const world = createWorld(CONFIG)
    resizeWorld(world, 800, 600)
    expect([world.width, world.height]).toEqual([800, 600])
  })
})
