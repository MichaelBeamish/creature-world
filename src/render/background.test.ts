import { describe, expect, it } from 'vitest'
import { motePosition } from './background'

describe('motePosition', () => {
  it('stays on screen at any time (wraps around)', () => {
    for (let i = 0; i < 40; i++) {
      for (const t of [0, 1, 17.3, 600, 86_400]) {
        const m = motePosition(i, t, 1280, 720)
        expect(m.x).toBeGreaterThanOrEqual(0)
        expect(m.x).toBeLessThan(1280)
        expect(m.y).toBeGreaterThanOrEqual(0)
        expect(m.y).toBeLessThan(720)
      }
    }
  })

  it('is a pure function of time: same inputs, same mote; time 0 is a fixed (still) frame', () => {
    expect(motePosition(5, 12.5, 800, 600)).toEqual(motePosition(5, 12.5, 800, 600))
    expect(motePosition(5, 0, 800, 600)).toEqual(motePosition(5, 0, 800, 600))
  })

  it('drifts upward over time', () => {
    const a = motePosition(3, 0, 1280, 10_000) // tall screen so it doesn't wrap
    const b = motePosition(3, 2, 1280, 10_000)
    expect(b.y).toBeLessThan(a.y)
  })

  it('stays small and faint (decorative)', () => {
    for (let i = 0; i < 40; i++) {
      const m = motePosition(i, 0, 1280, 720)
      expect(m.radius).toBeLessThan(3)
      expect(m.alpha).toBeLessThan(0.35)
    }
  })
})
