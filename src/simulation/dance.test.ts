import { describe, expect, it } from 'vitest'
import { DANCE, danceStyle, danceTarget } from './dance'
import { beatsAt, PARTY, PARTY_SONG_MAP } from './party'
import { dropProp, removeProp } from './props'
import { swimBounds } from './scenery'
import { ARCHETYPES, type Archetype } from './traits'
import { vec2 } from './vec2'
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

const run = (w: World, seconds: number) => {
  for (let t = 0; t < seconds; t += DT) stepWorld(w, DT)
}
/** Seconds into the party song at the start of bar `bar`. */
const barSeconds = (bar: number) => (bar * 4 * 60) / PARTY.bpm

const ALL: [Archetype, number, number][] = [
  ['friendly', 300, 300],
  ['peeker', 500, 300],
  ['scaredy', 700, 300],
  ['grumpy', 900, 300],
]

describe('dancing at the party (task #32d)', () => {
  it('each personality has its own style (by trait dials)', () => {
    const w = make(ALL)
    expect(w.creatures.map(danceStyle)).toEqual(['bounce', 'sway', 'shy', 'sulk'])
  })

  it('when the party starts, the calm ones dance and the Grumpy sulks — and they notice it', () => {
    const w = make(ALL)
    dropProp(w, 'discoBall', 640, 500)
    run(w, 4)
    expect(w.creatures.map((c) => c.mind.intent)).toEqual(['dance', 'dance', 'dance', 'sulk'])
    for (const c of w.creatures) expect(c.mind.dance!.noticed).toBe(true)
  })

  it('the Grumpy goes to the bottom-right corner', () => {
    const w = make(ALL)
    dropProp(w, 'discoBall', 640, 500)
    run(w, 25)
    const g = w.creatures[3]!
    const bounds = swimBounds(w)
    expect(g.position.x).toBeGreaterThan(bounds.width - DANCE.corner.right - 60)
    expect(g.position.y).toBeGreaterThan(bounds.height - DANCE.corner.bottom - 60)
  })

  it('dances small in the build and all-out in the drop', () => {
    const w = make([['friendly', 640, 300]])
    dropProp(w, 'discoBall', 640, 500)
    run(w, barSeconds(PARTY_SONG_MAP.build + 2))
    const inBuild = w.creatures[0]!.mind.dance!.amount
    run(w, barSeconds(PARTY_SONG_MAP.drop + 2) - barSeconds(PARTY_SONG_MAP.build + 2))
    const inDrop = w.creatures[0]!.mind.dance!.amount
    expect(inBuild).toBeLessThan(0.5)
    expect(inDrop).toBeGreaterThan(0.9)
  })

  it('the Scaredy gets braver: closer to the floor and bigger moves over time', () => {
    const w = make([['scaredy', 640, 300]])
    dropProp(w, 'discoBall', 640, 500)
    const c = w.creatures[0]!
    run(w, 3)
    const ball = w.props.items.find((p) => p.kind === 'discoBall')!
    const spot = (out = vec2()) => danceTarget(w, c, out)
    const early = Math.hypot(
      spot().x - ball.position.x,
      spot().y - swimBounds(w).height * DANCE.floorY,
    )
    run(w, DANCE.braveSeconds)
    const late = Math.hypot(
      spot().x - ball.position.x,
      spot().y - swimBounds(w).height * DANCE.floorY,
    )
    expect(late).toBeLessThan(early)
  })

  it('being held still wins — and when the party ends, everyone stops dancing', () => {
    const w = make([['friendly', 640, 300]])
    const ball = dropProp(w, 'discoBall', 640, 500)
    run(w, 4)
    expect(w.creatures[0]!.mind.intent).toBe('dance')
    removeProp(w, ball.id) // back in the chest
    run(w, 1)
    expect(w.creatures[0]!.mind.intent).not.toBe('dance')
    expect(w.creatures[0]!.mind.dance).toBeNull()
  })

  it('food comes first', () => {
    const w = make([['friendly', 640, 400]])
    dropProp(w, 'discoBall', 300, 500)
    run(w, 4)
    dropProp(w, 'shrimp', 660, 420)
    run(w, 0.5)
    expect(w.creatures[0]!.mind.intent).toBe('eat')
  })

  it('in the drops, dancers puff bubbles on the beat', () => {
    const w = make([['friendly', 640, 300]])
    dropProp(w, 'discoBall', 640, 500)
    run(w, barSeconds(PARTY_SONG_MAP.drop))
    const before = w.bubbles.next
    run(w, barSeconds(8)) // 8 bars of the drop
    const puffs = (w.bubbles.next - before + w.bubbles.pool.length) % w.bubbles.pool.length
    expect(puffs).toBeGreaterThan(0)
    expect(beatsAt(w)).toBeGreaterThan(PARTY_SONG_MAP.drop * 4)
  })

  it('the timid dancers keep their distance from the disco ball itself', () => {
    const w = make([
      ['peeker', 640, 300],
      ['scaredy', 660, 320],
    ])
    dropProp(w, 'discoBall', 640, 400)
    run(w, 12) // once the ball hangs at the top (while it rises, it floats up through the floor)
    for (let t = 0; t < 90; t += 1) {
      run(w, 1)
      const ball = w.props.items.find((p) => p.kind === 'discoBall')!
      for (const c of w.creatures) {
        const spot = danceTarget(w, c, vec2())
        expect(
          Math.hypot(spot.x - ball.position.x, spot.y - ball.position.y),
        ).toBeGreaterThanOrEqual(DANCE.ballClear - 1)
      }
    }
  })
})
