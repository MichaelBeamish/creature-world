import { describe, expect, it } from 'vitest'
import { LIGHTS, twinkle } from './party'

describe('party lights are light-safe (task #32a)', () => {
  it('no light brightens more than 3 times a second (WCAG 2.3.1)', () => {
    expect(LIGHTS.maxFlashHz).toBeLessThan(3)
    for (let seed = 1; seed <= 40; seed++) {
      // Count brightness peaks over 10 s, sampled at 240 Hz.
      let peaks = 0
      let prev = twinkle(0, seed)
      let rising = false
      for (let t = 1 / 240; t <= 10; t += 1 / 240) {
        const b = twinkle(t, seed)
        if (rising && b < prev) peaks++
        rising = b > prev
        prev = b
      }
      expect(peaks / 10).toBeLessThanOrEqual(3)
    }
  })

  it('brightness stays within 0..1', () => {
    for (let t = 0; t < 5; t += 0.01) {
      const b = twinkle(t, 7)
      expect(b).toBeGreaterThanOrEqual(0)
      expect(b).toBeLessThanOrEqual(1)
    }
  })
})
