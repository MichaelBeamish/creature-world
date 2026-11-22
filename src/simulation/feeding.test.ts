import { describe, expect, it } from 'vitest'
import { FEEDING, feedingStyle } from './feeding'
import { setPresenceInput } from './presence'
import { countOf, dropProp } from './props'
import { ARCHETYPES, type Archetype } from './traits'
import { createWorld, stepWorld, type World } from './world'

const DT = 1 / 60

/** A world with the given cast (exact dials, mid energy) and a shrimp dropped at (640, 300) after 0.5 s. */
function feed(
  cast: [Archetype, number, number][],
  hand: (t: number) => { x: number; y: number; on: boolean },
  seconds = 20,
  each?: (w: World) => void,
) {
  const world = createWorld({ seed: 4, width: 1280, height: 720, creatureCount: cast.length })
  world.creatures.forEach((c, i) => {
    const [a, x, y] = cast[i]!
    c.archetype = a
    c.traits = { ...ARCHETYPES[a], energy: 0.6 }
    c.size = 30
    c.position.x = c.prevPosition.x = x
    c.position.y = c.prevPosition.y = y
  })
  const eaters: { who: Archetype; at: number }[] = []
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    if (i === 30) dropProp(world, 'shrimp', 640, 300)
    const h = hand(world.time)
    setPresenceInput(world.presence, h.x, h.y, h.on, false)
    const n = world.interaction.sounds.length
    stepWorld(world, DT)
    for (const s of world.interaction.sounds.slice(n)) {
      if (s.kind === 'nom') {
        eaters.push({
          who: world.creatures.find((c) => c.id === s.creatureId)!.archetype,
          at: world.time,
        })
      }
    }
    each?.(world)
  }
  return { world, eaters }
}

const away = () => ({ x: 0, y: 0, on: false })
const atFood = () => ({ x: 640, y: 600, on: true })
const leavesAt = (s: number) => (t: number) => ({ x: 640, y: 600, on: t < s })

describe('feeding styles come from the trait dials', () => {
  it('Friendly races, Peeker sneaks, Scaredy creeps, Grumpy guards', () => {
    const style = (a: Archetype) =>
      feedingStyle({ traits: { ...ARCHETYPES[a], energy: 0.5 } } as Parameters<
        typeof feedingStyle
      >[0])
    expect(style('friendly')).toBe('race')
    expect(style('peeker')).toBe('sneak')
    expect(style('scaredy')).toBe('creep')
    expect(style('grumpy')).toBe('guard')
  })
})

describe('who eats the shrimp', () => {
  it('a Friendly races in and eats it — first among Friendly, Peeker and Scaredy', () => {
    const { eaters, world } = feed(
      [
        ['friendly', 250, 220],
        ['peeker', 1030, 220],
        ['scaredy', 250, 450],
      ],
      away,
    )
    expect(eaters[0]?.who).toBe('friendly')
    expect(eaters[0]!.at).toBeLessThan(8)
    expect(eaters).toHaveLength(1) // eaten once
    expect(countOf(world, 'shrimp')).toBe(0)
  })

  it('a Peeker sneaks in only while the hand is away from the food', () => {
    expect(feed([['peeker', 250, 220]], atFood).eaters).toHaveLength(0)
    const left = feed([['peeker', 250, 220]], leavesAt(6)).eaters
    expect(left).toHaveLength(1)
    expect(left[0]!.at).toBeGreaterThan(6)
  })

  it('a Scaredy waits until the hand has gone, then creeps in', () => {
    expect(feed([['scaredy', 250, 220]], atFood).eaters).toHaveLength(0)
    const left = feed([['scaredy', 250, 220]], leavesAt(6), 25).eaters
    expect(left).toHaveLength(1)
    expect(left[0]!.at).toBeGreaterThan(6 + FEEDING.scaredyWait)
  })

  it('a Grumpy guards it first (glaring), then eats — and nobody else eats while it guards', () => {
    let guarded = false
    let otherAteWhileGuarded = false
    const { eaters } = feed(
      [
        ['friendly', 150, 220],
        ['grumpy', 700, 250],
      ],
      away,
      15,
      (w) => {
        const g = w.creatures[1]!
        if (g.mind.intent === 'guard') guarded = true
        if (g.mind.intent === 'guard' && countOf(w, 'shrimp') === 0) otherAteWhileGuarded = true
      },
    )
    expect(guarded).toBe(true)
    expect(otherAteWhileGuarded).toBe(false)
    expect(eaters.map((e) => e.who)).toEqual(['grumpy'])
  })

  it('eating: the shrimp is gone, a ♥ and a squish', () => {
    let heart = false
    let squished = false
    feed([['friendly', 250, 220]], away, 10, (w) => {
      const c = w.creatures[0]!
      if (countOf(w, 'shrimp') === 0 && w.time > 1) {
        heart ||= c.expression.emote?.kind === 'heart'
        squished ||= c.anim.squash > 0.05
      }
    })
    expect(heart).toBe(true)
    expect(squished).toBe(true)
  })

  it('a scared creature ignores food', () => {
    let wentForFood = false
    feed([['friendly', 250, 220]], away, 6, (w) => {
      const c = w.creatures[0]!
      c.perception.startle = 1 // keep it frightened
      if (c.mind.intent === 'eat' || c.mind.intent === 'guard') wentForFood = true
    })
    expect(wentForFood).toBe(false)
  })
})
