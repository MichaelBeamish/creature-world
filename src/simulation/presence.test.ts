import { describe, expect, it } from 'vitest'
import { createPresence, setPresenceInput, updatePresence } from './presence'

const DT = 1 / 60

describe('presence', () => {
  it('starts inactive and becomes active at the input position, at rest', () => {
    const p = createPresence()
    expect(p.active).toBe(false)
    setPresenceInput(p, 300, 200, true)
    updatePresence(p, DT)
    expect(p.active).toBe(true)
    expect(p.position).toEqual({ x: 300, y: 200 })
    expect(p.speed).toBe(0) // arriving is not a "flick"
  })

  it('converges to the true velocity of a steady movement', () => {
    const p = createPresence()
    let x = 100
    for (let i = 0; i < 60; i++) {
      setPresenceInput(p, x, 200, true)
      updatePresence(p, DT)
      x += 300 * DT // 300 px/s to the right
    }
    expect(p.velocity.x).toBeCloseTo(300, 0)
    expect(Math.abs(p.velocity.y)).toBeLessThan(1e-9)
    expect(p.speed).toBeCloseTo(300, 0)
  })

  it('smooths out a single jittery sample', () => {
    const p = createPresence()
    setPresenceInput(p, 100, 100, true)
    updatePresence(p, DT)
    setPresenceInput(p, 110, 100, true) // one 10 px jump = 600 px/s raw
    updatePresence(p, DT)
    expect(p.speed).toBeLessThan(600 * 0.3)
  })

  it('reports press and release edges for exactly one step', () => {
    const p = createPresence()
    setPresenceInput(p, 100, 100, true, false)
    updatePresence(p, DT)
    setPresenceInput(p, 100, 100, true, true)
    updatePresence(p, DT)
    expect([p.pressed, p.justPressed, p.justReleased]).toEqual([true, true, false])
    updatePresence(p, DT)
    expect([p.pressed, p.justPressed, p.justReleased]).toEqual([true, false, false])
    setPresenceInput(p, 100, 100, true, false)
    updatePresence(p, DT)
    expect([p.pressed, p.justPressed, p.justReleased]).toEqual([false, false, true])
    updatePresence(p, DT)
    expect(p.justReleased).toBe(false)
  })

  it('leaving the window while pressed counts as a release', () => {
    const p = createPresence()
    setPresenceInput(p, 100, 100, true, true)
    updatePresence(p, DT)
    setPresenceInput(p, 100, 100, false, true)
    updatePresence(p, DT)
    expect([p.pressed, p.justReleased]).toEqual([false, true])
  })

  it('goes inactive and stops when the input is inactive', () => {
    const p = createPresence()
    setPresenceInput(p, 100, 100, true)
    updatePresence(p, DT)
    setPresenceInput(p, 200, 100, true)
    updatePresence(p, DT)
    setPresenceInput(p, 200, 100, false)
    updatePresence(p, DT)
    expect(p.active).toBe(false)
    expect(p.speed).toBe(0)
  })
})
