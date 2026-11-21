import { describe, expect, it } from 'vitest'
import { CREATURE_LIMITS } from './creature'
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

  it('spawns creatures at rest, inside the bounds, with appearance in range', () => {
    const world = createWorld({ ...CONFIG, creatureCount: 200 })
    const m = CREATURE_LIMITS.spawnMargin
    for (const c of world.creatures) {
      expect(c.position.x).toBeGreaterThanOrEqual(m)
      expect(c.position.x).toBeLessThanOrEqual(CONFIG.width - m)
      expect(c.position.y).toBeGreaterThanOrEqual(m)
      expect(c.position.y).toBeLessThanOrEqual(CONFIG.height - m)
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

  it('still spawns inside a world smaller than the spawn margin', () => {
    const world = createWorld({ ...CONFIG, width: 50, height: 40 })
    for (const c of world.creatures) {
      expect(c.position.x).toBeGreaterThanOrEqual(0)
      expect(c.position.x).toBeLessThanOrEqual(50)
      expect(c.position.y).toBeGreaterThanOrEqual(0)
      expect(c.position.y).toBeLessThanOrEqual(40)
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

  it('stores the pre-step position in prevPosition and moves by velocity × dt', () => {
    const world = createWorld(CONFIG)
    const c = world.creatures[0]!
    c.velocity.x = 60
    c.velocity.y = -30
    const before = { ...c.position }
    stepWorld(world, DT)
    expect(c.prevPosition).toEqual(before)
    expect(c.position.x).toBeCloseTo(before.x + 1, 9)
    expect(c.position.y).toBeCloseTo(before.y - 0.5, 9)
  })

  it('leaves creatures at rest when velocity is zero', () => {
    const world = createWorld(CONFIG)
    const start = structuredClone(world.creatures)
    for (let i = 0; i < 60; i++) stepWorld(world, DT)
    expect(world.creatures.map((c) => c.position)).toEqual(start.map((c) => c.position))
  })
})

describe('resizeWorld', () => {
  it('updates the world bounds', () => {
    const world = createWorld(CONFIG)
    resizeWorld(world, 800, 600)
    expect([world.width, world.height]).toEqual([800, 600])
  })
})
