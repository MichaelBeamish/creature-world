import { describe, expect, it } from 'vitest'
import { CHEER_UP, cheerUpPhase } from './cheerUp'
import { danceStyle } from './dance'
import { ARCHETYPES, type Archetype } from './traits'
import { wearOn } from './wearables'
import { createWorld, stepWorld, type World } from './world'

const DT = 1 / 60

function make(archetype: Archetype): World {
  const world = createWorld({ seed: 4, width: 1280, height: 720, creatureCount: 1 })
  const c = world.creatures[0]!
  c.archetype = archetype
  c.traits = { ...ARCHETYPES[archetype], energy: 0.42 }
  c.size = 30
  c.position.x = c.prevPosition.x = 640
  c.position.y = c.prevPosition.y = 300
  return world
}

const run = (w: World, seconds: number) => {
  for (let t = 0; t < seconds; t += DT) stepWorld(w, DT)
}

describe('cheering up the Grumpy with the rose (task #38)', () => {
  it('the rose starts the moment: sceptical first (a "?", still flushed, holding still)', () => {
    const w = make('grumpy')
    const c = w.creatures[0]!
    wearOn(w, c, 'rose')
    run(w, 1)
    expect(cheerUpPhase(c, w.time)).toBe('doubt')
    expect(c.expression.emote?.kind).toBe('question')
    expect(c.mind.emotion.levels.grumpy).toBeGreaterThan(CHEER_UP.doubtFlush - 0.05) // (the mood eases a hair each step)
    expect(c.mind.intent).toBe('rest')
    expect(c.archetype).toBe('grumpy') // not yet
  })

  it('then perks up ("!", the flush drains), then hearts — and becomes a Friendly', () => {
    const w = make('grumpy')
    const c = w.creatures[0]!
    wearOn(w, c, 'rose')
    run(w, CHEER_UP.doubt + 0.2)
    expect(cheerUpPhase(c, w.time)).toBe('perk')
    expect(c.expression.emote?.kind).toBe('exclaim')
    run(w, CHEER_UP.perk - 0.3)
    expect(c.mind.emotion.levels.grumpy).toBeLessThan(0.2)
    run(w, 0.3)
    expect(cheerUpPhase(c, w.time)).toBe('hearts')
    expect(c.expression.emote?.kind).toBe('heart')
    expect(c.archetype).toBe('friendly')
  })

  it("doesn't shake the rose off — and keeps it afterwards", () => {
    const w = make('grumpy')
    const c = w.creatures[0]!
    wearOn(w, c, 'rose')
    run(w, 10)
    expect(c.dress.hand).toBe('rose')
    expect(c.dress.shakingSince).toBe(-Infinity)
  })

  it('afterwards he is a Friendly through and through (his own color and energy kept)', () => {
    const w = make('grumpy')
    const c = w.creatures[0]!
    const hue = c.hue
    wearOn(w, c, 'rose')
    run(w, CHEER_UP.doubt + CHEER_UP.perk + CHEER_UP.hearts + 0.5)
    expect(c.cheerUp).toBeNull()
    expect(c.traits).toEqual({ ...ARCHETYPES.friendly, energy: 0.42 })
    expect(c.hue).toBe(hue)
    expect(danceStyle(c)).toBe('bounce')
    // A Friendly doesn't mind wearing things: a hat stays on.
    wearOn(w, c, 'wizardHat')
    run(w, 8)
    expect(c.dress.head).toBe('wizardHat')
  })

  it('the rose on anyone else is just a rose', () => {
    for (const a of ['friendly', 'peeker', 'scaredy'] as const) {
      const w = make(a)
      const c = w.creatures[0]!
      wearOn(w, c, 'rose')
      run(w, 1)
      expect(c.cheerUp).toBeNull()
      expect(c.archetype).toBe(a)
    }
  })

  it('anything else still gets shaken off by the Grumpy', () => {
    const w = make('grumpy')
    const c = w.creatures[0]!
    wearOn(w, c, 'tiara')
    run(w, 6)
    expect(c.dress.head).toBeNull()
    expect(c.cheerUp).toBeNull()
  })
})
