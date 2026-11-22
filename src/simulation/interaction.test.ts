import { describe, expect, it } from 'vitest'
import { BODY, footprint } from './creature'
import { CONSTRAINTS } from './constraints'
import { aimAtHand, creatureAt, INTERACTION, stressFraction } from './interaction'
import { speedLimit } from './movement'
import { setPresenceInput, updatePresence } from './presence'
import { swimBounds } from './scenery'
import { ARCHETYPES, type Archetype } from './traits'
import { createWorld, stepWorld, type World } from './world'

const DT = 1 / 60

/** A world with creatures of the given archetypes (exact dials, mid energy) at fixed positions. */
function staged(cast: { archetype: Archetype; x: number; y: number }[]): World {
  const world = createWorld({ seed: 21, width: 1280, height: 720, creatureCount: cast.length })
  world.creatures.forEach((c, i) => {
    const role = cast[i]!
    c.archetype = role.archetype
    c.traits = { ...ARCHETYPES[role.archetype], energy: 0.6 }
    c.size = 30
    c.position.x = c.prevPosition.x = role.x
    c.position.y = c.prevPosition.y = role.y
    c.velocity.x = c.velocity.y = 0
  })
  return world
}

/** Scripted pointer: (t) → { x, y, pressed } or null (absent). Steps the whole world. */
type Pointer = (t: number) => { x: number; y: number; pressed: boolean } | null
function play(world: World, pointer: Pointer, seconds: number, each?: () => void) {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    const p = pointer(world.time)
    setPresenceInput(world.presence, p?.x ?? 0, p?.y ?? 0, p !== null, p?.pressed ?? false)
    stepWorld(world, DT)
    each?.()
  }
}

const sounds = (world: World, kind: string) =>
  world.interaction.sounds.filter((s) => s.kind === kind)

describe('hit-testing (creatureAt)', () => {
  const world = staged([
    { archetype: 'friendly', x: 400, y: 300 },
    { archetype: 'grumpy', x: 800, y: 300 },
  ])

  it('a press on a head hits that creature (head)', () => {
    expect(creatureAt(world, 400, 300)).toMatchObject({ part: 'head', creature: { id: 1 } })
    expect(creatureAt(world, 812, 290)).toMatchObject({ part: 'head', creature: { id: 2 } })
  })

  it('a press among the tentacles hits that creature (tentacle)', () => {
    const below = 300 + 30 * (BODY.tentacleRootY + BODY.tentacleLength * 0.5)
    expect(creatureAt(world, 410, below)).toMatchObject({ part: 'tentacle', creature: { id: 1 } })
  })

  it('empty water hits nothing', () => {
    expect(creatureAt(world, 600, 100)).toBeNull()
    expect(creatureAt(world, 600, 300)).toBeNull()
  })

  it("a head beats another creature's tentacles; the top-most creature wins", () => {
    const stacked = staged([
      { archetype: 'friendly', x: 500, y: 300 }, // its tentacles hang down over…
      { archetype: 'scaredy', x: 500, y: 420 }, // …this one's head
    ])
    expect(creatureAt(stacked, 500, 420)).toMatchObject({ part: 'head', creature: { id: 2 } })
    const overlapping = staged([
      { archetype: 'friendly', x: 500, y: 300 },
      { archetype: 'scaredy', x: 505, y: 310 }, // lower on screen → drawn on top
    ])
    expect(creatureAt(overlapping, 502, 305)?.creature.id).toBe(2)
  })
})

describe('boop vs grab', () => {
  it('a quick click (no drag) is a boop: squish, blink, emote and sound — never a hold', () => {
    const world = staged([{ archetype: 'friendly', x: 500, y: 350 }])
    let everHeld = false
    let maxSquash = 0
    play(
      world,
      (t) => ({ x: 500, y: 350, pressed: t < 0.1 }),
      0.6,
      () => {
        everHeld ||= world.interaction.hold !== null
        maxSquash = Math.max(maxSquash, world.creatures[0]!.anim.squash)
      },
    )
    expect(everHeld).toBe(false)
    expect(maxSquash).toBeGreaterThan(0.1)
    expect(world.creatures[0]!.expression.emote?.kind).toBe('heart') // Friendly: ♥
    expect(sounds(world, 'boop')).toHaveLength(1)
  })

  it('boop emotes follow personality', () => {
    const expected: Record<Archetype, string> = {
      friendly: 'heart',
      peeker: 'question',
      scaredy: 'exclaim',
      grumpy: 'anger',
    }
    for (const archetype of Object.keys(expected) as Archetype[]) {
      const world = staged([{ archetype, x: 500, y: 350 }])
      play(world, (t) => ({ x: 500, y: 350, pressed: t < 0.1 }), 0.15)
      expect(world.creatures[0]!.expression.emote?.kind, archetype).toBe(expected[archetype])
    }
  })

  it('holding longer than the boop time becomes a grab (intent "held", grab sound)', () => {
    const world = staged([{ archetype: 'friendly', x: 500, y: 350 }])
    play(world, () => ({ x: 500, y: 350, pressed: true }), 0.5)
    expect(world.interaction.hold?.creatureId).toBe(1)
    expect(world.creatures[0]!.mind.intent).toBe('held')
    expect(sounds(world, 'grab')).toHaveLength(1)
  })

  it('dragging right away (before the boop time) is also a grab', () => {
    const world = staged([{ archetype: 'friendly', x: 500, y: 350 }])
    play(world, (t) => ({ x: 500 + 400 * t, y: 350, pressed: true }), 0.1)
    expect(world.interaction.hold).not.toBeNull()
  })

  it('pressing empty water does nothing', () => {
    const world = staged([{ archetype: 'friendly', x: 500, y: 350 }])
    play(world, () => ({ x: 100, y: 100, pressed: true }), 0.5)
    expect(world.interaction.hold).toBeNull()
    expect(world.interaction.press).toBeNull()
  })
})

describe('dragging', () => {
  it('follows the cursor within the tether when the way is clear; stays in the water; never overlaps', () => {
    const world = staged([
      { archetype: 'scaredy', x: 300, y: 300 },
      { archetype: 'grumpy', x: 800, y: 300 },
      { archetype: 'peeker', x: 600, y: 500 },
    ])
    const cursor = (t: number) => ({
      x: 300 + 900 * Math.min(1, t / 1.5),
      y: 300 + 120 * Math.sin(t * 3),
      pressed: true,
    })
    let maxGap = 0
    let blockedSteps = 0
    play(world, cursor, 3, () => {
      const hold = world.interaction.hold
      if (!hold) return
      const c = world.creatures.find((cr) => cr.id === hold.creatureId)!
      const p = world.presence.position
      const gap = Math.hypot(
        p.x - (c.position.x + hold.offset.x),
        p.y - (c.position.y + hold.offset.y),
      )
      // The tether holds while nothing is in the way. Blocked by a neighbour (who can only be shoved so fast)
      // or by the edge, the held creature may fall further behind — by design.
      const bounds = swimBounds(world)
      const f = footprint(c.position, c.size)
      const atEdge = f.x + f.radius >= bounds.width - 0.5 || f.x - f.radius <= 0.5
      const blocked = world.creatures.some((o) => {
        if (o === c) return false
        const g = footprint(o.position, o.size)
        return Math.hypot(g.x - f.x, g.y - f.y) < g.radius + f.radius + 1
      })
      if (blocked) blockedSteps++
      else if (!atEdge) maxGap = Math.max(maxGap, gap)
      expect(f.y + f.radius).toBeLessThanOrEqual(bounds.height + 1e-6)
      // No visible overlap between any two creatures (same tolerance as the movement invariants).
      const fs = world.creatures.map((cr) => footprint(cr.position, cr.size))
      for (let i = 0; i < fs.length; i++)
        for (let j = i + 1; j < fs.length; j++) {
          const a = fs[i]!
          const b = fs[j]!
          expect(a.radius + b.radius - Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(0.5)
        }
    })
    expect(world.interaction.hold?.creatureId).toBe(1)
    expect(maxGap).toBeLessThanOrEqual(INTERACTION.tether + 1e-6)
    expect(blockedSteps).toBeGreaterThan(0) // the path really did run into someone
  })

  it('a creature in the way is shoved no faster than the shove limit (plus its own swimming)', () => {
    const world = staged([
      { archetype: 'friendly', x: 200, y: 300 },
      { archetype: 'grumpy', x: 700, y: 300 }, // resting right in the path
    ])
    const bystander = world.creatures[1]!
    let fastest = 0
    let last = { x: bystander.position.x, y: bystander.position.y }
    // Grab, then sweep the hand far past the bystander very fast (~2000 px/s).
    play(
      world,
      (t) => ({ x: 200 + 2000 * Math.max(0, t - 0.4), y: 300, pressed: true }),
      1.2,
      () => {
        const moved = Math.hypot(bystander.position.x - last.x, bystander.position.y - last.y) / DT
        fastest = Math.max(fastest, moved)
        last = { x: bystander.position.x, y: bystander.position.y }
      },
    )
    expect(fastest).toBeGreaterThan(0)
    expect(fastest).toBeLessThanOrEqual(CONSTRAINTS.shoveSpeed + speedLimit(bystander) + 1)
  })

  it('a creature grabbed by a tentacle hangs from that point (body offset from the cursor)', () => {
    const world = staged([{ archetype: 'friendly', x: 500, y: 300 }])
    const grabY = 300 + 30 * (BODY.tentacleRootY + 1.2)
    play(world, () => ({ x: 505, y: grabY, pressed: true }), 1.5)
    const hold = world.interaction.hold!
    expect(hold.part).toBe('tentacle')
    expect(hold.offset.y).toBeGreaterThan(0) // grabbed below the center…
    expect(world.creatures[0]!.position.y).toBeLessThan(grabY) // …so the body hangs above the hand
  })
})

describe('personality while held', () => {
  /** Hold a creature still for 2 s; return its average distance (grab point → cursor). */
  function tug(archetype: Archetype) {
    const world = staged([{ archetype, x: 640, y: 360 }])
    let total = 0
    let n = 0
    let max = 0
    play(
      world,
      () => ({ x: 640, y: 360, pressed: true }),
      2,
      () => {
        const hold = world.interaction.hold
        if (!hold || world.time < 0.8) return
        const c = world.creatures[0]!
        const gap = Math.hypot(
          640 - (c.position.x + hold.offset.x),
          360 - (c.position.y + hold.offset.y),
        )
        total += gap
        max = Math.max(max, gap)
        n++
      },
    )
    return { world, avg: total / n, max }
  }

  it('a Scaredy tugs harder than a Friendly (pulls farther from the hand)', () => {
    expect(tug('scaredy').avg).toBeGreaterThan(tug('friendly').avg * 2)
  })

  it('everyone but the Friendly visibly pulls away — and nobody gets beyond the tether', () => {
    expect(tug('friendly').avg).toBeLessThan(2) // curious, not upset: only a gentle wiggle
    const peeker = tug('peeker')
    const grumpy = tug('grumpy')
    const scaredy = tug('scaredy')
    for (const t of [peeker, grumpy, scaredy]) {
      expect(t.avg).toBeGreaterThan(8)
      expect(t.max).toBeLessThan(INTERACTION.tether)
    }
    expect(scaredy.max).toBeGreaterThan(peeker.max) // the Scaredy strains hardest; the Peeker least
    expect(grumpy.max).toBeGreaterThan(peeker.max)
  })

  it('the pull comes in yanks (strain and ease off), not a steady lean', () => {
    const world = staged([{ archetype: 'scaredy', x: 640, y: 360 }])
    const gaps: number[] = []
    play(
      world,
      () => ({ x: 640, y: 360, pressed: true }),
      3,
      () => {
        const hold = world.interaction.hold
        if (!hold || world.time < 1) return
        const c = world.creatures[0]!
        gaps.push(
          Math.hypot(640 - (c.position.x + hold.offset.x), 360 - (c.position.y + hold.offset.y)),
        )
      },
    )
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeGreaterThan(10)
  })

  it('emotions while held follow the archetype grid', () => {
    const expected: Record<Archetype, string> = {
      friendly: 'curious',
      peeker: 'scared',
      scaredy: 'scared',
      grumpy: 'grumpy',
    }
    for (const archetype of Object.keys(expected) as Archetype[]) {
      expect(tug(archetype).world.creatures[0]!.mind.emotion.kind, archetype).toBe(
        expected[archetype],
      )
    }
  })

  it('struggling creatures squeak; a calm Friendly barely does', () => {
    expect(sounds(tug('scaredy').world, 'squeak').length).toBeGreaterThanOrEqual(2)
    expect(sounds(tug('friendly').world, 'squeak').length).toBeLessThanOrEqual(1)
  })
})

describe('top speed while held', () => {
  it('after the hand gets far ahead (blocked, or a flick), the creature zooms to catch up — never teleports', () => {
    const world = staged([{ archetype: 'friendly', x: 300, y: 360 }])
    const c = world.creatures[0]!
    let fastest = 0
    let caughtUp = false
    // Hold still, then the hand jumps 600 px in one instant.
    play(
      world,
      (t) => ({ x: t < 0.6 ? 300 : 900, y: 360, pressed: true }),
      1.6,
      () => {
        const speed =
          Math.hypot(c.position.x - c.prevPosition.x, c.position.y - c.prevPosition.y) / DT
        fastest = Math.max(fastest, speed)
        if (world.time > 0.6 && Math.abs(900 - c.position.x) < INTERACTION.tether) caughtUp = true
      },
    )
    expect(fastest).toBeLessThanOrEqual(INTERACTION.maxHeldSpeed + 1e-6)
    expect(fastest).toBeGreaterThan(INTERACTION.maxHeldSpeed * 0.9) // it really did zoom
    expect(caughtUp).toBe(true)
  })
})

describe('release', () => {
  function releaseAfterHold(archetype: Archetype) {
    const world = staged([{ archetype, x: 640, y: 360 }])
    play(world, (t) => ({ x: 640, y: 360, pressed: t < 1 }), 1.6)
    return world.creatures[0]!
  }

  it('each personality reacts in character', () => {
    expect(['flee', 'hide']).toContain(releaseAfterHold('scaredy').mind.intent)
    expect(releaseAfterHold('grumpy').mind.intent).toBe('standoff')
    expect(releaseAfterHold('friendly').expression.emote?.kind).toBe('heart')
    expect(releaseAfterHold('friendly').mind.intent).not.toBe('held')
  })
})

describe('determinism', () => {
  it('same seed + same scripted presses → identical world', () => {
    const run = () => {
      const world = createWorld({ seed: 42, width: 1280, height: 720, creatureCount: 5 })
      const c = world.creatures[0]!
      const x0 = c.position.x
      const y0 = c.position.y
      play(
        world,
        (t) => ({
          x: x0 + 200 * Math.sin(t),
          y: y0 + 60 * t,
          pressed: t < 2 || (t > 2.5 && t < 2.55),
        }),
        3,
      )
      return world
    }
    expect(run()).toEqual(run())
  })
})

describe('shake → ink', () => {
  /** Hold a creature, then move the hand along `path` (starting at 0.5 s). Returns when it inked (s), or -1. */
  /** `path` gives the hand offset: a number (horizontal) or [dx, dy]. */
  function shake(
    archetype: Archetype,
    path: (t: number) => number | [number, number],
    seconds = 6,
  ) {
    const world = staged([{ archetype, x: 640, y: 360 }])
    let inkAt = -1
    let warnedAt = -1
    play(
      world,
      (t) => {
        const d = t < 0.5 ? 0 : path(t - 0.5)
        const [dx, dy] = typeof d === 'number' ? [d, 0] : d
        return { x: 640 + dx, y: 360 + dy, pressed: true }
      },
      seconds,
      () => {
        const c = world.creatures[0]!
        if (warnedAt < 0 && stressFraction(world, c) > INTERACTION.stressWarning)
          warnedAt = world.time
        // The shake limit was reached: a squirt (or, for a Friendly, a hiccup).
        if (inkAt < 0 && sounds(world, 'ink').length + sounds(world, 'hiccup').length > 0)
          inkAt = world.time
      },
    )
    return { world, inkAt, warnedAt }
  }
  const hardShake = (t: number) => 100 * Math.sin(t * 2 * Math.PI * 4)

  it('gentle wiggling, swirling in fast circles and long sweeps never ink — not even a Scaredy', () => {
    expect(shake('scaredy', (t) => 20 * Math.sin(t * 2 * Math.PI * 2)).inkAt).toBe(-1)
    const swirl = (t: number): [number, number] => [
      120 * Math.cos(t * 2 * Math.PI * 1.5),
      120 * Math.sin(t * 2 * Math.PI * 1.5),
    ]
    expect(shake('scaredy', swirl).inkAt).toBe(-1) // ~1100 px/s, but a steady speed: not shaking
    expect(shake('scaredy', (t) => 400 * Math.sin(t * 2.5)).inkAt).toBe(-1)
  })

  it('a normal trackpad shake inks Scaredy, Peeker and Grumpy within 2 s; the Friendly is patient', () => {
    const padShake = (t: number) => 50 * Math.sin(t * 2 * Math.PI * 4)
    for (const a of ['scaredy', 'peeker', 'grumpy'] as Archetype[]) {
      const { inkAt } = shake(a, padShake)
      expect(inkAt, a).toBeGreaterThan(0)
      expect(inkAt - 0.5, a).toBeLessThan(2)
    }
    expect(shake('friendly', padShake).inkAt - 0.5).toBeGreaterThan(2.5)
  })

  it('a single fast flick is not shaking', () => {
    expect(shake('scaredy', (t) => (t < 0.15 ? 2000 * t : 300) - 0).inkAt).toBe(-1)
  })

  it('hard shaking inks every personality — Scaredy first, Friendly last', () => {
    const times = (['scaredy', 'peeker', 'grumpy', 'friendly'] as Archetype[]).map(
      (a) => shake(a, hardShake).inkAt,
    )
    for (const t of times) expect(t).toBeGreaterThan(0)
    expect(times).toEqual([...times].sort((a, b) => a - b))
    expect(times[0]! - 0.5).toBeLessThan(1.5) // a Scaredy can't take much
    expect(times[3]! - 0.5).toBeGreaterThan(2) // a Friendly is patient
  })

  it('warns before it inks: stress passes the warning level well before, with squeaks', () => {
    const { world, inkAt, warnedAt } = shake('friendly', hardShake)
    expect(warnedAt).toBeGreaterThan(0)
    expect(inkAt - warnedAt).toBeGreaterThan(0.4)
    expect(sounds(world, 'squeak').length).toBeGreaterThanOrEqual(2)
  })

  it('after inking: it slips free (even with the button still down), darts off, and the ink spreads', () => {
    const { world, inkAt } = shake('peeker', hardShake, 3)
    expect(inkAt).toBeGreaterThan(0)
    const c = world.creatures[0]!
    expect(world.interaction.hold).toBeNull() // the button is still down, but it's free
    expect(world.interaction.press).toBeNull() // and not re-grabbed without a fresh press
    expect(['flee', 'hide']).toContain(c.mind.intent)
    expect(world.ink.pool.some((p) => p.active)).toBe(true)
    expect(c.perception.rattled).toBeGreaterThan(0.9)
    expect(c.perception.trust).toBeLessThanOrEqual(1 - c.perception.rattled)
    expect(c.expression.emote?.kind).toBe('exclaim')
  })

  it('jets away after inking: briefly faster than its normal flee speed, well clear within a second', () => {
    const world = staged([{ archetype: 'scaredy', x: 640, y: 360 }])
    const c = world.creatures[0]!
    let inkedAt = -1
    let from = { x: 0, y: 0 }
    let fastest = 0
    let clearedAfter1s = -1
    play(
      world,
      (t) => ({ x: 640 + (t < 0.5 ? 0 : hardShake(t)), y: 360, pressed: true }),
      4,
      () => {
        if (inkedAt < 0 && sounds(world, 'ink').length > 0) {
          inkedAt = world.time
          from = { x: c.position.x, y: c.position.y }
        }
        if (inkedAt > 0 && world.time - inkedAt < 0.3)
          fastest = Math.max(fastest, Math.hypot(c.velocity.x, c.velocity.y))
        if (inkedAt > 0 && clearedAfter1s < 0 && world.time - inkedAt >= 1) {
          clearedAfter1s = Math.hypot(c.position.x - from.x, c.position.y - from.y)
        }
      },
    )
    expect(inkedAt).toBeGreaterThan(0)
    expect(fastest).toBeGreaterThan(speedLimit(c) * 1.5) // a jet, not a normal swim
    expect(clearedAfter1s).toBeGreaterThan(120)
  })

  it('stays rattled for a while: trust is capped, and a Peeker is slower to come back', () => {
    /** After optionally inking, the hand rests calmly nearby; seconds until the Peeker comes to look again. */
    function comeBack(inked: boolean) {
      const world = staged([{ archetype: 'peeker', x: 640, y: 360 }])
      if (inked) {
        play(world, (t) => ({ x: 640 + (t < 0.5 ? 0 : hardShake(t)), y: 360, pressed: true }), 4)
        expect(sounds(world, 'ink')).toHaveLength(1)
      }
      const start = world.time
      let curiousAt = -1
      let maxTrustOverCap = -Infinity
      play(
        world,
        () => ({ x: 640, y: 300, pressed: false }),
        40,
        () => {
          const c = world.creatures[0]!
          maxTrustOverCap = Math.max(
            maxTrustOverCap,
            c.perception.trust - (1 - c.perception.rattled),
          )
          if (curiousAt < 0 && c.mind.intent === 'peek') curiousAt = world.time - start
        },
      )
      return { curiousAt, maxTrustOverCap }
    }
    const calm = comeBack(false)
    const inked = comeBack(true)
    expect(inked.maxTrustOverCap).toBeLessThanOrEqual(1e-9) // trust never above 1 − rattled
    expect(calm.curiousAt).toBeGreaterThanOrEqual(0)
    // Inked, it hides out of range and stays away a long time (often the whole 40 s) — far later either way.
    const inkedAt = inked.curiousAt < 0 ? Infinity : inked.curiousAt
    expect(inkedAt).toBeGreaterThan(calm.curiousAt + 3)
  })
})

describe('ink reactions by personality (task #27)', () => {
  const padShake = (t: number) => 50 * Math.sin(t * 2 * Math.PI * 4)

  /** Shake until the limit, release, then move the hand along `after` (from the moment of the squirt). */
  function react(
    archetype: Archetype,
    after: (t: number) => { x: number; y: number; active?: boolean; pressed?: boolean },
    seconds = 10,
    each?: (world: World, sinceLimit: number) => void,
  ) {
    const world = staged([{ archetype, x: 640, y: 360 }])
    let limitAt = -1
    for (let i = 0; i < Math.round(seconds / DT); i++) {
      const t = world.time
      if (limitAt < 0) {
        setPresenceInput(world.presence, 640 + (t < 0.5 ? 0 : padShake(t - 0.5)), 360, true, true)
      } else {
        const h = after(t - limitAt)
        setPresenceInput(world.presence, h.x, h.y, h.active ?? true, h.pressed ?? false)
      }
      stepWorld(world, DT)
      if (limitAt < 0 && sounds(world, 'ink').length + sounds(world, 'hiccup').length > 0) {
        limitAt = world.time
      }
      if (limitAt > 0) each?.(world, world.time - limitAt)
    }
    return world
  }

  /** World times at which an ink squirt sounded. */
  function inkTimes(world: World, record: number[]) {
    const n = sounds(world, 'ink').length
    while (record.length < n) record.push(world.time)
  }

  it('a mad Grumpy chases the hand, squirting whenever it is close — never more often than every 0.5 s', () => {
    const times: number[] = []
    const intents = new Set<string>()
    const world = react(
      'grumpy',
      () => ({ x: 640, y: 360 }),
      9,
      (w, since) => {
        inkTimes(w, times)
        if (since < INTERACTION.chaseSeconds - 0.1) intents.add(w.creatures[0]!.mind.intent)
      },
    )
    expect([...intents]).toEqual(['chase'])
    expect(times.length).toBeGreaterThanOrEqual(5) // the first cloud + several chase squirts
    for (let i = 1; i < times.length; i++) {
      expect(times[i]! - times[i - 1]!).toBeGreaterThanOrEqual(INTERACTION.chaseInkEvery - 1e-9)
    }
    expect(world.interaction.chase).toBeNull() // gave up…
    expect(world.creatures[0]!.mind.intent).toBe('standoff') // …and glares
  })

  it('it stops just short of a still hand (its tentacles end just before the cursor) — not on top of it', () => {
    const gaps: number[] = []
    react(
      'grumpy',
      () => ({ x: 900, y: 360 }),
      4.5,
      (w, since) => {
        const c = w.creatures[0]!
        if (since > 2 && c.mind.intent === 'chase')
          gaps.push(Math.hypot(900 - c.position.x, 360 - c.position.y))
      },
    )
    const stop = 30 * INTERACTION.chaseStop
    expect(gaps.length).toBeGreaterThan(0)
    for (const g of gaps) {
      expect(g).toBeGreaterThan(stop - 10) // not on the cursor
      expect(g).toBeLessThan(INTERACTION.chaseInkRange) // but close enough to ink
    }
  })

  it('walking away is not enough: a hand leaving at 300 px/s gets caught and inked', () => {
    const times: number[] = []
    react(
      'grumpy',
      (t) => ({ x: 640 + 300 * t, y: 360 }),
      6,
      (w) => inkTimes(w, times),
    )
    expect(times.length).toBeGreaterThanOrEqual(2) // the first cloud + at least one chase squirt
  })

  it('it chases far faster than it swims — as fast as a quick hand', () => {
    let fastest = 0
    react(
      'grumpy',
      (t) => ({ x: 640 + (t < 0.3 ? 0 : 500), y: 360 }),
      3,
      (w) => {
        const c = w.creatures[0]!
        if (c.mind.intent === 'chase')
          fastest = Math.max(fastest, Math.hypot(c.velocity.x, c.velocity.y))
      },
    )
    expect(fastest).toBeGreaterThan(500)
    expect(fastest).toBeLessThanOrEqual(INTERACTION.chaseSpeed + 1e-6)
  })

  it('but a visitor can dodge it: circling fast around it keeps the hand out of inking range', () => {
    // Fast circles (~1000 px/s) around the middle of the pool: it keeps cutting the corner behind the hand.
    const times: number[] = []
    const circle = (t: number) => {
      const a = 4 * t // 250 px × 4 rad/s = 1000 px/s
      return { x: 640 + 250 * Math.cos(a), y: 330 + 250 * Math.sin(a) }
    }
    let closest = Infinity
    react('grumpy', circle, 6, (w, since) => {
      inkTimes(w, times)
      const c = w.creatures[0]!
      if (since > 0.3 && c.mind.intent === 'chase') {
        const p = w.presence.position
        closest = Math.min(closest, Math.hypot(p.x - c.position.x, p.y - c.position.y))
      }
    })
    expect(times).toHaveLength(1) // only the first cloud — it never caught up
    expect(closest).toBeGreaterThan(INTERACTION.chaseInkRange) // and not just luck with the cooldown
  })

  it('the chase ends early when the visitor leaves the pool or grabs the Grumpy again', () => {
    const left = react('grumpy', (t) => ({ x: 640, y: 360, active: t < 1 }), 4)
    expect(left.interaction.chase).toBeNull()
    expect(left.creatures[0]!.mind.intent).not.toBe('chase')

    // Press right on the chasing Grumpy (the hand follows it) and hold.
    let grabbedDuringChase = false
    const grumpyAt = { x: 640, y: 360 }
    react(
      'grumpy',
      (t) => ({ ...grumpyAt, pressed: t > 1 }),
      4,
      (w) => {
        const c = w.creatures[0]!
        if (!w.interaction.hold) Object.assign(grumpyAt, { x: c.position.x, y: c.position.y })
        if (w.interaction.hold) grabbedDuringChase = w.interaction.chase === null
      },
    )
    expect(grabbedDuringChase).toBe(true)
  })

  it('a Friendly only hiccups a tiny puff, gets dizzy (looping, still in the water), then forgives with a ♥', () => {
    const bounds = { ok: true }
    let dizzySeconds = 0
    let heartAt = -1
    let approachAt = -1
    let maxRattled = 0
    const world = react(
      'friendly',
      () => ({ x: 640, y: 300 }),
      12,
      (w, since) => {
        const c = w.creatures[0]!
        if (c.mind.intent === 'dizzy') dizzySeconds += DT
        if (heartAt < 0 && c.expression.emote?.kind === 'heart') heartAt = since
        if (approachAt < 0 && c.mind.intent === 'approach') approachAt = since
        maxRattled = Math.max(maxRattled, c.perception.rattled)
        const f = footprint(c.position, c.size)
        if (f.y + f.radius > swimBounds(w).height + 1e-6) bounds.ok = false
      },
    )
    expect(sounds(world, 'ink')).toHaveLength(0) // no cloud…
    expect(sounds(world, 'hiccup')).toHaveLength(1) // …just a hic!
    expect(dizzySeconds).toBeCloseTo(INTERACTION.dizzySeconds, 0)
    expect(bounds.ok).toBe(true)
    expect(heartAt).toBeGreaterThan(INTERACTION.dizzySeconds - 0.1)
    expect(heartAt).toBeLessThan(INTERACTION.dizzySeconds + 0.2)
    expect(approachAt).toBeGreaterThan(0)
    expect(approachAt).toBeLessThan(INTERACTION.dizzySeconds + 3) // comes right back
    expect(maxRattled).toBeLessThanOrEqual(INTERACTION.forgiveRattled + 1e-9) // no grudge
    expect(world.creatures[0]!.perception.trust).toBeGreaterThan(0.5)
  })

  it('a dizzy Friendly really loops (its heading turns all the way round)', () => {
    let turned = 0
    let last: number | null = null
    react(
      'friendly',
      () => ({ x: 640, y: 300 }),
      6,
      (w) => {
        const c = w.creatures[0]!
        if (c.mind.intent !== 'dizzy') return
        const heading = Math.atan2(c.velocity.y, c.velocity.x)
        if (last !== null) {
          let d = heading - last
          while (d > Math.PI) d -= 2 * Math.PI
          while (d < -Math.PI) d += 2 * Math.PI
          turned += d
        }
        last = heading
      },
    )
    expect(Math.abs(turned)).toBeGreaterThan(2 * Math.PI) // at least one full loop
  })
})

describe('turn and fire (a chasing Grumpy aims its tentacles at the hand)', () => {
  function chasing() {
    const world = staged([{ archetype: 'grumpy', x: 640, y: 360 }])
    world.interaction.chase = { creatureId: 1, until: 10, nextInkAt: 0 }
    return world
  }
  const at = (world: World, x: number) => setPresenceInput(world.presence, x, 360, true, false)

  it('aims fully within inking range, not at all when far, and blends in between', () => {
    const world = chasing()
    const c = world.creatures[0]!
    const aimWithHandAt = (dx: number) => {
      at(world, 640 + dx)
      stepPresenceOnly(world)
      return aimAtHand(world, c)
    }
    expect(aimWithHandAt(INTERACTION.chaseInkRange - 5)).toBe(1)
    expect(aimWithHandAt(INTERACTION.chaseInkRange * INTERACTION.aimFade + 5)).toBe(0)
    const mid = aimWithHandAt(INTERACTION.chaseInkRange * (1 + (INTERACTION.aimFade - 1) / 2))
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1)
  })

  it('never aims when not chasing', () => {
    const world = staged([{ archetype: 'grumpy', x: 640, y: 360 }])
    at(world, 650)
    stepPresenceOnly(world)
    expect(aimAtHand(world, world.creatures[0]!)).toBe(0)
  })

  it('chase squirts come out of the tentacle end, toward the hand', () => {
    const times: number[] = []
    let checked = false
    const world = staged([{ archetype: 'grumpy', x: 640, y: 360 }])
    let limitAt = -1
    play(
      world,
      (t) => ({
        x: 640 + (t < 0.5 ? 0 : limitAt < 0 ? 50 * Math.sin((t - 0.5) * 8 * Math.PI) : 0),
        y: 360,
        pressed: limitAt < 0,
      }),
      5,
      () => {
        if (limitAt < 0 && sounds(world, 'ink').length > 0) limitAt = world.time
        const before = times.length
        inkTimesOf(world, times)
        if (before === 1 && times.length === 2 && !checked) {
          // The newest puffs (the first chase squirt) start nearer the hand than the creature's center does.
          const c = world.creatures[0]!
          const hand = world.presence.position
          const puffs = world.ink.pool.filter((p) => p.active && p.bornAt >= world.time - 0.2)
          const centerGap = Math.hypot(hand.x - c.position.x, hand.y - c.position.y)
          for (const p of puffs)
            expect(Math.hypot(hand.x - p.x0, hand.y - p.y0)).toBeLessThan(centerGap)
          checked = puffs.length > 0
        }
      },
    )
    expect(checked).toBe(true)
  })
})

/** Update just the presence (so `aimAtHand` sees the new hand position) without stepping creatures. */
function stepPresenceOnly(world: World) {
  updatePresence(world.presence, DT)
}

function inkTimesOf(world: World, record: number[]) {
  const n = sounds(world, 'ink').length
  while (record.length < n) record.push(world.time)
}
