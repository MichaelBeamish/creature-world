import { describe, expect, it } from 'vitest'
import { advanceFixedStep, DEFAULT_FIXED_STEP, type FixedStepConfig } from './fixedStep'

const STEP = 1 / 60

describe('advanceFixedStep', () => {
  it('runs the number of whole steps that fit in the elapsed time', () => {
    expect(advanceFixedStep(0, 0.05).steps).toBe(3) // 50 ms at 60 Hz
    expect(advanceFixedStep(0, STEP).steps).toBe(1)
    expect(advanceFixedStep(0, 0.01).steps).toBe(0)
  })

  it('carries leftover time across frames', () => {
    const first = advanceFixedStep(0, 0.01) // 10 ms: not enough for a step
    expect(first.steps).toBe(0)
    const second = advanceFixedStep(first.accumulator, 0.01) // 20 ms total
    expect(second.steps).toBe(1)
    expect(second.accumulator).toBeCloseTo(0.02 - STEP, 9)
  })

  it('produces the same total steps regardless of frame rate', () => {
    const run = (frameSeconds: number, frames: number) => {
      let acc = 0
      let total = 0
      for (let i = 0; i < frames; i++) {
        const r = advanceFixedStep(acc, frameSeconds)
        acc = r.accumulator
        total += r.steps
      }
      return total
    }
    // One second of time at 30, 60, and 144 FPS → 60 simulation steps each.
    expect(run(1 / 30, 30)).toBe(60)
    expect(run(1 / 60, 60)).toBe(60)
    expect(run(1 / 144, 144)).toBe(60)
  })

  it('returns alpha in [0, 1) proportional to the leftover time', () => {
    const half = advanceFixedStep(0, STEP / 2)
    expect(half.alpha).toBeCloseTo(0.5, 9)
    for (const t of [0, 0.001, 0.0166, 0.02, 0.05, 0.1, 0.25]) {
      const { alpha } = advanceFixedStep(0, t)
      expect(alpha).toBeGreaterThanOrEqual(0)
      expect(alpha).toBeLessThan(1)
    }
  })

  it('clamps very long frames (e.g. returning to a background tab)', () => {
    const r = advanceFixedStep(0, 5) // 5 s gap
    expect(r.steps).toBeLessThanOrEqual(DEFAULT_FIXED_STEP.maxStepsPerFrame)
    expect(r.accumulator).toBeLessThan(STEP)
  })

  it('never exceeds maxStepsPerFrame and drops the unaffordable time', () => {
    const config: FixedStepConfig = { stepSeconds: STEP, maxFrameSeconds: 1, maxStepsPerFrame: 4 }
    const r = advanceFixedStep(0, 0.5, config) // would be 30 steps
    expect(r.steps).toBe(4)
    expect(r.accumulator).toBeLessThan(STEP)
  })

  it('treats negative deltas as zero', () => {
    expect(advanceFixedStep(0, -1)).toEqual({ steps: 0, accumulator: 0, alpha: 0 })
  })
})
