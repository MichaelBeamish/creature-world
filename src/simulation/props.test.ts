import { describe, expect, it } from 'vitest'
import { setPresenceInput } from './presence'
import {
  CHEST,
  chestBox,
  countOf,
  dropProp,
  PROPS,
  restY,
  sandTop,
  slotAt,
  slotPosition,
  toggleChest,
} from './props'
import { createScenery, SCENERY } from './scenery'
import { createWorld, stepWorld, type World } from './world'

const DT = 1 / 60

function world(): World {
  return createWorld({ seed: 8, width: 1280, height: 720, creatureCount: 0 })
}

/** Step with a scripted hand (x, y, pressed). */
function hand(w: World, x: number, y: number, pressed: boolean, steps = 1) {
  for (let i = 0; i < steps; i++) {
    setPresenceInput(w.presence, x, y, true, pressed)
    stepWorld(w, DT)
  }
}

describe('the treasure chest', () => {
  it('sits on the sand in the bottom-left corner', () => {
    const w = world()
    const box = chestBox(w)
    expect(box.x).toBe(CHEST.left)
    expect(box.y + box.height).toBeGreaterThan(sandTop(w)) // on the sand…
    expect(box.y + box.height).toBeLessThanOrEqual(w.height) // …inside the window
  })

  it('toggles open and closed; its items float above it only while open', () => {
    const w = world()
    const s = slotPosition(w, 0)
    expect(s.y).toBeLessThan(chestBox(w).y) // above the chest
    expect(slotAt(w, s.x, s.y)).toBeNull() // closed
    toggleChest(w)
    expect(w.props.chest.open).toBe(true)
    expect(slotAt(w, s.x, s.y)).toBe('shrimp')
    expect(slotAt(w, s.x + CHEST.slotRadius * 2, s.y)).toBeNull()
    toggleChest(w)
    expect(slotAt(w, s.x, s.y)).toBeNull()
  })

  it('keeps its corner clear: no rock, shell or seaweed is placed there (300 seeds)', () => {
    for (let seed = 0; seed < 300; seed++) {
      for (const item of createScenery(seed))
        expect(item.u).toBeGreaterThanOrEqual(SCENERY.chestClear)
    }
  })
})

describe('carrying an item out of the chest', () => {
  it('press an open slot, drag into the water, release: a shrimp drops there', () => {
    const w = world()
    toggleChest(w)
    const s = slotPosition(w, 0)
    hand(w, s.x, s.y, false)
    hand(w, s.x, s.y, true)
    expect(w.interaction.carry).toEqual({ kind: 'shrimp' })
    hand(w, 600, 300, true, 10) // carry it over the water
    expect(countOf(w, 'shrimp')).toBe(0) // still in hand
    hand(w, 600, 300, false)
    expect(w.interaction.carry).toBeNull()
    expect(countOf(w, 'shrimp')).toBe(1)
    expect(w.props.items[0]!.position.x).toBeCloseTo(600, 0)
  })

  it('releasing it back over the chest puts it back', () => {
    const w = world()
    toggleChest(w)
    const s = slotPosition(w, 0)
    const box = chestBox(w)
    hand(w, s.x, s.y, false)
    hand(w, s.x, s.y, true)
    hand(w, box.x + box.width / 2, box.y + box.height / 2, true, 5)
    hand(w, box.x + box.width / 2, box.y + box.height / 2, false)
    expect(countOf(w, 'shrimp')).toBe(0)
  })

  it('a closed chest gives nothing, and at the cap the shrimp slot gives nothing', () => {
    const w = world()
    const s = slotPosition(w, 0)
    hand(w, s.x, s.y, false)
    hand(w, s.x, s.y, true)
    expect(w.interaction.carry).toBeNull() // closed
    hand(w, s.x, s.y, false)

    toggleChest(w)
    for (let i = 0; i < PROPS.maxShrimp; i++) dropProp(w, 'shrimp', 400 + i * 100, 300)
    hand(w, s.x, s.y, true)
    expect(w.interaction.carry).toBeNull() // already 3 in the water
  })

  it("the chest's items are checked before creatures (a creature behind a slot isn't grabbed)", () => {
    const w = createWorld({ seed: 8, width: 1280, height: 720, creatureCount: 1 })
    toggleChest(w)
    const s = slotPosition(w, 0)
    const c = w.creatures[0]!
    c.position.x = c.prevPosition.x = s.x
    c.position.y = c.prevPosition.y = s.y
    hand(w, s.x, s.y, false)
    hand(w, s.x, s.y, true, 30)
    expect(w.interaction.carry).toEqual({ kind: 'shrimp' })
    expect(w.interaction.hold).toBeNull()
  })
})

describe('a shrimp in the water', () => {
  it('sinks with a gentle drift and comes to rest on the sand', () => {
    const w = world()
    const p = dropProp(w, 'shrimp', 640, 200)
    let maxDrift = 0
    for (let i = 0; i < 60 * 15; i++) {
      stepWorld(w, DT)
      maxDrift = Math.max(maxDrift, Math.abs(p.position.x - 640))
    }
    expect(p.resting).toBe(true)
    expect(p.position.y).toBeCloseTo(restY(w), 6)
    expect(p.position.y).toBeGreaterThan(sandTop(w)) // on (in) the sand
    expect(maxDrift).toBeGreaterThan(2)
    expect(maxDrift).toBeLessThanOrEqual(PROPS.driftAmp + 1e-6)
  })

  it('dropped onto the sand, it simply lies there', () => {
    const w = world()
    const p = dropProp(w, 'shrimp', 640, w.height - 5)
    expect(p.resting).toBe(true)
    expect(p.position.y).toBe(restY(w))
  })
})
