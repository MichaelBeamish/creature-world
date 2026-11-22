import { describe, expect, it } from 'vitest'
import { createWorld, stepWorld } from '../simulation/world'
import { createDebugSnapshot, createPublisher } from './debugSnapshot'

const FRAME = { fps: 60, avgFrameMs: 1.8, worstFrameMs: 3.1 }

describe('createDebugSnapshot', () => {
  it('copies the values the panel needs from the world', () => {
    const world = createWorld({ seed: 42, width: 1280, height: 720, creatureCount: 5 })
    for (let i = 0; i < 30; i++) stepWorld(world, 1 / 60)
    const snap = createDebugSnapshot(world, 42, FRAME)
    expect(snap.seed).toBe(42)
    expect(snap.tick).toBe(30)
    expect(snap.frame).toEqual(FRAME)
    expect(snap.creatures).toHaveLength(5)
    world.creatures.forEach((c, i) => {
      const s = snap.creatures[i]!
      expect(s).toEqual({
        id: c.id,
        hue: c.hue,
        archetype: c.archetype,
        emotion: c.mind.emotion.kind,
        intent: c.mind.intent,
        stimulus: c.perception.stimulus,
        curiosity: c.traits.curiosity,
        boldness: c.traits.boldness,
        energy: c.traits.energy,
        attention: c.perception.attention,
        trust: c.perception.trust,
        rattled: c.perception.rattled,
      })
    })
  })

  it('is an independent plain copy (the world changing later does not change it)', () => {
    const world = createWorld({ seed: 1, width: 1280, height: 720, creatureCount: 3 })
    const frame = { ...FRAME }
    const snap = createDebugSnapshot(world, 1, frame)
    const before = structuredClone(snap)
    for (let i = 0; i < 120; i++) stepWorld(world, 1 / 60)
    world.creatures[0]!.traits.curiosity = 0
    frame.fps = 1
    expect(snap).toEqual(before)
  })
})

describe('createPublisher', () => {
  it('fires at most once per interval (≤ 5 per second at 200 ms)', () => {
    const publish = createPublisher(200)
    let fired = 0
    for (let t = 0; t < 1000; t += 1000 / 144) if (publish(t)) fired++ // a 144 Hz display for 1 s
    expect(fired).toBe(5)
  })

  it('fires immediately the first time', () => {
    expect(createPublisher(200)(12345)).toBe(true)
  })
})
