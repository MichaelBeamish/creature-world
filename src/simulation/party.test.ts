import { describe, expect, it } from 'vitest'
import { setPresenceInput } from './presence'
import { beatsAt, PARTY } from './party'
import { canTake, DISCO, dropProp, removeProp } from './props'
import { createWorld, stepWorld, type World } from './world'

const DT = 1 / 60
const run = (w: World, seconds: number) => {
  for (let t = 0; t < seconds; t += DT) stepWorld(w, DT)
}

describe('the disco ball (task #32a)', () => {
  it('floats slowly up to just below the top, where it was let go, then hangs there spinning', () => {
    const w = createWorld({ seed: 3, width: 1280, height: 720, creatureCount: 0 })
    const ball = dropProp(w, 'discoBall', 700, 500)
    run(w, 1)
    expect(ball.position.y).toBeLessThan(500)
    expect(500 - ball.position.y).toBeLessThanOrEqual(DISCO.riseSpeed * 1.05) // slowly
    run(w, 20)
    expect(ball.position.y).toBeCloseTo(DISCO.hangY, 0)
    expect(ball.position.x).toBe(700) // straight up, where it was placed
    const angle = ball.angle
    run(w, 1)
    expect(ball.angle).toBeGreaterThan(angle) // still spinning
  })

  it('there is only one disco ball', () => {
    const w = createWorld({ seed: 3, width: 1280, height: 720, creatureCount: 0 })
    expect(canTake(w, 'discoBall')).toBe(true)
    dropProp(w, 'discoBall', 700, 500)
    expect(canTake(w, 'discoBall')).toBe(false)
  })
})

describe('the party', () => {
  it('is on while the disco ball is out, fades in, and fades back out when it goes away', () => {
    const w = createWorld({ seed: 3, width: 1280, height: 720, creatureCount: 0 })
    run(w, 1)
    expect(w.party.on).toBe(false)
    expect(w.party.level).toBe(0)
    const ball = dropProp(w, 'discoBall', 700, 500)
    run(w, 1)
    expect(w.party.on).toBe(true)
    expect(w.party.level).toBeGreaterThan(0)
    expect(w.party.level).toBeLessThan(1) // fading in
    run(w, PARTY.fadeIn)
    expect(w.party.level).toBe(1)
    removeProp(w, ball.id) // back in the chest
    run(w, DT)
    expect(w.party.on).toBe(false)
    run(w, PARTY.fadeOut)
    expect(w.party.level).toBe(0)
  })

  it('stays on while the visitor carries the ball somewhere else', () => {
    const w = createWorld({ seed: 3, width: 1280, height: 720, creatureCount: 0 })
    const ball = dropProp(w, 'discoBall', 700, 500)
    run(w, 1)
    removeProp(w, ball.id)
    w.interaction.carry = { kind: 'discoBall' }
    run(w, 1)
    expect(w.party.on).toBe(true)
  })

  it('keeps one beat clock: beats count up at the tempo from the start of the party', () => {
    const w = createWorld({ seed: 3, width: 1280, height: 720, creatureCount: 0 })
    expect(beatsAt(w)).toBe(0)
    dropProp(w, 'discoBall', 700, 500)
    run(w, 3)
    expect(beatsAt(w)).toBeCloseTo((3 * PARTY.bpm) / 60, 0)
  })

  it('moving the ball mid-party keeps the music going (the beat clock does not restart)', () => {
    const w = createWorld({ seed: 3, width: 1280, height: 720, creatureCount: 0 })
    const first = dropProp(w, 'discoBall', 700, 500)
    run(w, 2)
    const before = beatsAt(w)
    removeProp(w, first.id)
    dropProp(w, 'discoBall', 400, 300)
    run(w, DT)
    expect(beatsAt(w)).toBeGreaterThan(before)
  })
})

it('the hanging disco ball can be grabbed and moved', () => {
  const w = createWorld({ seed: 3, width: 1280, height: 720, creatureCount: 0 })
  dropProp(w, 'discoBall', 700, 450)
  for (let t = 0; t < 20; t += 1 / 60) stepWorld(w, 1 / 60)
  const ball = w.props.items.find((p) => p.kind === 'discoBall')!
  expect(ball.position.y).toBeCloseTo(DISCO.hangY, 0)
  const steps: [number, number, boolean][] = [
    [700, DISCO.hangY, false],
    [700, DISCO.hangY, true],
    [600, 200, true],
    [500, 300, true],
    [500, 300, false],
  ]
  for (const [x, y, pressed] of steps) {
    setPresenceInput(w.presence, x, y, true, pressed)
    stepWorld(w, 1 / 60)
  }
  const moved = w.props.items.find((p) => p.kind === 'discoBall')!
  expect(moved.position.x).toBe(500)
  expect(w.party.on).toBe(true)
})
