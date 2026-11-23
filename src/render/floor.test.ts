import { describe, expect, it } from 'vitest'
import { CHEST } from '../simulation/props'
import type { SceneryItem } from '../simulation/scenery'
import { createWorld } from '../simulation/world'
import { sceneryAt, underChest } from './floor'

const item = (kind: SceneryItem['kind'], size: number): SceneryItem => ({
  id: 1,
  kind,
  u: 0,
  depth: 0.5,
  size,
  variant: 0,
})

describe('the chest corner (task #42)', () => {
  it('hides rocks, shells and seaweed that would reach under the chest', () => {
    const right = CHEST.left + CHEST.width
    expect(underChest(item('rock', 30), right + 40)).toBe(true) // a wide rock still reaches it
    expect(underChest(item('rock', 30), right + 70)).toBe(false)
    expect(underChest(item('shell', 15), right + 20)).toBe(true)
    expect(underChest(item('shell', 15), right + 40)).toBe(false)
    expect(underChest(item('seaweed', 80), right + 30)).toBe(true)
    expect(underChest(item('seaweed', 80), right + 50)).toBe(false)
  })

  it('on a desktop window, every seeded scenery item stays visible; on a phone, the chest corner is clear', () => {
    for (const seed of [1, 7, 42, 1234, 2024]) {
      const w = createWorld({ seed, width: 1280, height: 720, creatureCount: 0 })
      for (const s of w.scenery) expect(underChest(s, sceneryAt(s, 1280, 720).x)).toBe(false)
    }
  })
})
