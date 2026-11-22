import { describe, expect, it } from 'vitest'
import { setPresenceInput } from './presence'
import {
  arrowPosition,
  canTake,
  CHEST,
  CHEST_PAGES,
  chestBox,
  countOf,
  dropProp,
  outCount,
  pageDotAt,
  pageDotPosition,
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
  /** Press and release at a point. */
  const tap = (w: World, at: { x: number; y: number }) =>
    hand(w, [
      [at.x, at.y, false],
      [at.x, at.y, true],
      [at.x, at.y, false],
    ])

  it('› turns to the next page and ‹ to the previous one, wrapping round at both ends', () => {
    const w = make([])
    toggleChest(w)
    const next = arrowPosition(w, 'next')
    const prev = arrowPosition(w, 'prev')
    expect(slotAt(w, next.x, next.y)).toBe('next')
    expect(slotAt(w, prev.x, prev.y)).toBe('prev')
    for (let i = 1; i <= CHEST_PAGES.length; i++) {
      tap(w, next)
      expect(w.props.chest.page).toBe(i % CHEST_PAGES.length)
    }
    expect(pageItems(w)).toEqual(['shrimp', 'duck', 'ball']) // back to the start
    tap(w, prev)
    expect(w.props.chest.page).toBe(CHEST_PAGES.length - 1) // ‹ on the first page: the last page
    tap(w, prev)
    expect(w.props.chest.page).toBe(CHEST_PAGES.length - 2)
  })

  it('pressing a page dot jumps straight to that page', () => {
    const w = make([])
    toggleChest(w)
    const last = CHEST_PAGES.length - 1
    tap(w, pageDotPosition(w, last))
    expect(w.props.chest.page).toBe(last)
    expect(w.props.chest.pageChangedAt).toBeGreaterThan(0) // the new items pop in
    tap(w, pageDotPosition(w, 3))
    expect(w.props.chest.page).toBe(3)
    // Between two dots (outside both hit circles) or with the chest closed: nothing.
    const a = pageDotPosition(w, 5)
    expect(pageDotAt(w, a.x, a.y + CHEST.dotHit + 2)).toBeNull()
    toggleChest(w)
    expect(pageDotAt(w, a.x, a.y)).toBeNull()
  })

  it('the arrows and dots are part of the chest: a carried item dropped there goes back in', () => {
    const w = make([])
    toggleChest(w)
    const shrimp = slotPosition(w, 0)
    dragTo(w, shrimp, pageDotPosition(w, 2))
    expect(w.interaction.carry).toBeNull()
    expect(countOf(w, 'shrimp')).toBe(0)
  })

  it('every page shows at most 3 items, and every item is on exactly one page', () => {
    const all = CHEST_PAGES.flat()
    for (const page of CHEST_PAGES) expect(page.length).toBeLessThanOrEqual(3)
    expect(new Set(all).size).toBe(all.length)
    expect(all).toHaveLength(30) // shrimp, duck, ball, disco ball + 26 wearables (incl. 8 held items, task #33)
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

describe('held items (task #33)', () => {
  it('a creature can hold one item and wear kandi cuffs at the same time', () => {
    const w = make([['friendly', 640, 300]])
    const c = w.creatures[0]!
    wearOn(w, c, 'glowStick')
    wearOn(w, c, 'kandiCuffs')
    wearOn(w, c, 'partyHat')
    expect([c.dress.hand, c.dress.cuffs, c.dress.head]).toEqual([
      'glowStick',
      'kandiCuffs',
      'partyHat',
    ])
    wearOn(w, c, 'magicWand') // a second held item swaps the first off
    expect(c.dress.hand).toBe('magicWand')
    expect(countOf(w, 'glowStick')).toBe(1)
  })

  it('a held item can be taken from the raised tentacle', () => {
    const w = make([['friendly', 500, 300]])
    const c = w.creatures[0]!
    wearOn(w, c, 'rose')
    const at = spotPosition(c, 'hand')
    expect(at.x).toBeGreaterThan(c.position.x) // up and out to the side
    hand(w, [
      [at.x, at.y, false],
      [at.x, at.y, true],
    ])
    expect(w.interaction.carry).toEqual({ kind: 'rose' })
    expect(c.dress.hand).toBeNull()
  })

  it('a let-go balloon floats up off the top of the screen and goes back in the chest', () => {
    const w = make([['grumpy', 200, 600]])
    dropProp(w, 'balloon', 900, 500)
    const b = w.props.items.find((p) => p.kind === 'balloon')!
    const startY = b.position.y
    for (let t = 0; t < 0.5; t += DT) stepWorld(w, DT)
    expect(b.position.y).toBeLessThan(startY) // rising, not sinking
    for (let t = 0; t < 6; t += DT) stepWorld(w, DT)
    expect(countOf(w, 'balloon')).toBe(0)
    expect(canTake(w, 'balloon')).toBe(true)
  })
  it('the Grumpy shakes held items and cuffs off too', () => {
    const w = make([['grumpy', 640, 300]])
    const c = w.creatures[0]!
    wearOn(w, c, 'trident')
    wearOn(w, c, 'kandiCuffs')
    for (let t = 0; t < WEAR.firstShake + 2 * (WEAR.shakeEvery + WEAR.shakeSeconds) + 1; t += DT)
      stepWorld(w, DT)
    expect(isDressed(c.dress)).toBe(false)
  })
})

describe('picking up dropped items (task #33)', () => {
  /** Run until the creature wears the kind (or time runs out); returns seconds taken (Infinity if never). */
  function untilWorn(w: World, kind: string, seconds: number, hand?: [number, number]): number {
    const c = w.creatures[0]!
    for (let t = 0; t < seconds; t += DT) {
      if (hand) setPresenceInput(w.presence, hand[0], hand[1], true, false)
      stepWorld(w, DT)
      if (Object.values(c.dress).includes(kind)) return t
    }
    return Infinity
  }

  it('the Friendly swims over to a dropped hat and puts it on', () => {
    const w = make([['friendly', 300, 300]])
    dropProp(w, 'wizardHat', 650, 350)
    expect(untilWorn(w, 'wizardHat', 8)).toBeLessThan(8)
    expect(w.creatures[0]!.dress.head).toBe('wizardHat')
    expect(w.props.items.some((p) => p.kind === 'wizardHat')).toBe(false)
  })

  it('the Grumpy never picks things up', () => {
    const w = make([['grumpy', 300, 300]])
    dropProp(w, 'wizardHat', 330, 330)
    expect(untilWorn(w, 'wizardHat', 6)).toBe(Infinity)
  })

  it('the Peeker waits while the hand hovers over the item', () => {
    const w = make([['peeker', 300, 300]])
    dropProp(w, 'tiara', 600, 350)
    const item = w.props.items.find((p) => p.kind === 'tiara')!
    // Hand right on the item for a while: no pickup.
    for (let t = 0; t < 4; t += DT) {
      setPresenceInput(w.presence, item.position.x, item.position.y, true, false)
      stepWorld(w, DT)
    }
    expect(w.creatures[0]!.dress.head).toBeNull()
  })

  it('a creature only picks up an item if that spot is free', () => {
    const w = make([['friendly', 300, 300]])
    wearOn(w, w.creatures[0]!, 'cowboyHat')
    dropProp(w, 'wizardHat', 360, 350)
    expect(untilWorn(w, 'wizardHat', 5)).toBe(Infinity)
    expect(w.creatures[0]!.dress.head).toBe('cowboyHat')
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
