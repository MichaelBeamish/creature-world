import { describe, expect, it } from 'vitest'
import { createRng, int, next, pick, range } from './rng'

const draw = (seed: number, n: number) => {
  const rng = createRng(seed)
  return Array.from({ length: n }, () => next(rng))
}

describe('rng', () => {
  it('produces the same sequence for the same seed', () => {
    expect(draw(42, 100)).toEqual(draw(42, 100))
  })

  it('produces different sequences for different seeds', () => {
    expect(draw(1, 10)).not.toEqual(draw(2, 10))
  })

  it('keeps its state as plain data, so a copy continues identically', () => {
    const a = createRng(7)
    next(a)
    next(a)
    const b = structuredClone(a)
    expect([next(a), next(a), next(a)]).toEqual([next(b), next(b), next(b)])
  })

  it('next() stays in [0, 1)', () => {
    for (const v of draw(123, 10_000)) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('range() and int() stay within bounds', () => {
    const rng = createRng(99)
    for (let i = 0; i < 10_000; i++) {
      const r = range(rng, -5, 5)
      expect(r).toBeGreaterThanOrEqual(-5)
      expect(r).toBeLessThan(5)
      const n = int(rng, 5, 8)
      expect(n).toBeGreaterThanOrEqual(5)
      expect(n).toBeLessThanOrEqual(8)
      expect(Number.isInteger(n)).toBe(true)
    }
  })

  it('is roughly uniform (10 buckets, each within ±10% of expected)', () => {
    const buckets = new Array<number>(10).fill(0)
    for (const v of draw(2024, 100_000)) buckets[Math.floor(v * 10)]!++
    for (const count of buckets) {
      expect(count).toBeGreaterThan(9_000)
      expect(count).toBeLessThan(11_000)
    }
  })

  it('int() hits every value in an inclusive range', () => {
    const rng = createRng(5)
    const seen = new Set<number>()
    for (let i = 0; i < 1_000; i++) seen.add(int(rng, 5, 8))
    expect([...seen].sort((x, y) => x - y)).toEqual([5, 6, 7, 8])
  })

  it('pick() returns elements of the array and rejects empty arrays', () => {
    const rng = createRng(3)
    const items = ['a', 'b', 'c'] as const
    for (let i = 0; i < 100; i++) expect(items).toContain(pick(rng, items))
    expect(() => pick(rng, [])).toThrow()
  })
})
