import { describe, expect, it } from 'vitest'
import { createFpsMeter } from './fpsMeter'

describe('fpsMeter', () => {
  it('reports ~60 FPS for frames 16.67 ms apart', () => {
    const meter = createFpsMeter()
    for (let i = 0; i <= 60; i++) meter.record(i * (1000 / 60), 2)
    expect(meter.stats().fps).toBeCloseTo(60, 5)
  })

  it('reports ~30 FPS for frames 33.3 ms apart', () => {
    const meter = createFpsMeter()
    for (let i = 0; i <= 30; i++) meter.record(i * (1000 / 30), 2)
    expect(meter.stats().fps).toBeCloseTo(30, 5)
  })

  it('averages work time and keeps the worst frame', () => {
    const meter = createFpsMeter()
    const work = [2, 2, 2, 9, 2, 2]
    work.forEach((w, i) => meter.record(i * 16, w))
    const s = meter.stats()
    expect(s.avgFrameMs).toBeCloseTo(19 / 6, 9)
    expect(s.worstFrameMs).toBe(9)
  })

  it('only counts the last window (old slow frames are forgotten)', () => {
    const meter = createFpsMeter(1000)
    meter.record(0, 50) // a slow frame long ago
    for (let i = 0; i <= 60; i++) meter.record(2000 + i * (1000 / 60), 2)
    expect(meter.stats().worstFrameMs).toBe(2)
    expect(meter.stats().fps).toBeCloseTo(60, 5)
  })

  it('is empty-safe and can be reset', () => {
    const meter = createFpsMeter()
    expect(meter.stats()).toEqual({ fps: 0, avgFrameMs: 0, worstFrameMs: 0 })
    meter.record(0, 1)
    meter.record(16, 1)
    meter.reset()
    expect(meter.stats().fps).toBe(0)
  })
})
