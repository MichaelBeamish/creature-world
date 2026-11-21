import { describe, expect, it } from 'vitest'
import { createPerception, stepPerception, type Perception } from './perception'
import { createPresence, setPresenceInput, updatePresence, type Presence } from './presence'
import { vec2 } from './vec2'
import { createWorld, stepWorld } from './world'

const DT = 1 / 60
const CREATURE = vec2(500, 400)

/** A scripted cursor: returns the cursor position (or null = absent) for a given time in seconds. */
type CursorPath = (t: number) => { x: number; y: number } | null

/** Drive presence + perception for one stationary creature; returns perception and a per-step log. */
function run(
  path: CursorPath,
  seconds: number,
  start: { perception?: Perception; presence?: Presence } = {},
) {
  const presence = start.presence ?? createPresence()
  const perception = start.perception ?? createPerception()
  const log: Perception[] = []
  const steps = Math.round(seconds / DT)
  for (let i = 0; i < steps; i++) {
    const p = path(i * DT)
    setPresenceInput(presence, p?.x ?? 0, p?.y ?? 0, p !== null)
    updatePresence(presence, DT)
    stepPerception(perception, CREATURE, presence, DT)
    log.push({ ...perception })
  }
  return { perception, presence, log }
}

const stillAt =
  (x: number, y: number): CursorPath =>
  () => ({ x, y })
const absent: CursorPath = () => null

describe('attention', () => {
  it('rises above 0.8 within 0.5 s when the cursor is close', () => {
    const { perception } = run(stillAt(CREATURE.x + 40, CREATURE.y), 0.5)
    expect(perception.attention).toBeGreaterThan(0.8)
  })

  it('decays below 0.2 within 3 s once the cursor is out of range', () => {
    const near = run(stillAt(CREATURE.x + 40, CREATURE.y), 1)
    const far = run(stillAt(CREATURE.x + 1000, CREATURE.y), 3, near)
    expect(far.perception.attention).toBeLessThan(0.2)
  })

  it('stays at zero when the visitor is absent', () => {
    const { perception } = run(absent, 2)
    expect(perception.attention).toBe(0)
    expect(perception.distance).toBe(Infinity)
    expect(perception.stimulus).toBe('none')
  })

  it('rises faster than it decays (attack/release)', () => {
    const rise = run(stillAt(CREATURE.x + 40, CREATURE.y), 0.3).perception.attention
    const full = run(stillAt(CREATURE.x + 40, CREATURE.y), 2)
    const fall = run(absent, 0.3, full).perception.attention
    expect(rise).toBeGreaterThan(0.6) // gained a lot in 0.3 s…
    expect(fall).toBeGreaterThan(0.6) // …but loses little in 0.3 s
  })
})

describe('stimulus classification', () => {
  it('hovering still nearby is a calm presence, and trust builds over seconds', () => {
    const { perception, log } = run(stillAt(CREATURE.x + 100, CREATURE.y - 50), 4)
    expect(perception.stimulus).toBe('calm')
    expect(log[60]!.trust).toBeGreaterThan(0.2) // ~1 s in
    expect(log[60]!.trust).toBeLessThan(0.3)
    expect(perception.trust).toBeGreaterThan(0.95) // ~4 s in
  })

  it('a fast flick past the creature is sudden within a few steps', () => {
    // Sweep from far left to far right at 2400 px/s, passing 60 px above the creature.
    const flick: CursorPath = (t) => ({ x: CREATURE.x - 400 + 2400 * t, y: CREATURE.y - 60 })
    const { log } = run(flick, 0.4)
    const firstSudden = log.findIndex((p) => p.stimulus === 'sudden')
    expect(firstSudden).toBeGreaterThanOrEqual(0)
    expect(firstSudden).toBeLessThan(10)
    expect(log.some((p) => p.startle === 1)).toBe(true)
  })

  it('startle fades within about 0.6 s after the flick', () => {
    const flick: CursorPath = (t) =>
      t < 0.3
        ? { x: CREATURE.x - 400 + 2400 * t, y: CREATURE.y - 60 }
        : { x: CREATURE.x + 400, y: CREATURE.y - 60 }
    const { perception } = run(flick, 1.2)
    expect(perception.startle).toBe(0)
    expect(perception.stimulus).not.toBe('sudden')
  })

  it('steadily following the creature becomes chasing within 1.5 s', () => {
    // Cursor starts 230 px away and moves toward the creature at 120 px/s.
    const follow: CursorPath = (t) => ({ x: CREATURE.x + 230 - 120 * t, y: CREATURE.y })
    const { log } = run(follow, 1.5)
    const firstChasing = log.findIndex((p) => p.stimulus === 'chasing')
    expect(firstChasing).toBeGreaterThanOrEqual(0)
    expect(firstChasing * DT).toBeLessThan(1.5)
  })

  it('moving past (not toward) the creature does not count as chasing', () => {
    const passBy: CursorPath = (t) => ({ x: CREATURE.x - 200 + 120 * t, y: CREATURE.y + 150 })
    const { log } = run(passBy, 2)
    expect(log.some((p) => p.stimulus === 'chasing')).toBe(false)
  })

  it('a cursor far away or absent is "none"', () => {
    expect(run(stillAt(CREATURE.x + 900, CREATURE.y), 2).perception.stimulus).toBe('none')
    expect(run(absent, 2).perception.stimulus).toBe('none')
  })

  it('sudden takes priority over chasing', () => {
    // Rush straight at the creature very fast: both conditions hold, sudden wins.
    const rush: CursorPath = (t) => ({ x: CREATURE.x + 239 - 1500 * t, y: CREATURE.y })
    const { log } = run(rush, 0.1)
    expect(log.at(-1)!.stimulus).toBe('sudden')
  })
})

describe('in the world', () => {
  const CONFIG = { seed: 42, width: 1280, height: 720, creatureCount: 5 }
  /** A scripted cursor tour across the pool: slow hover, a flick, then a slow drift. */
  const tour: CursorPath = (t) =>
    t < 2
      ? { x: 400, y: 300 }
      : t < 2.3
        ? { x: 400 + 2000 * (t - 2), y: 300 }
        : { x: 1000 - 30 * (t - 2.3), y: 350 }

  function scripted(seconds: number) {
    const world = createWorld(CONFIG)
    for (let i = 0; i < Math.round(seconds / DT); i++) {
      const p = tour(i * DT)
      setPresenceInput(world.presence, p!.x, p!.y, true)
      stepWorld(world, DT)
    }
    return world
  }

  it('is deterministic: same seed + same scripted cursor → identical world', () => {
    expect(scripted(5)).toEqual(scripted(5))
  })

  it('does not change behavior yet: creatures move exactly as with no visitor', () => {
    const withVisitor = scripted(5)
    const without = createWorld(CONFIG)
    for (let i = 0; i < Math.round(5 / DT); i++) stepWorld(without, DT)
    expect(withVisitor.creatures.map((c) => c.position)).toEqual(
      without.creatures.map((c) => c.position),
    )
    expect(withVisitor.creatures.some((c) => c.perception.attention > 0)).toBe(true)
  })
})
