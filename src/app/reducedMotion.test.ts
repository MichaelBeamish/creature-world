import { describe, expect, it } from 'vitest'
import { FULL_MOTION, motionSettings, REDUCED_MOTION } from '../render/motion'
import { watchReducedMotion, type MotionQuery } from './reducedMotion'

/** A fake MediaQueryList whose `matches` we can flip and announce. */
function fakeQuery(initial: boolean) {
  const target = new EventTarget()
  const query = {
    matches: initial,
    addEventListener: (type: 'change', l: () => void) => target.addEventListener(type, l),
    removeEventListener: (type: 'change', l: () => void) => target.removeEventListener(type, l),
  }
  const flip = (value: boolean) => {
    query.matches = value
    target.dispatchEvent(new Event('change'))
  }
  return { query: query as MotionQuery, flip }
}

describe('watchReducedMotion', () => {
  it('reports the current setting immediately and every change live', () => {
    const { query, flip } = fakeQuery(false)
    const seen: boolean[] = []
    watchReducedMotion((r) => seen.push(r), query)
    flip(true)
    flip(false)
    expect(seen).toEqual([false, true, false])
  })

  it('stops listening after unsubscribe', () => {
    const { query, flip } = fakeQuery(true)
    const seen: boolean[] = []
    const stop = watchReducedMotion((r) => seen.push(r), query)
    stop()
    flip(false)
    expect(seen).toEqual([true])
  })
})

describe('motionSettings', () => {
  it('full motion by default; reduced tones decorative motion down but never to an unnatural freeze', () => {
    expect(motionSettings(false)).toBe(FULL_MOTION)
    const r = motionSettings(true)
    expect(r).toBe(REDUCED_MOTION)
    for (const key of ['sway', 'breath', 'lean', 'trail', 'emoteFloat'] as const) {
      expect(r[key]).toBeLessThan(FULL_MOTION[key])
      expect(r[key]).toBeGreaterThan(0) // creatures still look alive (breathing, swaying a little)
    }
    expect(r.emotePop).toBe(false) // no overshoot "pop"
    expect(r.background).toBe(0) // purely decorative background motion stops entirely
  })
})
