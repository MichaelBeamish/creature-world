import { describe, expect, it } from 'vitest'
import { CREATURE_LIMITS } from '../simulation/creature'
import {
  partyDarken,
  grabbedTentacle,
  propulsion,
  swimAngle,
  mantleRadii,
  TENTACLE_ROOT,
  tentacleOutline,
  tentacleRoot,
  type Point,
} from './drawCreature'

/** The body at its smallest: fully scared (shrunk) at the low point of both breathing curves. */
function smallestBody(size: number) {
  let rx = Infinity
  let ry = Infinity
  for (let k = 0; k < 360; k++) {
    const r = mantleRadii(size, 1, 0, (k / 360) * Math.PI * 2)
    rx = Math.min(rx, r.rx)
    ry = Math.min(ry, r.ry)
  }
  return { rx, ry }
}

const inside = (p: Point, rx: number, ry: number) => (p[0] / rx) ** 2 + (p[1] / ry) ** 2

describe('tentacle roots stay inside the body', () => {
  it('every point of every rounded root cap is inside the smallest body (5–8 tentacles, all sizes)', () => {
    let worst = 0
    for (const size of [CREATURE_LIMITS.minSize, 30, CREATURE_LIMITS.maxSize]) {
      const { rx, ry } = smallestBody(size)
      const capRadius = (size * TENTACLE_ROOT.width) / 2
      for (let n = CREATURE_LIMITS.minTentacles; n <= CREATURE_LIMITS.maxTentacles; n++) {
        for (let i = 0; i < n; i++) {
          const root = tentacleRoot(size, i, n)
          // The whole cap circle, whatever direction the tentacle leaves in.
          for (let k = 0; k < 64; k++) {
            const a = (k / 64) * Math.PI * 2
            const p: Point = [root.x + Math.cos(a) * capRadius, root.y + Math.sin(a) * capRadius]
            worst = Math.max(worst, inside(p, rx, ry))
          }
        }
      }
    }
    expect(worst).toBeLessThan(1) // < 1 means inside the ellipse
  })
})

describe('tentacleOutline', () => {
  const p0: Point = [0, 0]
  const p1: Point = [20, 30]
  const p2: Point = [30, 60]
  const p3: Point = [40, 100]
  const startWidth = 12
  const endWidth = 3
  const outline = tentacleOutline(p0, p1, p2, p3, startWidth, endWidth)
  const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1])

  it('is rounded at the root: cap points sit exactly on a circle around p0', () => {
    const rootCap = outline.filter((p) => dist(p, p0) <= startWidth / 2 + 1e-9)
    expect(rootCap.length).toBeGreaterThanOrEqual(9) // both edge ends + the cap arc between them
    for (const p of rootCap) expect(dist(p, p0)).toBeCloseTo(startWidth / 2, 6)
    // The cap bulges *backwards* (away from where the tentacle goes), not into the tentacle.
    const back = outline.filter(
      (p) => dist(p, p0) <= startWidth / 2 + 1e-9 && p[1] < -startWidth / 4,
    )
    expect(back.length).toBeGreaterThan(0)
  })

  it('is rounded at the tip too', () => {
    const tipCap = outline.filter((p) => dist(p, p3) <= endWidth / 2 + 1e-9)
    expect(tipCap.length).toBeGreaterThanOrEqual(9)
    for (const p of tipCap) expect(dist(p, p3)).toBeCloseTo(endWidth / 2, 6)
  })
})

describe('grabbedTentacle', () => {
  it('picks the tentacle whose resting tip is nearest the hand', () => {
    expect(grabbedTentacle(30, 6, -60)).toBe(0) // far left → leftmost
    expect(grabbedTentacle(30, 6, 60)).toBe(5) // far right → rightmost
    const middle = grabbedTentacle(30, 7, 0)
    expect(middle).toBe(3) // straight below → the middle one
  })
})

describe('jet swimming (fast: a chase or an escape)', () => {
  it('only kicks in above normal swimming speeds, fully at chase speed', () => {
    expect(propulsion(0)).toBe(0)
    expect(propulsion(45)).toBe(0) // wandering
    expect(propulsion(90)).toBe(0) // a normal flee
    expect(propulsion(200)).toBeGreaterThan(0)
    expect(propulsion(200)).toBeLessThan(1)
    expect(propulsion(600)).toBe(1) // a mad Grumpy, or a jet escape
  })

  it('turns the body to face its travel, head first', () => {
    expect(swimAngle(0, 0, -500, 1)).toBeCloseTo(0) // swimming up: upright
    expect(swimAngle(0, 500, 0, 1)).toBeCloseTo(Math.PI / 2) // right: a quarter turn clockwise
    expect(swimAngle(0, -500, 0, 1)).toBeCloseTo(-Math.PI / 2) // left
    expect(swimAngle(0.1, 500, 0, 0)).toBe(0.1) // slow: just the usual lean
    expect(swimAngle(0, 500, 0, 0.5)).toBeCloseTo(Math.PI / 4) // halfway
  })

  it('always turns the short way round', () => {
    // Heading straight down is ±π; from a lean of 3 rad it must turn by a little, not almost a full circle.
    expect(Math.abs(swimAngle(3, 0, 500, 1) - 3)).toBeLessThan(0.2)
  })
})

describe('creatures at the party (task #42)', () => {
  it('dim with the party: not at all without one, the most at its peak', () => {
    expect(partyDarken(0)).toBe(0)
    expect(partyDarken(0.5)).toBeGreaterThan(0)
    expect(partyDarken(1)).toBeGreaterThan(partyDarken(0.5))
    expect(partyDarken(2)).toBe(partyDarken(1)) // never past the peak
  })
})
