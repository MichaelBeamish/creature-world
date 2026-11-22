import { describe, expect, it } from 'vitest'
import { createInk, INK, inkPuffAt, spawnInk, stepInk } from './ink'
import { createWorld, stepWorld } from './world'

function world() {
  const w = createWorld({ seed: 5, width: 1280, height: 720, creatureCount: 1 })
  const c = w.creatures[0]!
  c.position.x = 640
  c.position.y = 360
  return w
}

describe('ink', () => {
  it('a squirt spawns a burst of puffs at the creature', () => {
    const w = world()
    spawnInk(w.ink, w.creatures[0]!, 0, 1, 0)
    const active = w.ink.pool.filter((p) => p.active)
    expect(active.length).toBeGreaterThanOrEqual(INK.burst[0])
    expect(active.length).toBeLessThanOrEqual(INK.burst[1])
    for (const p of active) expect([p.x0, p.y0]).toEqual([640, 360])
  })

  it('the pool never grows, however many squirts', () => {
    const w = world()
    for (let i = 0; i < 20; i++) spawnInk(w.ink, w.creatures[0]!, i * 0.1, 1, 0)
    expect(w.ink.pool).toHaveLength(INK.capacity)
    expect(w.ink.pool.filter((p) => p.active).length).toBeLessThanOrEqual(INK.capacity)
  })

  it('leans toward the given direction (the hand): a smoke screen between visitor and creature', () => {
    const w = world()
    spawnInk(w.ink, w.creatures[0]!, 0, 1, 0) // toward +x
    const mean = w.ink.pool.filter((p) => p.active).reduce((sum, p) => sum + p.dirX, 0)
    expect(mean).toBeGreaterThan(0)
  })

  it('a higher aim (a Grumpy second squirt) concentrates the cloud toward the hand', () => {
    const meanToward = (aim: number) => {
      const w = world()
      spawnInk(w.ink, w.creatures[0]!, 0, 1, 0, aim)
      const puffs = w.ink.pool.filter((p) => p.active)
      return puffs.reduce((sum, p) => sum + p.dirX, 0) / puffs.length
    }
    expect(meanToward(0.85)).toBeGreaterThan(meanToward(INK.aim))
    expect(meanToward(0.85)).toBeGreaterThan(0.8)
  })

  it('a puff bursts out and slows, swells, then fades and is gone at the end of its life', () => {
    const w = world()
    spawnInk(w.ink, w.creatures[0]!, 0, 1, 0)
    const p = w.ink.pool.find((q) => q.active)!
    const at = (t: number) => inkPuffAt(p, p.bornAt + t, 0) // no drift: pure spread
    const d = (t: number) => Math.hypot(at(t).x - p.x0, at(t).y - p.y0)
    expect(d(0.2)).toBeGreaterThan(d(0.05))
    expect(d(0.2) - d(0.05)).toBeGreaterThan(d(1.2) - d(1.05)) // slows down
    expect(at(1).radius).toBeGreaterThan(at(0.05).radius)
    expect(at(p.life * 0.8).opacity).toBeLessThan(at(0.2).opacity)
    expect(inkPuffAt(p, p.bornAt + p.life).state).toBe('gone')
  })

  it('reduced drift: puffs rise less', () => {
    const w = world()
    spawnInk(w.ink, w.creatures[0]!, 0, 0, -1)
    const p = w.ink.pool.find((q) => q.active)!
    expect(inkPuffAt(p, p.bornAt + 2, 0.3).y).toBeGreaterThan(inkPuffAt(p, p.bornAt + 2, 1).y)
  })

  it('finished puffs are retired by the world step', () => {
    const w = world()
    spawnInk(w.ink, w.creatures[0]!, 0, 1, 0)
    for (let i = 0; i < 60 * (INK.life[1] + 1); i++) stepWorld(w, 1 / 60)
    stepInk(w)
    expect(w.ink.pool.some((p) => p.active)).toBe(false)
  })

  it('is deterministic per seed (own random stream)', () => {
    const run = () => {
      const w = world()
      w.ink = createInk(77)
      spawnInk(w.ink, w.creatures[0]!, 0, 1, 0)
      return w.ink.pool
    }
    expect(run()).toEqual(run())
  })
})
