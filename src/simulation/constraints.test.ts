import { describe, expect, it } from 'vitest'
import { resolveConstraints } from './constraints'
import { footprint, footprintsOverlap } from './creature'
import { createWorld, type World } from './world'

function worldWith(positions: [number, number][], width = 1000, height = 800): World {
  const world = createWorld({ seed: 1, width, height, creatureCount: positions.length })
  world.creatures.forEach((c, i) => {
    c.size = 30
    c.position.x = positions[i]![0]
    c.position.y = positions[i]![1]
  })
  return world
}

const fp = (world: World, i: number) => {
  const c = world.creatures[i]!
  return footprint(c.position, c.size)
}

describe('resolveConstraints', () => {
  it('separates an overlapping pair so their footprints no longer overlap', () => {
    const world = worldWith([
      [480, 300],
      [520, 300],
    ])
    expect(footprintsOverlap(fp(world, 0), fp(world, 1))).toBe(true)
    resolveConstraints(world)
    expect(footprintsOverlap(fp(world, 0), fp(world, 1))).toBe(false)
    // Each moved, symmetrically, along the line between them.
    expect(world.creatures[0]!.position.x).toBeLessThan(480)
    expect(world.creatures[1]!.position.x).toBeGreaterThan(520)
  })

  it('separates exactly coincident creatures', () => {
    const world = worldWith([
      [500, 300],
      [500, 300],
    ])
    resolveConstraints(world)
    expect(footprintsOverlap(fp(world, 0), fp(world, 1))).toBe(false)
  })

  it('clamps footprints back inside the bounds and cancels velocity into the wall', () => {
    const world = worldWith([[-200, 2000]])
    const c = world.creatures[0]!
    c.velocity.x = -10
    c.velocity.y = 10
    resolveConstraints(world)
    const f = fp(world, 0)
    expect(f.x - f.radius).toBeCloseTo(0, 9)
    expect(f.y + f.radius).toBeCloseTo(world.height, 9)
    expect(c.velocity).toEqual({ x: 0, y: 0 })
  })

  it('centers a creature in a world too small to hold its footprint', () => {
    const world = worldWith([[10, 10]], 40, 30)
    resolveConstraints(world)
    const f = fp(world, 0)
    expect([f.x, f.y]).toEqual([20, 15])
  })
})
