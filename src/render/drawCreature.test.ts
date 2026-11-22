import { describe, expect, it } from 'vitest'
import { CREATURE_LIMITS } from '../simulation/creature'
import {
  grabbedTentacle,
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
