import { describe, expect, it } from 'vitest'
import { hash2 } from './noise'

describe('hash2', () => {
  it('is deterministic', () => {
    expect(hash2(3, 17)).toBe(hash2(3, 17))
  })

  it('stays in [0, 1)', () => {
    for (let a = 0; a < 50; a++) {
      for (let b = 0; b < 50; b++) {
        const v = hash2(a, b)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThan(1)
      }
    }
  })

  it('varies with either input (no obvious collisions on neighbors)', () => {
    const values = new Set<number>()
    for (let a = 0; a < 20; a++) for (let b = 0; b < 20; b++) values.add(hash2(a, b))
    expect(values.size).toBe(400)
    expect(hash2(1, 2)).not.toBe(hash2(2, 1))
  })

  it('is roughly uniform (10 buckets within ±15%)', () => {
    const buckets = new Array<number>(10).fill(0)
    for (let a = 0; a < 100; a++)
      for (let b = 0; b < 100; b++) buckets[Math.floor(hash2(a, b) * 10)]!++
    for (const count of buckets) {
      expect(count).toBeGreaterThan(850)
      expect(count).toBeLessThan(1150)
    }
  })
})
