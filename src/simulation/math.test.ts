import { describe, expect, it } from 'vitest'
import { clamp, lerp } from './math'

describe('clamp', () => {
  it('returns the value when inside the range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })

  it('returns the bound when the value is outside the range', () => {
    expect(clamp(-3, 0, 10)).toBe(0)
    expect(clamp(42, 0, 10)).toBe(10)
  })

  it('keeps values exactly on a bound', () => {
    expect(clamp(0, 0, 10)).toBe(0)
    expect(clamp(10, 0, 10)).toBe(10)
  })
})

describe('lerp', () => {
  it('returns the endpoints at t = 0 and t = 1', () => {
    expect(lerp(2, 8, 0)).toBe(2)
    expect(lerp(2, 8, 1)).toBe(8)
  })

  it('interpolates between the endpoints', () => {
    expect(lerp(2, 8, 0.5)).toBe(5)
  })

  it('extrapolates when t is outside [0, 1]', () => {
    expect(lerp(0, 10, 1.5)).toBe(15)
  })
})
