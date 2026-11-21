import { describe, expect, it } from 'vitest'
import { resolveSeed } from './seed'

describe('resolveSeed', () => {
  it('uses ?seed= from the URL when it is an integer', () => {
    expect(resolveSeed('?seed=42')).toBe(42)
    expect(resolveSeed('?foo=1&seed=-7')).toBe(-7)
  })

  it('falls back to a random seed when missing or invalid', () => {
    const random = () => 0.5
    expect(resolveSeed('', random)).toBe(2 ** 30)
    expect(resolveSeed('?seed=abc', random)).toBe(2 ** 30)
    expect(resolveSeed('?seed=1.5', random)).toBe(2 ** 30)
  })
})
