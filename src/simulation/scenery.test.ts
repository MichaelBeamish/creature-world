import { describe, expect, it } from 'vitest'
import { createCreature, GOLDEN_ANGLE, type Creature } from './creature'
import { createRng, range } from './rng'
import { createScenery, floorHeight, FLOOR, SCENERY, swimBounds } from './scenery'
import { dealArchetypes } from './traits'
import { createWorld } from './world'

describe('floorHeight / swimBounds', () => {
  it('is ~15% of the window, clamped to 70–130 px', () => {
    expect(floorHeight(720)).toBe(108)
    expect(floorHeight(300)).toBe(70) // clamped up
    expect(floorHeight(1600)).toBe(130) // clamped down
  })

  it('never eats more than 30% of a tiny window', () => {
    expect(floorHeight(100)).toBe(30)
  })

  it('the swim area ends a little below the sand line, so tentacles rest on the sand', () => {
    const b = swimBounds({ width: 1280, height: 720 })
    expect(b.width).toBe(1280)
    expect(b.height).toBe(720 - 108 + FLOOR.tentacleAllowance)
  })
})

describe('createScenery', () => {
  it('is deterministic per seed and differs between seeds', () => {
    expect(createScenery(42)).toEqual(createScenery(42))
    expect(createScenery(42)).not.toEqual(createScenery(43))
  })

  it('places rocks, shells and seaweed in their configured counts and ranges', () => {
    for (const seed of [1, 2, 3, 42, 1234]) {
      const items = createScenery(seed)
      for (const kind of ['rock', 'shell', 'seaweed'] as const) {
        const n = items.filter((i) => i.kind === kind).length
        const [min, max] =
          kind === 'rock' ? SCENERY.rocks : kind === 'shell' ? SCENERY.shells : SCENERY.seaweed
        expect(n).toBeGreaterThanOrEqual(min)
        expect(n).toBeLessThanOrEqual(max)
      }
      for (const item of items) {
        expect(item.u).toBeGreaterThan(0)
        expect(item.u).toBeLessThan(1)
        expect(item.depth).toBeGreaterThanOrEqual(0)
        expect(item.depth).toBeLessThanOrEqual(1)
        expect(item.variant).toBeGreaterThanOrEqual(0)
        expect(item.variant).toBeLessThan(1)
      }
      expect(new Set(items.map((i) => i.id)).size).toBe(items.length)
    }
  })

  it('stores positions relative to the window, so a resize keeps the layout', () => {
    const items = createScenery(7)
    for (const item of items) {
      // No pixel coordinates: only relative u/depth (the renderer maps them to the current size).
      expect(Object.keys(item).sort()).toEqual(['depth', 'id', 'kind', 'size', 'u', 'variant'])
    }
  })

  it('uses its own random stream: the world rng ends exactly where creature creation alone leaves it', () => {
    const config = { seed: 2024, width: 1280, height: 720, creatureCount: 5 }
    const world = createWorld(config)

    // Replay only the creature-creation draws (as createWorld does), with no scenery involved.
    const rng = createRng(config.seed)
    const bounds = swimBounds(config)
    const baseHue = range(rng, 0, 360)
    const archetypes = dealArchetypes(rng, config.creatureCount)
    const creatures: Creature[] = []
    for (let i = 0; i < config.creatureCount; i++) {
      creatures.push(
        createCreature(rng, i + 1, bounds, baseHue + i * GOLDEN_ANGLE, creatures, archetypes[i]),
      )
    }

    expect(world.rng.state).toBe(rng.state) // scenery consumed none of the creatures' randomness
    expect(world.creatures).toEqual(creatures)
    expect(world.scenery).toEqual(createScenery(config.seed))
  })
})

describe('placement quality', () => {
  it('keeps every shell clear of every rock (no shells half-hidden behind rocks), across many seeds', () => {
    let worst = Infinity
    for (let seed = 0; seed < 500; seed++) {
      const items = createScenery(seed)
      const rocks = items.filter((i) => i.kind === 'rock')
      for (const shell of items.filter((i) => i.kind === 'shell')) {
        for (const rock of rocks) worst = Math.min(worst, Math.abs(shell.u - rock.u))
      }
    }
    expect(worst).toBeGreaterThanOrEqual(SCENERY.shellRockGap)
  })

  it('keeps rocks moderate in size', () => {
    for (let seed = 0; seed < 100; seed++) {
      for (const rock of createScenery(seed).filter((i) => i.kind === 'rock')) {
        expect(rock.size).toBeGreaterThanOrEqual(SCENERY.rockSize[0])
        expect(rock.size).toBeLessThanOrEqual(SCENERY.rockSize[1])
        expect(rock.size).toBeLessThanOrEqual(34)
      }
    }
  })
})
