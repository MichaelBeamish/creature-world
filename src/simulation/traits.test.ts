import { describe, expect, it } from 'vitest'
import { createRng } from './rng'
import {
  ARCHETYPE_DECK,
  ARCHETYPES,
  createTraits,
  dealArchetypes,
  ENERGY_RANGE,
  TRAIT_VARIATION,
} from './traits'

describe('dealArchetypes', () => {
  it('deals all four personalities to four creatures (without replacement)', () => {
    for (const seed of [1, 2, 3, 42, 99]) {
      const dealt = dealArchetypes(createRng(seed), 4)
      expect(new Set(dealt)).toEqual(new Set(ARCHETYPE_DECK))
    }
  })

  it('five creatures get all four plus one repeat; eight get each twice', () => {
    const five = dealArchetypes(createRng(7), 5)
    expect(new Set(five).size).toBe(4)
    const eight = dealArchetypes(createRng(7), 8)
    for (const a of ARCHETYPE_DECK) expect(eight.filter((x) => x === a)).toHaveLength(2)
  })

  it('is deterministic and the order varies by seed', () => {
    expect(dealArchetypes(createRng(5), 4)).toEqual(dealArchetypes(createRng(5), 4))
    const orders = new Set([1, 2, 3, 4, 5, 6].map((s) => dealArchetypes(createRng(s), 4).join()))
    expect(orders.size).toBeGreaterThan(1)
  })
})

describe('createTraits', () => {
  it('stays within the archetype dials ± variation, energy in range', () => {
    const rng = createRng(11)
    for (const archetype of ARCHETYPE_DECK) {
      for (let i = 0; i < 200; i++) {
        const t = createTraits(rng, archetype)
        const base = ARCHETYPES[archetype]
        expect(Math.abs(t.curiosity - base.curiosity)).toBeLessThanOrEqual(TRAIT_VARIATION)
        expect(Math.abs(t.boldness - base.boldness)).toBeLessThanOrEqual(TRAIT_VARIATION)
        expect(t.energy).toBeGreaterThanOrEqual(ENERGY_RANGE[0])
        expect(t.energy).toBeLessThan(ENERGY_RANGE[1])
      }
    }
  })
})
