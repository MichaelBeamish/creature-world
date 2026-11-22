import { describe, expect, it } from 'vitest'
import { setPresenceInput } from './presence'
import {
  canTake,
  CHEST_PAGES,
  chestBox,
  countOf,
  dropProp,
  outCount,
  pageItems,
  PROPS,
  slotAt,
  slotPosition,
  SLOT_COUNT,
  toggleChest,
  turnPage,
} from './props'
import { ARCHETYPES, type Archetype } from './traits'
import { isDressed, spotPosition, WEAR, wearOn } from './wearables'
import { createWorld, stepWorld, type World } from './world'

const DT = 1 / 60

function make(cast: [Archetype, number, number][]): World {
  const world = createWorld({ seed: 4, width: 1280, height: 720, creatureCount: cast.length })
  world.creatures.forEach((c, i) => {
    const [a, x, y] = cast[i]!
    c.archetype = a
    c.traits = { ...ARCHETYPES[a], energy: 0.6 }
    c.size = 30
    c.position.x = c.prevPosition.x = x
    c.position.y = c.prevPosition.y = y
  })
  return world
}

/** Scripted hand: [x, y, pressed] per step. */
function hand(w: World, steps: [number, number, boolean][]) {
  for (const [x, y, pressed] of steps) {
    setPresenceInput(w.presence, x, y, true, pressed)
    stepWorld(w, DT)
  }
}

/** Press at `from`, carry to `to`, release there. */
function dragTo(w: World, from: { x: number; y: number }, to: { x: number; y: number }) {
  hand(w, [
    [from.x, from.y, false],
    [from.x, from.y, true],
    [to.x, to.y, true],
    [to.x, to.y, false],
  ])
}

describe('chest pages', () => {
  it('the ↻ circle turns to the next page, wrapping round', () => {
    const w = make([])
    toggleChest(w)
    expect(pageItems(w)).toEqual(['shrimp', 'duck', 'ball'])
    const next = slotPosition(w, SLOT_COUNT - 1)
    expect(slotAt(w, next.x, next.y)).toBe('next')
    for (let i = 1; i <= CHEST_PAGES.length; i++) {
      hand(w, [
        [next.x, next.y, false],
        [next.x, next.y, true],
        [next.x, next.y, false],
      ])
      expect(w.props.chest.page).toBe(i % CHEST_PAGES.length)
    }
    expect(pageItems(w)).toEqual(['shrimp', 'duck', 'ball']) // back to the start
  })

  it('every page shows at most 3 items, and every item is on exactly one page', () => {
    const all = CHEST_PAGES.flat()
    for (const page of CHEST_PAGES) expect(page.length).toBeLessThanOrEqual(3)
    expect(new Set(all).size).toBe(all.length)
    expect(all).toHaveLength(21) // shrimp, duck, ball + 18 wearables
  })

  it('a circle with no item on its page gives nothing', () => {
    const w = make([])
    toggleChest(w)
    // Visit every page once (bounded — never loop "until" a short page: there may not be one).
    for (let page = 0; page < CHEST_PAGES.length; page++) {
      const items = pageItems(w)
      for (let i = 0; i < SLOT_COUNT - 1; i++) {
        const s = slotPosition(w, i)
        expect(slotAt(w, s.x, s.y)).toBe(items[i] ?? null) // the item, or nothing on a short page
      }
      turnPage(w)
    }
  })
})

describe('wearing', () => {
  it('dropping a wearable on a creature puts it on, in its spot', () => {
    const w = make([['friendly', 640, 300]])
    toggleChest(w)
    turnPage(w) // wizard hat, cowboy hat, pirate hat
    dragTo(w, slotPosition(w, 0), { x: 640, y: 300 })
    expect(w.creatures[0]!.dress.head).toBe('wizardHat')
  })

  it('dropping a second hat swaps the first off (it falls)', () => {
    const w = make([['friendly', 640, 300]])
    const c = w.creatures[0]!
    wearOn(w, c, 'wizardHat')
    wearOn(w, c, 'cowboyHat')
    expect(c.dress.head).toBe('cowboyHat')
    expect(countOf(w, 'wizardHat')).toBe(1) // in the water, sinking
  })

  it('the nose glasses fill both eyes and face (swapping out glasses and a beard)', () => {
    const w = make([['friendly', 640, 300]])
    const c = w.creatures[0]!
    wearOn(w, c, 'starGlasses')
    wearOn(w, c, 'beard')
    wearOn(w, c, 'noseGlasses')
    expect([c.dress.eyes, c.dress.face]).toEqual(['noseGlasses', 'noseGlasses'])
    expect(countOf(w, 'starGlasses') + countOf(w, 'beard')).toBe(2)
  })

  it('one per spot, so a hat, glasses and a mustache can all be worn at once', () => {
    const w = make([['friendly', 640, 300]])
    const c = w.creatures[0]!
    wearOn(w, c, 'cowboyHat')
    wearOn(w, c, 'starGlasses')
    wearOn(w, c, 'beard')
    expect([c.dress.head, c.dress.eyes, c.dress.face]).toEqual([
      'cowboyHat',
      'starGlasses',
      'beard',
    ])
  })

  it('a worn item can be taken off and moved to another creature', () => {
    const w = make([
      ['friendly', 400, 300],
      ['peeker', 900, 300],
    ])
    const [a, b] = w.creatures
    wearOn(w, a!, 'partyHat')
    dragTo(w, spotPosition(a!, 'head'), { x: b!.position.x, y: b!.position.y })
    expect(a!.dress.head).toBeNull()
    expect(b!.dress.head).toBe('partyHat')
  })

  it('a worn item dropped back on the chest goes back in', () => {
    const w = make([['friendly', 400, 300]])
    const c = w.creatures[0]!
    wearOn(w, c, 'monocle')
    const box = chestBox(w)
    dragTo(w, spotPosition(c, 'eyes'), { x: box.x + box.width / 2, y: box.y + box.height / 2 })
    expect(c.dress.eyes).toBeNull()
    expect(outCount(w, 'monocle')).toBe(0)
  })

  it('pressing a worn item takes it off rather than grabbing the creature', () => {
    const w = make([['friendly', 400, 300]])
    const c = w.creatures[0]!
    wearOn(w, c, 'partyHat')
    const at = spotPosition(c, 'head')
    hand(w, [
      [at.x, at.y, false],
      [at.x, at.y, true],
    ])
    expect(w.interaction.carry).toEqual({ kind: 'partyHat' })
    expect(w.interaction.hold).toBeNull()
  })
})

describe('limits and tidying up', () => {
  it('at most 3 of each are out at once (in the water, worn or in the hand)', () => {
    const w = make([
      ['friendly', 300, 300],
      ['peeker', 700, 300],
    ])
    wearOn(w, w.creatures[0]!, 'beard')
    wearOn(w, w.creatures[1]!, 'beard')
    expect(canTake(w, 'beard')).toBe(true)
    dropProp(w, 'beard', 500, 300)
    expect(outCount(w, 'beard')).toBe(PROPS.maxEach)
    expect(canTake(w, 'beard')).toBe(false)
  })

  it('a wearable left on the sand returns to the chest after 12 s (toys stay)', () => {
    const w = make([])
    const hat = dropProp(w, 'pirateHat', 600, w.height - 5) // straight onto the sand
    dropProp(w, 'duck', 300, 300)
    for (let t = 0; t < PROPS.blinkAfter + 1; t += DT) stepWorld(w, DT)
    expect(w.props.items).toContain(hat) // still there (blinking)
    for (let t = 0; t < PROPS.returnAfter - PROPS.blinkAfter; t += DT) stepWorld(w, DT)
    expect(countOf(w, 'pirateHat')).toBe(0) // back in the chest
    expect(canTake(w, 'pirateHat')).toBe(true)
    expect(countOf(w, 'duck')).toBe(1) // the toy stays out
  })
})

describe('fallen items can be picked up', () => {
  it('a dress-up item sinking or lying on the sand can be grabbed and put on a creature', () => {
    const w = make([['friendly', 900, 300]])
    const hat = dropProp(w, 'cowboyHat', 400, w.height - 5) // lying on the sand
    const at = { x: hat.position.x, y: hat.position.y }
    dragTo(w, at, { x: 900, y: 300 })
    expect(countOf(w, 'cowboyHat')).toBe(0)
    expect(w.creatures[0]!.dress.head).toBe('cowboyHat')
  })

  it('…or moved somewhere else in the water', () => {
    const w = make([])
    const glasses = dropProp(w, 'starGlasses', 400, 200) // sinking
    stepWorld(w, DT)
    dragTo(w, { x: glasses.position.x, y: glasses.position.y }, { x: 800, y: 250 })
    expect(countOf(w, 'starGlasses')).toBe(1)
    expect(w.props.items.find((p) => p.kind === 'starGlasses')!.position.x).toBeCloseTo(800, -1)
  })
})

describe('only the Grumpy minds', () => {
  it('a Grumpy shakes everything off, one item per shake, with a 💢', () => {
    const w = make([['grumpy', 640, 300]])
    const c = w.creatures[0]!
    wearOn(w, c, 'wizardHat')
    wearOn(w, c, 'starGlasses')
    wearOn(w, c, 'beard')
    let angers = 0
    let lastAge = Infinity
    const seconds = WEAR.firstShake + 3 * (WEAR.shakeEvery + WEAR.shakeSeconds) + 1
    for (let t = 0; t < seconds; t += DT) {
      stepWorld(w, DT)
      const e = c.expression.emote
      if (e?.kind === 'anger' && e.age < lastAge) angers++
      lastAge = e?.age ?? Infinity
    }
    expect(isDressed(c.dress)).toBe(false)
    expect(angers).toBeGreaterThanOrEqual(3)
    expect(countOf(w, 'wizardHat') + countOf(w, 'starGlasses') + countOf(w, 'beard')).toBe(3)
  })

  it('the others keep their items on', () => {
    for (const a of ['friendly', 'peeker', 'scaredy'] as Archetype[]) {
      const w = make([[a, 640, 300]])
      const c = w.creatures[0]!
      wearOn(w, c, 'cowboyHat')
      for (let t = 0; t < 10; t += DT) stepWorld(w, DT)
      expect(c.dress.head, a).toBe('cowboyHat')
    }
  })
})
