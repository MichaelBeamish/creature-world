import { describe, expect, it } from 'vitest'
import type { EmotionKind } from './emotion'
import { EXPRESSION, stepExpression } from './expression'
import { setPresenceInput } from './presence'
import { ARCHETYPE_DECK, ARCHETYPES, type Archetype } from './traits'
import { createWorld, stepWorld, type World } from './world'

const DT = 1 / 60

function staged(cast: { archetype: Archetype; x: number; y: number }[]): World {
  const world = createWorld({ seed: 9, width: 1280, height: 720, creatureCount: cast.length })
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

/** Step only the expression of creature 0 with a forced emotion (isolates emote rules from the mind). */
function feel(world: World, kind: EmotionKind, seconds: number) {
  const c = world.creatures[0]!
  c.mind.emotion.kind = kind
  for (let i = 0; i < Math.round(seconds / DT); i++) stepExpression(c, world, DT)
}

describe('MVP success criterion #2: a visible reaction within 1 s', () => {
  for (const archetype of ARCHETYPE_DECK) {
    it(`a ${archetype} looks at a cursor that appears nearby, or shows an emote, within 1 s`, () => {
      const world = staged([{ archetype, x: 640, y: 360 }])
      const cursor = { x: 790, y: 360 } // 150 px to the right
      let reactedAt = Infinity
      for (let i = 0; i < 60; i++) {
        setPresenceInput(world.presence, cursor.x, cursor.y, true)
        stepWorld(world, DT)
        const c = world.creatures[0]!
        const g = c.expression.gaze
        const toCursor = Math.atan2(cursor.y - c.position.y, cursor.x - c.position.x)
        let angle = Math.abs(Math.atan2(g.y, g.x) - toCursor)
        if (angle > Math.PI) angle = 2 * Math.PI - angle
        const looking = Math.hypot(g.x, g.y) > 0.5 && angle < Math.PI / 6
        if (looking || c.expression.emote) {
          reactedAt = Math.min(reactedAt, world.time)
        }
      }
      expect(reactedAt).toBeLessThanOrEqual(1)
    })
  }
})

describe('emotes', () => {
  it('maps entering each emotion to its emote, and content to none', () => {
    const world = staged([{ archetype: 'friendly', x: 640, y: 360 }])
    const c = world.creatures[0]!
    const cases: [EmotionKind, string][] = [
      ['curious', 'question'],
      ['scared', 'exclaim'],
      ['grumpy', 'anger'],
    ]
    for (const [emotion, emote] of cases) {
      feel(world, 'content', EXPRESSION.emoteCooldown + 0.1) // back to calm, cooldown over
      expect(c.expression.emote).toBeNull()
      feel(world, emotion, DT)
      expect(c.expression.emote?.kind).toBe(emote)
    }
  })

  it('an emote lasts ~1.5 s', () => {
    const world = staged([{ archetype: 'grumpy', x: 640, y: 360 }])
    feel(world, 'grumpy', DT)
    expect(world.creatures[0]!.expression.emote).not.toBeNull()
    feel(world, 'grumpy', EXPRESSION.emoteLife - 0.1)
    expect(world.creatures[0]!.expression.emote).not.toBeNull()
    feel(world, 'grumpy', 0.2)
    expect(world.creatures[0]!.expression.emote).toBeNull()
  })

  it('cooldown: rapid mood changes produce at most one emote per 2.5 s', () => {
    const world = staged([{ archetype: 'peeker', x: 640, y: 360 }])
    const c = world.creatures[0]!
    let shown = 0
    let last: object | null = null
    const moods: EmotionKind[] = ['curious', 'scared', 'curious', 'scared', 'content', 'scared']
    for (const mood of moods) {
      feel(world, mood, 0.3) // a new mood every 0.3 s for 1.8 s
      if (c.expression.emote && c.expression.emote !== last) {
        shown++
        last = c.expression.emote
      }
    }
    expect(shown).toBe(1)
  })

  it('a Friendly gives ♥ to a trusted visitor once per visit', () => {
    const world = staged([{ archetype: 'friendly', x: 640, y: 360 }])
    const c = world.creatures[0]!
    const hearts = new Set<object>()
    /** Hold the creature curious, close, and trusting for a while; collect distinct ♥ emotes. */
    const visit = (seconds: number) => {
      c.mind.emotion.kind = 'curious'
      c.expression.lastEmotion = 'curious' // already curious: only affection can trigger an emote
      Object.assign(c.perception, { attention: 0.9, trust: 0.9, distance: 80 })
      for (let i = 0; i < Math.round(seconds / DT); i++) {
        stepExpression(c, world, DT)
        if (c.expression.emote?.kind === 'heart') hearts.add(c.expression.emote)
      }
    }

    visit(6)
    expect(hearts.size).toBe(1) // once, even though the conditions held for 6 s

    c.perception.attention = 0 // the visitor leaves: the visit is over
    stepExpression(c, world, DT)
    visit(6)
    expect(hearts.size).toBe(2) // a new visit earns a new ♥
  })

  it('a timid creature never gives ♥', () => {
    const world = staged([{ archetype: 'peeker', x: 640, y: 360 }])
    const c = world.creatures[0]!
    c.mind.emotion.kind = 'curious'
    c.expression.lastEmotion = 'curious'
    Object.assign(c.perception, { attention: 0.9, trust: 1, distance: 60 })
    for (let i = 0; i < 300; i++) stepExpression(c, world, DT)
    expect(c.expression.heartGiven).toBe(false)
  })
})

describe('gaze', () => {
  it('a content creature without a visitor looks where it is going', () => {
    const world = staged([{ archetype: 'scaredy', x: 640, y: 360 }])
    const c = world.creatures[0]!
    c.velocity.x = 30
    c.velocity.y = 0
    feel(world, 'content', 1)
    expect(c.expression.gaze.x).toBeGreaterThan(0.4)
    expect(Math.abs(c.expression.gaze.y)).toBeLessThan(0.1)
  })

  it('content creatures sometimes glance at a nearby neighbour (deterministically)', () => {
    const run = () => {
      const world = staged([
        { archetype: 'grumpy', x: 500, y: 360 },
        { archetype: 'scaredy', x: 700, y: 360 },
      ])
      const c = world.creatures[0]!
      const glancedAt = new Set<number>()
      for (let i = 0; i < Math.round(20 / DT); i++) {
        c.mind.emotion.kind = 'content'
        stepExpression(c, world, DT)
        if (c.expression.glance) glancedAt.add(c.expression.glance.targetId)
      }
      return [...glancedAt]
    }
    expect(run()).toEqual([2])
    expect(run()).toEqual(run())
  })
})

describe('mood drives animation speed', () => {
  it('breathing speeds up when scared and returns to its base rate', () => {
    const world = staged([{ archetype: 'scaredy', x: 640, y: 360 }])
    const c = world.creatures[0]!
    c.mind.emotion.levels.scared = 1
    stepExpression(c, world, DT)
    expect(c.anim.breathRate).toBeCloseTo(
      c.anim.breathBase * (1 + EXPRESSION.breathBoost.scared),
      9,
    )
    c.mind.emotion.levels.scared = 0
    c.mind.emotion.levels.curious = 0
    stepExpression(c, world, DT)
    expect(c.anim.breathRate).toBeCloseTo(c.anim.breathBase, 9)
  })
})
