import { describe, expect, it } from 'vitest'
import { PLAY, playStyle } from './play'
import { setPresenceInput } from './presence'
import {
  canTake,
  CHEST,
  chestBox,
  countOf,
  dropProp,
  slotPosition,
  toggleChest,
  TOY,
  toyFloor,
} from './props'
import { ARCHETYPES, type Archetype } from './traits'
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

function run(w: World, seconds: number, each?: (t: number) => void) {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    stepWorld(w, DT)
    each?.(w.time)
  }
}

describe('toy physics', () => {
  it('the duck has neutral buoyancy: it stays at the depth where it is', () => {
    const w = make([])
    const duck = dropProp(w, 'duck', 400, 330)
    const ys: number[] = []
    run(w, 6, () => ys.push(duck.position.y))
    expect(Math.max(...ys)).toBeLessThan(330 + 2)
    expect(Math.min(...ys)).toBeGreaterThan(330 - 2)
  })

  it('a pushed duck drifts, then slows to a stop (water drag)', () => {
    const w = make([])
    const duck = dropProp(w, 'duck', 400, 330)
    duck.velocity.x = 200
    run(w, 8)
    expect(duck.position.x).toBeGreaterThan(450)
    expect(Math.abs(duck.velocity.x)).toBeLessThan(5)
  })

  it('toys never stay stuck in a corner: a gentle current eases them back to open water', () => {
    const w = make([])
    const duck = dropProp(w, 'duck', 20, 20)
    const ball = dropProp(w, 'ball', w.width - 16, 600)
    run(w, 6)
    expect(duck.position.x).toBeGreaterThan(40)
    expect(duck.position.y).toBeGreaterThan(40)
    expect(ball.position.x).toBeLessThan(w.width - 40)
  })

  it('the ball sinks, bounces lower each time, and comes to rest on the sand', () => {
    const w = make([])
    const ball = dropProp(w, 'ball', 800, 120)
    let bounces = 0
    let lastVy = 0
    run(w, 10, () => {
      if (lastVy > 0 && ball.velocity.y < 0) bounces++
      lastVy = ball.velocity.y
    })
    expect(bounces).toBeGreaterThanOrEqual(2)
    expect(ball.position.y).toBeCloseTo(toyFloor(w, 'ball'), 6)
    expect(Math.abs(ball.velocity.y)).toBeLessThan(1)
  })

  it('toys stay in the pool, however hard they are pushed', () => {
    const w = make([])
    const duck = dropProp(w, 'duck', 100, 200)
    const ball = dropProp(w, 'ball', 1100, 500)
    duck.velocity.x = -2000
    ball.velocity.x = 2000
    ball.velocity.y = -2000
    run(w, 4, () => {
      for (const t of [duck, ball]) {
        const r = TOY.radius[t.kind as 'duck' | 'ball']
        expect(t.position.x).toBeGreaterThanOrEqual(r - 1e-9)
        expect(t.position.x).toBeLessThanOrEqual(w.width - r + 1e-9)
        expect(t.position.y).toBeLessThanOrEqual(toyFloor(w, t.kind) + 1e-9)
      }
    })
  })

  it('a creature swimming into a toy pushes it the way it was swimming', () => {
    const w = make([['scaredy', 400, 480]])
    w.creatures[0]!.traits = { curiosity: 0.6, boldness: 0.2, energy: 0.6 } // a Peeker-like one: no swat
    const ball = dropProp(w, 'ball', 440, 480) // touching its head
    w.creatures[0]!.velocity.x = 120
    stepWorld(w, DT)
    expect(ball.velocity.x).toBeGreaterThan(50)
  })

  it('a hit ball pops up a bit and arcs back down', () => {
    const w = make([['scaredy', 300, 560]])
    w.creatures[0]!.traits = { curiosity: 0.6, boldness: 0.2, energy: 0.6 }
    const ball = dropProp(w, 'ball', 340, 560)
    w.creatures[0]!.velocity.x = 150
    stepWorld(w, DT) // the hit…
    const c = w.creatures[0]!
    c.position.x = c.prevPosition.x = 1000 // …then it swims off, so nothing touches the ball again
    c.position.y = c.prevPosition.y = 150
    let highest = Infinity
    run(w, 10, () => (highest = Math.min(highest, ball.position.y)))
    expect(560 - highest).toBeGreaterThan(40) // it flew up…
    expect(560 - highest).toBeLessThan(220) // …a bit
    expect(ball.position.y).toBeCloseTo(toyFloor(w, 'ball'), 0) // and came back down
  })
})

describe('play by personality', () => {
  it('styles come from the trait dials: fetch, nudge, swat, shy', () => {
    const style = (a: Archetype) =>
      playStyle({ traits: { ...ARCHETYPES[a], energy: 0.5 } } as Parameters<typeof playStyle>[0])
    expect((['friendly', 'peeker', 'grumpy', 'scaredy'] as Archetype[]).map(style)).toEqual([
      'fetch',
      'nudge',
      'swat',
      'shy',
    ])
  })

  it('a Friendly plays fetch: it nudges the duck toward your hand and gives a heart on delivery', () => {
    const w = make([['friendly', 300, 300]])
    const duck = dropProp(w, 'duck', 640, 300)
    const hand = { x: 1050, y: 120 }
    const start = Math.hypot(hand.x - 640, hand.y - 300)
    let closest = Infinity
    let heart = false
    run(w, 14, () => {
      setPresenceInput(w.presence, hand.x, hand.y, true, false)
      closest = Math.min(closest, Math.hypot(hand.x - duck.position.x, hand.y - duck.position.y))
      heart ||= w.creatures[0]!.expression.emote?.kind === 'heart'
    })
    expect(start - closest).toBeGreaterThan(250)
    expect(closest).toBeLessThan(PLAY.deliver)
    expect(heart).toBe(true)
  })

  it('a Peeker nudges the duck, backs off, and comes back for more; the duck squeaks', () => {
    const w = make([['peeker', 300, 300]])
    const duck = dropProp(w, 'duck', 640, 300)
    let backs = 0
    let wasBack = false
    run(w, 14, () => {
      const back = w.creatures[0]!.mind.play?.phase === 'back'
      if (back && !wasBack) backs++
      wasBack = back
    })
    expect(backs).toBeGreaterThanOrEqual(2)
    expect(Math.abs(duck.position.x - 640)).toBeGreaterThan(100)
    expect(w.interaction.sounds.some((s) => s.kind === 'squee')).toBe(true)
  })

  it('a Grumpy swats away a toy that comes close (anger)', () => {
    const w = make([['grumpy', 700, 520]])
    const ball = dropProp(w, 'ball', 400, 600)
    ball.velocity.x = 380
    let reversed = false
    let anger = false
    run(w, 3, () => {
      reversed ||= ball.velocity.x < -100
      anger ||= w.creatures[0]!.expression.emote?.kind === 'anger'
    })
    expect(reversed).toBe(true)
    expect(anger).toBe(true)
  })

  it('a Scaredy plays shyly when nobody is watching: it nudges the duck and scurries back', () => {
    const w = make([['scaredy', 300, 300]])
    const duck = dropProp(w, 'duck', 640, 300)
    let nudges = 0
    let wasBack = false
    run(w, 14, () => {
      const back = w.creatures[0]!.mind.play?.phase === 'back'
      if (back && !wasBack) nudges++
      wasBack = back
    })
    expect(nudges).toBeGreaterThanOrEqual(1)
    expect(Math.abs(duck.position.x - 640)).toBeGreaterThan(100)
  })

  it('but with your hand near the toy, a Scaredy keeps its distance', () => {
    const w = make([['scaredy', 500, 450]])
    const ball = dropProp(w, 'ball', 560, 200)
    let closest = Infinity
    run(w, 8, (t) => {
      setPresenceInput(w.presence, ball.position.x + 40, ball.position.y, true, false)
      if (t < 2) return
      const c = w.creatures[0]!
      closest = Math.min(
        closest,
        Math.hypot(ball.position.x - c.position.x, ball.position.y - c.position.y),
      )
    })
    expect(closest).toBeGreaterThan(100)
  })

  it('interest runs out: after a session it is bored of toys for a while', () => {
    const w = make([['peeker', 300, 300]])
    dropProp(w, 'duck', 640, 300)
    let played = 0
    let playedAfterSession = false
    run(w, PLAY.sessionSeconds + 6, (t) => {
      if (w.creatures[0]!.mind.intent === 'play') played += DT
      if (t > PLAY.sessionSeconds + 1 && w.creatures[0]!.mind.intent === 'play') {
        playedAfterSession = true
      }
    })
    expect(played).toBeGreaterThan(2)
    expect(playedAfterSession).toBe(false)
  })

  it('food beats play: with a shrimp and a duck in the water, a Friendly goes for the shrimp', () => {
    const w = make([['friendly', 300, 300]])
    dropProp(w, 'duck', 640, 300)
    dropProp(w, 'shrimp', 500, 300)
    let eaten = false
    run(w, 10, () => {
      if (countOf(w, 'shrimp') === 0) eaten = true
      else expect(w.creatures[0]!.mind.intent).not.toBe('play')
    })
    expect(eaten).toBe(true)
  })
})

describe('toys and the chest', () => {
  it('each toy exists once: its slot is greyed out while it is in the pool', () => {
    const w = make([])
    expect(canTake(w, 'duck')).toBe(true)
    dropProp(w, 'duck', 400, 300)
    expect(canTake(w, 'duck')).toBe(false)
    expect(canTake(w, 'ball')).toBe(true)
  })

  it('a toy in the water can be picked up and dropped back into the chest', () => {
    const w = make([])
    toggleChest(w)
    const duck = dropProp(w, 'duck', 400, 300)
    run(w, 3)
    const at = { x: duck.position.x, y: duck.position.y }
    const box = chestBox(w)
    const steps: [number, number, boolean][] = [
      [at.x, at.y, false],
      [at.x, at.y, true],
      [box.x + box.width / 2, box.y + box.height / 2, true],
      [box.x + box.width / 2, box.y + box.height / 2, false],
    ]
    for (const [x, y, pressed] of steps) {
      setPresenceInput(w.presence, x, y, true, pressed)
      stepWorld(w, DT)
    }
    expect(countOf(w, 'duck')).toBe(0)
    expect(canTake(w, 'duck')).toBe(true) // back in the chest
  })

  it('the open chest shows all three items, spaced apart', () => {
    const w = make([])
    toggleChest(w)
    const slots = [0, 1, 2].map((i) => slotPosition(w, i))
    for (const s of slots) expect(s.y).toBeLessThan(chestBox(w).y)
    expect(Math.hypot(slots[1]!.x - slots[0]!.x, slots[1]!.y - slots[0]!.y)).toBeGreaterThan(
      CHEST.slotRadius * 2,
    )
  })
})
