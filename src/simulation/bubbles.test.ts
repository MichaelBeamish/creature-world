import { describe, expect, it } from 'vitest'
import { bubbleAt, BUBBLES, stepBubbles, type Bubble } from './bubbles'
import type { IntentKind } from './mindState'
import { createWorld, stepWorld, type World } from './world'
import { setPresenceInput } from './presence'

const DT = 1 / 60

function oneCreature(): World {
  const world = createWorld({ seed: 11, width: 1280, height: 720, creatureCount: 1 })
  const c = world.creatures[0]!
  c.position.x = 640
  c.position.y = 400
  return world
}

const live = (world: World) => world.bubbles.pool.filter((b) => b.active)

/** Step only the bubble system, with the creature's intent and speed forced (isolates the spawn rules). */
function act(world: World, intent: IntentKind, seconds: number, speed = 0) {
  const c = world.creatures[0]!
  c.mind.intent = intent
  c.velocity.x = speed
  c.velocity.y = 0
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    stepBubbles(world, DT)
    world.time += DT
  }
}

describe('spawning', () => {
  it('a creature that starts fleeing or hiding releases a small burst (BUBBLES.burst)', () => {
    for (const scared of ['flee', 'hide'] as const) {
      const world = oneCreature()
      act(world, 'wander', 0.5)
      expect(live(world)).toHaveLength(0)
      act(world, scared, DT) // one step: the burst only (slow, so no trickle)
      expect(live(world).length).toBeGreaterThanOrEqual(BUBBLES.burst[0])
      expect(live(world).length).toBeLessThanOrEqual(BUBBLES.burst[1])
    }
  })

  it('calm and curious creatures release nothing', () => {
    const world = oneCreature()
    for (const intent of ['wander', 'rest', 'approach', 'peek'] as const) act(world, intent, 1)
    expect(live(world)).toHaveLength(0)
  })

  it('a Grumpy huffs exactly BUBBLES.huff bubble(s) when it squares up', () => {
    const world = oneCreature()
    act(world, 'wander', 0.3)
    act(world, 'standoff', 1)
    expect(live(world)).toHaveLength(BUBBLES.huff)
  })

  it('a fast-fleeing creature leaves a trickle (~1 per BUBBLES.trickleEvery); a slow one does not', () => {
    const fast = oneCreature()
    act(fast, 'wander', 0.2)
    act(fast, 'flee', 3, 80)
    const burstMax = BUBBLES.burst[1]
    const fastCount = fast.bubbles.pool.filter((b) => b.bornAt > 0).length
    expect(fastCount - burstMax).toBeGreaterThanOrEqual(Math.floor(3 / BUBBLES.trickleEvery[1]) - 1)
    expect(fastCount).toBeLessThanOrEqual(
      BUBBLES.burst[1] + Math.ceil(3 / BUBBLES.trickleEvery[0]) + 1,
    )

    const slow = oneCreature()
    act(slow, 'wander', 0.2)
    act(slow, 'flee', 3, 10) // below trickleSpeed
    expect(slow.bubbles.pool.filter((b) => b.bornAt > 0).length).toBeLessThanOrEqual(
      BUBBLES.burst[1],
    )
  })
})

describe('bubbleAt (analytic motion)', () => {
  const bubble: Bubble = {
    active: true,
    bornAt: 10,
    x0: 300,
    y0: 600,
    radius0: 4,
    rise: 50,
    wobbleAmp: 5,
    wobbleHz: 1.5,
    phase: 0,
    life: 3,
  }

  it('rises steadily, wobbles within its amplitude, and grows', () => {
    let lastY = Infinity
    for (let t = 10; t < 12.9; t += 0.1) {
      const s = bubbleAt(bubble, t)
      expect(s.state).toBe('rising')
      expect(s.y).toBeLessThan(lastY)
      expect(Math.abs(s.x - bubble.x0)).toBeLessThanOrEqual(bubble.wobbleAmp + 1e-9)
      lastY = s.y
    }
    expect(bubbleAt(bubble, 12.9).radius).toBeGreaterThan(bubbleAt(bubble, 10.1).radius)
  })

  it('pops at the end of its life, then is gone', () => {
    expect(bubbleAt(bubble, 13.05).state).toBe('popping')
    expect(bubbleAt(bubble, 13 + BUBBLES.popDuration + 0.01).state).toBe('gone')
  })

  it('pops early when it reaches the surface, and never goes above it', () => {
    const shallow = { ...bubble, y0: 60, life: 10 }
    let popped = false
    for (let t = 10; t < 13; t += 0.02) {
      const s = bubbleAt(shallow, t)
      expect(s.y).toBeGreaterThanOrEqual(BUBBLES.surface - 1e-6)
      if (s.state === 'popping') popped = true
    }
    expect(popped).toBe(true)
  })

  it('has no wobble under reduced motion', () => {
    for (let t = 10; t < 12; t += 0.1) expect(bubbleAt(bubble, t, 0).x).toBe(bubble.x0)
  })
})

describe('pool and determinism', () => {
  it('never exceeds the pool, reuses the same slot objects, and allocates nothing per step', () => {
    const world = oneCreature()
    const pool = world.bubbles.pool
    const slots = [...pool]
    for (let i = 0; i < 120; i++) {
      act(world, i % 2 ? 'flee' : 'wander', 0.25, 90) // scare it constantly for 30 s
      expect(live(world).length).toBeLessThanOrEqual(BUBBLES.capacity)
    }
    expect(world.bubbles.pool).toBe(pool) // same array…
    expect(world.bubbles.pool).toHaveLength(BUBBLES.capacity)
    world.bubbles.pool.forEach((b, i) => expect(b).toBe(slots[i])) // …and the same slot objects
  })

  it('uses its own random stream: releasing bubbles never touches the creatures’ rng', () => {
    const world = oneCreature()
    const before = world.rng.state
    act(world, 'wander', 0.2)
    act(world, 'flee', 2, 90)
    act(world, 'standoff', 0.5)
    expect(world.rng.state).toBe(before)
  })

  it('is deterministic in the full world with a scripted visitor', () => {
    const run = () => {
      const world = createWorld({ seed: 42, width: 1280, height: 720, creatureCount: 5 })
      for (let i = 0; i < 600; i++) {
        const t = i * DT
        const flick = t % 2 < 0.25
        setPresenceInput(
          world.presence,
          flick ? 100 + 4000 * (t % 2) : 640,
          flick ? 300 : 360,
          true,
        )
        stepWorld(world, DT)
      }
      return world
    }
    const a = run()
    expect(a).toEqual(run())
    expect(a.bubbles.pool.some((b) => b.bornAt > 0)).toBe(true) // flicks really produced bubbles
  })
})
