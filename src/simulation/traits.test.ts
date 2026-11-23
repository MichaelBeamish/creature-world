import { describe, expect, it } from 'vitest'
import { createRng } from './rng'
import {
  ARCHETYPE_DECK,
  EXTRA_DECK,
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

  it('never two Grumpies or two Friendlies — only the Peeker and the Scaredy repeat (task #37)', () => {
    for (let seed = 1; seed <= 300; seed++) {
      for (let count = 1; count <= 6; count++) {
        const dealt = dealArchetypes(createRng(seed), count)
        const n = (a: string) => dealt.filter((x) => x === a).length
        expect(dealt).toHaveLength(count)
        expect(n('grumpy')).toBeLessThanOrEqual(1)
        expect(n('friendly')).toBeLessThanOrEqual(1)
        expect(n('peeker')).toBeLessThanOrEqual(2)
        expect(n('scaredy')).toBeLessThanOrEqual(2)
        if (count >= 4) expect(new Set(dealt)).toEqual(new Set(ARCHETYPE_DECK))
      }
    }
  })

  it('five creatures: all four plus a Peeker or a Scaredy (either can be the extra)', () => {
    const extras = new Set<string>()
    for (let seed = 1; seed <= 50; seed++) {
      const dealt = dealArchetypes(createRng(seed), 5)
      const extra = ARCHETYPE_DECK.find((a) => dealt.filter((x) => x === a).length === 2)!
      expect(EXTRA_DECK).toContain(extra)
      extras.add(extra)
    }
    expect(extras.size).toBe(2)
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
