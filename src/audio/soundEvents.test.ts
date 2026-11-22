import { describe, expect, it } from 'vitest'
import { createWorld } from '../simulation/world'
import { createEmoteWatcher } from './soundEvents'

describe('createEmoteWatcher', () => {
  it('reports a new emote exactly once, even while it stays on screen', () => {
    const world = createWorld({ seed: 1, width: 1280, height: 720, creatureCount: 3 })
    const watch = createEmoteWatcher()
    expect(watch(world)).toEqual([])

    world.creatures[1]!.expression.emote = { kind: 'exclaim', age: 0 }
    const first = watch(world)
    expect(first).toHaveLength(1)
    expect(first[0]!.creature.id).toBe(world.creatures[1]!.id)
    expect(first[0]!.kind).toBe('exclaim')

    world.creatures[1]!.expression.emote!.age = 0.5 // same emote, still showing
    expect(watch(world)).toEqual([])
  })

  it('a later emote of the same kind is a new event', () => {
    const world = createWorld({ seed: 1, width: 1280, height: 720, creatureCount: 1 })
    const watch = createEmoteWatcher()
    world.creatures[0]!.expression.emote = { kind: 'question', age: 0 }
    expect(watch(world)).toHaveLength(1)
    world.creatures[0]!.expression.emote = null
    expect(watch(world)).toEqual([])
    world.creatures[0]!.expression.emote = { kind: 'question', age: 0 }
    expect(watch(world)).toHaveLength(1)
  })

  it('tracks creatures independently and never changes the world', () => {
    const world = createWorld({ seed: 1, width: 1280, height: 720, creatureCount: 3 })
    world.creatures[0]!.expression.emote = { kind: 'anger', age: 0 }
    world.creatures[2]!.expression.emote = { kind: 'heart', age: 0 }
    const before = structuredClone(world)
    const watch = createEmoteWatcher()
    expect(watch(world).map((e) => e.kind)).toEqual(['anger', 'heart'])
    expect(world).toEqual(before)
  })
})

describe('interaction sounds', () => {
  it('reports each grab / squeak / boop exactly once, in the creature’s own voice', () => {
    const world = createWorld({ seed: 1, width: 800, height: 600, creatureCount: 3 })
    const watch = createEmoteWatcher()
    world.interaction.sounds.push({ kind: 'grab', creatureId: 2 })
    expect(watch(world).map((e) => [e.kind, e.creature.id])).toEqual([['grab', 2]])
    expect(watch(world)).toEqual([])
    world.interaction.sounds.push(
      { kind: 'squeak', creatureId: 2 },
      { kind: 'squeak', creatureId: 2 },
    )
    expect(watch(world).map((e) => e.kind)).toEqual(['squeak', 'squeak'])
  })
})

describe('ink sound', () => {
  it('reports an ink puff once, tagged so the canvas plays a noise puff instead of a chirp', () => {
    const world = createWorld({ seed: 1, width: 800, height: 600, creatureCount: 2 })
    const watch = createEmoteWatcher()
    world.interaction.sounds.push({ kind: 'ink', creatureId: 1 })
    expect(watch(world).map((e) => [e.kind, e.creature.id])).toEqual([['ink', 1]])
    expect(watch(world)).toEqual([])
  })
})
