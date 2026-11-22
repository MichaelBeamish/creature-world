import { describe, expect, it } from 'vitest'
import { CONSTRAINTS, resolveConstraints } from './constraints'
import { footprint, footprintsOverlap } from './creature'
import { swimBounds } from './scenery'
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
    expect(f.y + f.radius).toBeCloseTo(swimBounds(world).height, 9) // rests on the sand, not below it
    expect(c.velocity).toEqual({ x: 0, y: 0 })
  })

  it('centers a creature in a world too small to hold its footprint', () => {
    const world = worldWith([[10, 10]], 40, 30)
    resolveConstraints(world)
    const f = fp(world, 0)
    expect([f.x, f.y]).toEqual([20, 15])
  })
})

describe('held creatures shove at a limited speed', () => {
  const DT = 1 / 60
  const hold = (world: World, creatureId: number) => {
    world.interaction.hold = {
      creatureId,
      part: 'head',
      offset: { x: 0, y: 0 },
      since: 0,
      pullAngle: 0,
      squeakTimer: 1,
      handSpeed: 0,
      shake: 0,
      stress: 0,
    }
  }

  it('a small bump: the neighbour takes the whole push and the held creature stays with the hand', () => {
    const world = worldWith([
      [480, 300],
      [480, 300],
    ])
    const gap = fp(world, 0).radius * 2
    world.creatures[1]!.position.x = 480 + gap - 1 // 1 px of overlap, well within one step's shove budget
    hold(world, 1)
    resolveConstraints(world, DT)
    expect(world.creatures[0]!.position.x).toBe(480)
    expect(footprintsOverlap(fp(world, 0), fp(world, 1))).toBe(false)
  })

  it('a hard shove: the neighbour moves at most shoveSpeed × dt, the held creature is blocked by the rest', () => {
    const world = worldWith([
      [480, 300],
      [520, 300],
    ]) // deep overlap, as if the hand dragged straight in
    hold(world, 1)
    world.creatures[0]!.velocity.x = 900 // rushing into the neighbour
    resolveConstraints(world, DT)
    const neighbourMoved = world.creatures[1]!.position.x - 520
    expect(neighbourMoved).toBeGreaterThan(0)
    expect(neighbourMoved).toBeLessThanOrEqual(CONSTRAINTS.shoveSpeed * DT + 1e-9)
    expect(world.creatures[0]!.position.x).toBeLessThan(480) // pushed back by what the neighbour couldn't take
    expect(world.creatures[0]!.velocity.x).toBeLessThanOrEqual(0) // no velocity left heading into it
    expect(footprintsOverlap(fp(world, 0), fp(world, 1))).toBe(false)
  })

  it('a neighbour pinned against a wall does not move into it; the held creature stops instead', () => {
    const world = worldWith(
      [
        [0, 300],
        [0, 300],
      ],
      1000,
      800,
    )
    const r = fp(world, 0).radius
    world.creatures[1]!.position.x = 1000 - r // touching the right wall
    world.creatures[0]!.position.x = 1000 - r - 2 * r + 20 // 20 px into it
    hold(world, 1)
    resolveConstraints(world, DT)
    expect(fp(world, 1).x + r).toBeLessThanOrEqual(1000 + 1e-6)
    expect(footprintsOverlap(fp(world, 0), fp(world, 1))).toBe(false)
  })
})
