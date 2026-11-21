/**
 * Scenario tests: whole-world behavior of the four personalities under scripted visitor input.
 * These cover MVP success criterion #3 and the peeking / invariant criteria of task #8.
 */
import { describe, expect, it } from 'vitest'
import { footprint } from './creature'
import { speedLimit } from './movement'
import { setPresenceInput } from './presence'
import { ARCHETYPES, type Archetype } from './traits'
import { createWorld, stepWorld, type World } from './world'

const DT = 1 / 60
type Cursor = (t: number) => { x: number; y: number } | null

/** A world whose creatures have the given archetypes (exact dials, mid energy) at the given positions. */
function staged(cast: { archetype: Archetype; x: number; y: number }[]): World {
  const world = createWorld({ seed: 5, width: 1280, height: 720, creatureCount: cast.length })
  world.creatures.forEach((c, i) => {
    const role = cast[i]!
    c.archetype = role.archetype
    c.traits = { ...ARCHETYPES[role.archetype], energy: 0.6 }
    c.size = 30
    c.position.x = c.prevPosition.x = role.x
    c.position.y = c.prevPosition.y = role.y
  })
  return world
}

function play(world: World, cursor: Cursor, seconds: number, each?: (t: number) => void): void {
  const steps = Math.round(seconds / DT)
  for (let i = 0; i < steps; i++) {
    const t = world.time
    const p = cursor(t)
    setPresenceInput(world.presence, p?.x ?? 0, p?.y ?? 0, p !== null)
    stepWorld(world, DT)
    each?.(world.time)
  }
}

const distance = (world: World, i: number, x: number, y: number) =>
  Math.hypot(world.creatures[i]!.position.x - x, world.creatures[i]!.position.y - y)

describe('MVP success criterion #3', () => {
  it('under the same calm presence, a Scaredy ends farther from the cursor than a Friendly', () => {
    const cursor = { x: 640, y: 360 }
    const world = staged([
      { archetype: 'friendly', x: 540, y: 360 }, // 100 px left of the cursor
      { archetype: 'scaredy', x: 740, y: 360 }, // 100 px right of the cursor
    ])
    play(world, () => cursor, 4)
    const friendly = distance(world, 0, cursor.x, cursor.y)
    const scaredy = distance(world, 1, cursor.x, cursor.y)
    expect(world.creatures[0]!.mind.emotion.kind).toBe('curious')
    expect(friendly).toBeLessThan(110) // came close and hovers near the approach distance
    // Measured: Friendly ≈ 80 px, Scaredy ≈ 160 px (it backs off, then relaxes as trust builds).
    expect(scaredy).toBeGreaterThan(friendly + 50)
  })

  it('a sudden movement makes the Grumpy stand its ground while the Scaredy flees', () => {
    const world = staged([
      { archetype: 'grumpy', x: 450, y: 400 },
      { archetype: 'scaredy', x: 850, y: 400 },
    ])
    const start = world.creatures.map((c) => ({ ...c.position }))
    // A fast flick along y = 280 (≈ 120 px above both), then the visitor leaves.
    const flick: Cursor = (t) => (t < 0.3 ? { x: 250 + 2400 * t, y: 280 } : null)

    let grumpyFelt = false
    let scaredyFelt = false
    play(world, flick, 1.5, (t) => {
      if (t < 0.6) {
        grumpyFelt ||= world.creatures[0]!.mind.emotion.kind === 'grumpy'
        scaredyFelt ||= world.creatures[1]!.mind.emotion.kind === 'scared'
      }
    })
    const moved = world.creatures.map((c, i) =>
      Math.hypot(c.position.x - start[i]!.x, c.position.y - start[i]!.y),
    )
    expect(grumpyFelt).toBe(true)
    expect(scaredyFelt).toBe(true)
    expect(moved[0]).toBeLessThan(25) // held its ground
    expect(moved[1]).toBeGreaterThan(60) // fled
  })
})

describe('personalities', () => {
  it('a Peeker peeks: under a calm presence it creeps in and darts back out', () => {
    const cursor = { x: 640, y: 360 }
    const world = staged([{ archetype: 'peeker', x: 640, y: 210 }]) // 150 px above the cursor
    let cameClose = false
    let backedOff = false
    play(
      world,
      () => cursor,
      10,
      () => {
        const d = distance(world, 0, cursor.x, cursor.y)
        if (d < 115) cameClose = true
        if (cameClose && d > 190) backedOff = true
      },
    )
    expect(cameClose).toBe(true)
    expect(backedOff).toBe(true)
  })

  it('a Grumpy ignores a calm presence (stays content)', () => {
    const world = staged([{ archetype: 'grumpy', x: 540, y: 360 }])
    play(world, () => ({ x: 640, y: 360 }), 3)
    expect(world.creatures[0]!.mind.emotion.kind).toBe('content')
  })

  it('a startled Scaredy hides in the corner farthest from the visitor', () => {
    const world = staged([{ archetype: 'scaredy', x: 400, y: 300 }])
    // Flick right next to it near the top-left, then stay still there.
    const cursor: Cursor = (t) => (t < 0.2 ? { x: 200 + 3000 * t, y: 200 } : { x: 300, y: 200 })
    let hid = false
    play(world, cursor, 0.5, () => {
      hid ||= world.creatures[0]!.mind.intent === 'hide'
    })
    expect(hid).toBe(true)
    const target = world.creatures[0]!.mind.hideTarget
    expect(target.x).toBeGreaterThan(640) // right half…
    expect(target.y).toBeGreaterThan(360) // …bottom half: the far corner
  })
})

describe('invariants with a visitor present', () => {
  it('chasing and flicking for 30 s: bounds, no visible overlap, personal speed limits — every step', () => {
    for (const seed of [1, 42, 2024]) {
      const world = createWorld({ seed, width: 1280, height: 720, creatureCount: 5 })
      // Chase creature 1 from 120 px behind, with a big flick every 5 s.
      const cursor: Cursor = (t) => {
        if (t % 5 < 0.25) return { x: 100 + 4000 * (t % 5), y: 360 }
        const c = world.creatures[0]!
        return { x: c.position.x - 120, y: c.position.y }
      }
      play(world, cursor, 30, () => {
        const fs = world.creatures.map((c) => footprint(c.position, c.size))
        for (const f of fs) {
          expect(f.x - f.radius).toBeGreaterThanOrEqual(-1e-6)
          expect(f.x + f.radius).toBeLessThanOrEqual(world.width + 1e-6)
          expect(f.y - f.radius).toBeGreaterThanOrEqual(-1e-6)
          expect(f.y + f.radius).toBeLessThanOrEqual(world.height + 1e-6)
        }
        for (let i = 0; i < fs.length; i++) {
          for (let j = i + 1; j < fs.length; j++) {
            const a = fs[i]!
            const b = fs[j]!
            expect(a.radius + b.radius - Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(0.5)
          }
        }
        for (const c of world.creatures) {
          expect(Math.hypot(c.velocity.x, c.velocity.y)).toBeLessThanOrEqual(speedLimit(c) + 1e-9)
        }
      })
    }
  })
})
