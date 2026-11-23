import { describe, expect, it } from 'vitest'
import { danceMoves } from './dance'

describe('dance moves (task #32d)', () => {
  it('hops land on the beat and peak between beats', () => {
    expect(danceMoves('bounce', 1, 4, true).bob).toBeCloseTo(0)
    expect(danceMoves('bounce', 1, 4.5, true).bob).toBeLessThan(-0.3)
  })

  it('dances bigger the harder it dances', () => {
    const small = danceMoves('bounce', 0.3, 4.5, true)
    const big = danceMoves('bounce', 1, 4.5, true)
    expect(Math.abs(big.bob)).toBeGreaterThan(Math.abs(small.bob) * 2)
  })

  it('each style moves differently', () => {
    const at = 5.5
    const [bounce, sway, shy] = (['bounce', 'sway', 'shy'] as const).map((s) =>
      danceMoves(s, 1, at, true),
    )
    expect(Math.abs(bounce!.bob)).toBeGreaterThan(Math.abs(sway!.bob))
    expect(Math.abs(sway!.lean)).toBeGreaterThan(Math.abs(shy!.lean))
  })

  it('the Friendly spins on the first beat of every 8 bars when going all out', () => {
    expect(danceMoves('bounce', 1, 64.5, true).lean).toBeGreaterThan(2)
    expect(danceMoves('bounce', 1, 65.5, true).lean).toBeLessThan(1)
    expect(danceMoves('bounce', 0.5, 64.5, true).lean).toBeLessThan(1) // not in the builds
  })

  it('the sulking Grumpy is still — but one tentacle taps, down on the beat', () => {
    const m = danceMoves('sulk', 0, 7.5, true)
    expect(m.bob).toBe(0)
    expect(m.tap).toBeCloseTo(1)
    expect(danceMoves('sulk', 0, 8, true).tap).toBeCloseTo(0)
  })

  it('reduced motion: no hops, spins or taps — a gentle sway only', () => {
    for (const beats of [4.5, 64.5]) {
      const m = danceMoves('bounce', 1, beats, false)
      expect(m.bob).toBe(0)
      expect(m.squash).toBe(1)
      expect(Math.abs(m.lean)).toBeLessThan(0.1)
    }
    expect(danceMoves('sulk', 0, 7.5, false).tap).toBe(0)
  })
})
