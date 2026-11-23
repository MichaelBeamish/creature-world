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
  chestCovers,
  DISCO,
  discoRadius,
  TOY,
  toyRadius,
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
    const toys = [
      slotAt(w, slotPosition(w, 1).x, slotPosition(w, 1).y),
      slotAt(w, slotPosition(w, 2).x, slotPosition(w, 2).y),
    ]
    expect(toys).toEqual(['duck', 'ball'])
    expect(slotAt(w, s.x, s.y - CHEST.slotRadius * 2)).toBeNull() // just above it: empty water
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

describe('small screens (task #42)', () => {
  it("chestCovers: anything reaching left of the chest's right edge (plus a gap) is in its corner", () => {
    const right = CHEST.left + CHEST.width
    expect(chestCovers(right - 10, 0)).toBe(true)
    expect(chestCovers(right + 30, 25)).toBe(true) // its side reaches the chest
    expect(chestCovers(right + 60, 25)).toBe(false)
  })

  it('toys and the disco ball are a little smaller on a phone, the same on a large screen', () => {
    const big = world()
    const phone = createWorld({ seed: 8, width: 390, height: 844, creatureCount: 0 })
    expect(toyRadius(big, 'ball')).toBe(TOY.radius.ball)
    expect(discoRadius(big)).toBe(DISCO.radius)
    expect(toyRadius(phone, 'ball')).toBeCloseTo(TOY.radius.ball * 0.8)
    expect(toyRadius(phone, 'duck')).toBeCloseTo(TOY.radius.duck * 0.8)
    expect(discoRadius(phone)).toBeCloseTo(DISCO.radius * 0.8)
  })

  it('the disco ball floats up to the upper-left corner on a phone, straight up on a large screen', () => {
    const phone = createWorld({ seed: 8, width: 390, height: 844, creatureCount: 0 })
    const small = dropProp(phone, 'discoBall', 250, 600)
    const big = world()
    const large = dropProp(big, 'discoBall', 640, 500)
    for (let i = 0; i < 30 * 60; i++) {
      stepWorld(phone, DT)
      stepWorld(big, DT)
    }
    expect(small.position.x).toBeCloseTo(discoRadius(phone) + DISCO.cornerGap, 0)
    expect(small.position.y).toBeCloseTo(DISCO.hangY, 0)
    expect(large.position.x).toBe(640)
    expect(large.position.y).toBeCloseTo(DISCO.hangY, 0)
  })
})

describe('the chest is solid for toys (task #42)', () => {
  it('a ball rolling left along the sand bounces off the chest instead of rolling over it', () => {
    for (const [width, height] of [
      [1280, 720],
      [390, 844],
    ] as const) {
      const w = createWorld({ seed: 8, width, height, creatureCount: 0 })
      const box = chestBox(w)
      const ball = dropProp(w, 'ball', box.x + box.width + 120, restY(w) - 40)
      for (let i = 0; i < 3 * 60; i++) stepWorld(w, DT) // settle on the sand first
      ball.velocity.x = -400
      const r = toyRadius(w, 'ball')
      let deepest = 0 // how far the ball ever got into the chest's box
      for (let i = 0; i < 4 * 60; i++) {
        stepWorld(w, DT)
        const cx = Math.max(box.x, Math.min(box.x + box.width, ball.position.x))
        const cy = Math.max(box.y, Math.min(box.y + box.height, ball.position.y))
        deepest = Math.max(deepest, r - Math.hypot(ball.position.x - cx, ball.position.y - cy))
      }
      expect(deepest).toBeLessThan(1) // never into the chest
      expect(ball.position.x).toBeGreaterThan(box.x + box.width) // and it ends up to the right of it
    }
  })

  it('a ball dropped onto the chest lands on its lid, not inside it', () => {
    const w = world()
    const box = chestBox(w)
    const ball = dropProp(w, 'ball', box.x + box.width / 2, box.y - 150)
    for (let i = 0; i < 6 * 60; i++) stepWorld(w, DT)
    const r = toyRadius(w, 'ball')
    // It lands on the lid (the wall's edge current may nudge it along, or off to the right — never into the chest).
    const onLid =
      ball.position.x <= box.x + box.width && Math.abs(ball.position.y - (box.y - r)) < 1
    const offToTheRight = ball.position.x >= box.x + box.width + r - 1
    expect(onLid || offToTheRight).toBe(true)
  })
})
