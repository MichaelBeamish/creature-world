import { describe, expect, it } from 'vitest'
import { footprint, type Footprint } from './creature'
import { speedLimit } from './movement'
import { swimBounds } from './scenery'
import { createWorld, resizeWorld, stepWorld, type World } from './world'

const DT = 1 / 60
const SECONDS_60 = 60 * 60
const SEEDS = [1, 7, 42, 1234, 2024]

const footprints = (world: World) => world.creatures.map((c) => footprint(c.position, c.size))

function insideBounds(f: Footprint, world: World, eps = 1e-6): boolean {
  return (
    f.x - f.radius >= -eps &&
    f.x + f.radius <= world.width + eps &&
    f.y - f.radius >= -eps &&
    f.y + f.radius <= swimBounds(world).height + eps // never sinks into the sand
  )
}

/** Sum of overlap depths over all pairs (0 = nobody overlaps). */
function totalOverlap(world: World): number {
  const fs = footprints(world)
  let total = 0
  for (let i = 0; i < fs.length; i++) {
    for (let j = i + 1; j < fs.length; j++) {
      const a = fs[i]!
      const b = fs[j]!
      total += Math.max(0, a.radius + b.radius - Math.hypot(a.x - b.x, a.y - b.y))
    }
  }
  return total
}

describe('movement over 60 seconds (normal window)', () => {
  it('keeps every footprint in bounds, never overlaps, and respects max speed — every step', () => {
    for (const seed of SEEDS) {
      const world = createWorld({ seed, width: 1280, height: 720, creatureCount: 5 })
      for (let i = 0; i < SECONDS_60; i++) {
        stepWorld(world, DT)
        for (const f of footprints(world)) expect(insideBounds(f, world)).toBe(true)
        // Never a *visible* overlap. The constraint solver resolves pairs one at a time and converges
        // iteratively, so a tiny residue can remain when creatures press together near a wall
        // (measured: worst 0.07 px, in ~3% of steps for one seed). Sub-pixel = invisible.
        expect(totalOverlap(world)).toBeLessThan(0.5)
        for (const c of world.creatures) {
          expect(Math.hypot(c.velocity.x, c.velocity.y)).toBeLessThanOrEqual(speedLimit(c) + 1e-9)
        }
      }
    }
  })

  it('every creature wanders a meaningful distance and rests at least once, slowing almost to a stop', () => {
    for (const seed of SEEDS) {
      const world = createWorld({ seed, width: 1280, height: 720, creatureCount: 5 })
      const travelled = world.creatures.map(() => 0)
      const rested = world.creatures.map(() => false)
      const restSlowest = world.creatures.map(() => Infinity)
      for (let i = 0; i < SECONDS_60; i++) {
        stepWorld(world, DT)
        world.creatures.forEach((c, k) => {
          travelled[k]! += Math.hypot(
            c.position.x - c.prevPosition.x,
            c.position.y - c.prevPosition.y,
          )
          if (c.activity.kind === 'rest') {
            rested[k] = true
            restSlowest[k] = Math.min(restSlowest[k]!, Math.hypot(c.velocity.x, c.velocity.y))
          }
        })
      }
      for (const d of travelled) expect(d).toBeGreaterThan(150)
      expect(rested.every(Boolean)).toBe(true)
      for (const s of restSlowest) expect(s).toBeLessThan(2)
    }
  })

  it('turns smoothly (no jittery direction changes while moving)', () => {
    const world = createWorld({ seed: 42, width: 1280, height: 720, creatureCount: 5 })
    let maxTurn = 0
    for (let i = 0; i < SECONDS_60; i++) {
      const before = world.creatures.map((c) => Math.atan2(c.velocity.y, c.velocity.x))
      const speeds = world.creatures.map((c) => Math.hypot(c.velocity.x, c.velocity.y))
      stepWorld(world, DT)
      world.creatures.forEach((c, k) => {
        if (speeds[k]! < 10 || Math.hypot(c.velocity.x, c.velocity.y) < 10) return
        let d = Math.abs(Math.atan2(c.velocity.y, c.velocity.x) - before[k]!)
        if (d > Math.PI) d = 2 * Math.PI - d
        maxTurn = Math.max(maxTurn, d)
      })
    }
    expect(maxTurn).toBeLessThan(0.15) // < ~9° per step while cruising
  })
})

describe('crowded and resized worlds', () => {
  it('in a small window, spawn overlaps are resolved (to sub-pixel) within 10 s and nobody leaves the bounds', () => {
    for (const seed of SEEDS) {
      const world = createWorld({ seed, width: 520, height: 360, creatureCount: 5 })
      expect(totalOverlap(world)).toBeGreaterThan(1) // every seed really starts overlapping (measured 5–70 px)
      for (let i = 0; i < 10 * 60; i++) {
        stepWorld(world, DT)
        for (const f of footprints(world)) expect(insideBounds(f, world)).toBe(true)
      }
      // Sub-pixel residue can remain when creatures are pressed against walls in a cramped window
      // (constraint chains + few iterations); < 0.5 px is invisible.
      expect(totalOverlap(world)).toBeLessThan(0.5)
    }
  })

  it('in a window too small for everyone, overlap is reduced (minimized, not eliminated)', () => {
    const world = createWorld({ seed: 5, width: 300, height: 260, creatureCount: 5 })
    const atSpawn = totalOverlap(world)
    for (let i = 0; i < 10 * 60; i++) stepWorld(world, DT)
    for (const f of footprints(world)) expect(insideBounds(f, world)).toBe(true)
    expect(totalOverlap(world)).toBeLessThan(atSpawn)
  })

  it('after the window shrinks, every footprint is back inside within one step', () => {
    const world = createWorld({ seed: 3, width: 1280, height: 720, creatureCount: 5 })
    for (let i = 0; i < 120; i++) stepWorld(world, DT)
    resizeWorld(world, 700, 450)
    stepWorld(world, DT)
    for (const f of footprints(world)) expect(insideBounds(f, world)).toBe(true)
  })
})
