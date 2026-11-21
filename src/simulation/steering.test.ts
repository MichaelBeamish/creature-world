import { describe, expect, it } from 'vitest'
import { createCreature, footprint, type Creature } from './creature'
import { createRng } from './rng'
import { arrive, brake, flee, seek, separate, stayInBounds, STEERING, wander } from './steering'
import { vec2 } from './vec2'

const BOUNDS = { width: 1000, height: 800 }

function creatureAt(id: number, x: number, y: number, size = 30): Creature {
  const c = createCreature(createRng(id), id, BOUNDS, 0)
  c.size = size
  c.position.x = x
  c.position.y = y
  c.velocity.x = 0
  c.velocity.y = 0
  return c
}

describe('separate', () => {
  it('pushes away from a creature that is too close', () => {
    const a = creatureAt(1, 400, 300)
    const b = creatureAt(2, 460, 300)
    const f = separate(vec2(), a, [a, b], 60)
    expect(f.x).toBeLessThan(0) // b is to the right → push left
    expect(Math.abs(f.y)).toBeLessThan(1e-9)
  })

  it('is zero when everyone is far apart', () => {
    const a = creatureAt(1, 100, 100)
    const b = creatureAt(2, 800, 600)
    expect(separate(vec2(), a, [a, b], 60)).toEqual({ x: 0, y: 0 })
  })

  it('pushes harder the closer they are', () => {
    const a = creatureAt(1, 400, 300)
    const near = separate(vec2(), a, [a, creatureAt(2, 430, 300)], 60)
    const far = separate(vec2(), a, [a, creatureAt(2, 520, 300)], 60)
    expect(Math.abs(near.x)).toBeGreaterThan(Math.abs(far.x))
  })

  it('handles exactly coincident creatures deterministically', () => {
    const a = creatureAt(1, 400, 300)
    const b = creatureAt(2, 400, 300)
    const fa = separate(vec2(), a, [a, b], 60)
    const fb = separate(vec2(), b, [a, b], 60)
    expect(fa.x).toBeLessThan(0)
    expect(fb.x).toBeGreaterThan(0)
  })
})

describe('stayInBounds', () => {
  it('is zero in the open middle', () => {
    const c = creatureAt(1, 500, 300)
    expect(stayInBounds(vec2(), c, BOUNDS, 60)).toEqual({ x: 0, y: 0 })
  })

  it('pushes inward near each edge, at full strength when touching', () => {
    const size = 30
    const r = footprint(vec2(0, 0), size).radius
    const offsetY = footprint(vec2(0, 0), size).y
    const left = stayInBounds(vec2(), creatureAt(1, r, 300, size), BOUNDS, 60)
    expect(left.x).toBeCloseTo(60, 9)
    const right = stayInBounds(vec2(), creatureAt(1, BOUNDS.width - r, 300, size), BOUNDS, 60)
    expect(right.x).toBeCloseTo(-60, 9)
    const bottom = stayInBounds(
      vec2(),
      creatureAt(1, 500, BOUNDS.height - r - offsetY + STEERING.edgeMargin / 2, size),
      BOUNDS,
      60,
    )
    expect(bottom.y).toBeLessThan(0)
  })
})

describe('wander', () => {
  it('is deterministic, capped at maxForce, and drifts the wander angle', () => {
    const run = () => {
      const c = creatureAt(1, 500, 300)
      const rng = createRng(7)
      const forces = []
      for (let i = 0; i < 30; i++) {
        const f = wander(vec2(), c, rng, 1 / 60, 35, 25)
        forces.push(f)
      }
      return { forces, angle: c.wanderAngle }
    }
    const a = run()
    const b = run()
    expect(a).toEqual(b)
    for (const f of a.forces) expect(Math.hypot(f.x, f.y)).toBeLessThanOrEqual(25 + 1e-9)
    const start = creatureAt(1, 500, 300).wanderAngle
    expect(a.angle).not.toBe(start)
  })
})

describe('arrive / seek / flee / brake', () => {
  it('arrive heads toward the target and stops short at the stop distance', () => {
    const c = creatureAt(1, 100, 300)
    const toward = arrive(vec2(), c, vec2(400, 300), 70, 120, 40, 100)
    expect(toward.x).toBeGreaterThan(0)
    const close = creatureAt(1, 340, 300) // 60 px away, inside the 70 px stop distance
    expect(arrive(vec2(), close, vec2(400, 300), 70, 120, 40, 100)).toEqual({ x: 0, y: 0 })
  })

  it('arrive slows down inside the slow radius', () => {
    const far = creatureAt(1, 100, 300)
    const near = creatureAt(1, 300, 300) // 30 px past the stop distance, inside slow radius
    const fFar = arrive(vec2(), far, vec2(400, 300), 70, 120, 40, 1000)
    const fNear = arrive(vec2(), near, vec2(400, 300), 70, 120, 40, 1000)
    expect(fNear.x).toBeLessThan(fFar.x)
  })

  it('seek goes straight for the target', () => {
    const c = creatureAt(1, 100, 100)
    const f = seek(vec2(), c, vec2(200, 200), 40, 1000)
    expect(f.x).toBeCloseTo(f.y, 9)
    expect(f.x).toBeGreaterThan(0)
  })

  it('flee pushes away while too close and stops once safe', () => {
    const c = creatureAt(1, 500, 300)
    const f = flee(vec2(), c, vec2(450, 300), 200, 80, 1000)
    expect(f.x).toBeGreaterThan(0)
    expect(flee(vec2(), c, vec2(100, 300), 200, 80, 1000)).toEqual({ x: 0, y: 0 })
  })

  it('brake opposes the current velocity', () => {
    const c = creatureAt(1, 500, 300)
    c.velocity.x = 30
    c.velocity.y = -10
    const f = brake(vec2(), c, 1000)
    expect(f).toEqual({ x: -30, y: 10 })
  })
})
