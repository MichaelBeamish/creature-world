/**
 * Personality = an archetype on trait dials.
 *
 * Every creature has the same dials (curiosity, boldness, energy); an archetype sets them,
 * plus small seeded variation so no two are identical. Archetypes are dealt like cards
 * without replacement, so a world always has a mix of personalities.
 *
 *                 timid (low boldness)    bold (high boldness)
 *   curious       Peeker                  Friendly
 *   not curious   Scaredy                 Grumpy
 */
import { range, type Rng } from './rng'

export type Archetype = 'friendly' | 'peeker' | 'scaredy' | 'grumpy'

export interface Traits {
  /** 0..1 — do I want to get closer to the visitor? */
  curiosity: number
  /** 0..1 — when disturbed: stand my ground (bold) or run (timid)? */
  boldness: number
  /** 0..1 — how quick and intense I am (scales speed). */
  energy: number
}

export const ARCHETYPES: Record<Archetype, { curiosity: number; boldness: number }> = {
  friendly: { curiosity: 0.85, boldness: 0.8 },
  peeker: { curiosity: 0.8, boldness: 0.25 },
  scaredy: { curiosity: 0.2, boldness: 0.15 },
  grumpy: { curiosity: 0.2, boldness: 0.85 },
}

export const ARCHETYPE_DECK: readonly Archetype[] = ['friendly', 'peeker', 'scaredy', 'grumpy']

export const TRAIT_VARIATION = 0.08
export const ENERGY_RANGE = [0.3, 0.9] as const

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/**
 * Deal `count` archetypes without replacement: shuffle the deck, draw, reshuffle when empty.
 * 4 creatures → all four personalities; 5 → all four + one repeat.
 */
export function dealArchetypes(rng: Rng, count: number): Archetype[] {
  const dealt: Archetype[] = []
  let deck: Archetype[] = []
  while (dealt.length < count) {
    if (deck.length === 0) deck = shuffle(rng, [...ARCHETYPE_DECK])
    dealt.push(deck.pop()!)
  }
  return dealt
}

/** Trait dials for an archetype, with small seeded variation. */
export function createTraits(rng: Rng, archetype: Archetype): Traits {
  const base = ARCHETYPES[archetype]
  return {
    curiosity: clamp01(base.curiosity + range(rng, -TRAIT_VARIATION, TRAIT_VARIATION)),
    boldness: clamp01(base.boldness + range(rng, -TRAIT_VARIATION, TRAIT_VARIATION)),
    energy: range(rng, ENERGY_RANGE[0], ENERGY_RANGE[1]),
  }
}

/** Fisher–Yates shuffle with the seeded rng (in place; returns the array). */
function shuffle<T>(rng: Rng, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(range(rng, 0, i + 1))
    ;[items[i], items[j]] = [items[j]!, items[i]!]
  }
  return items
}
