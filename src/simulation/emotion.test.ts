import { describe, expect, it } from 'vitest'
import {
  createEmotionState,
  scoreEmotions,
  stepEmotion,
  strongest,
  type EmotionKind,
} from './emotion'
import { createPerception, type Perception } from './perception'
import { ARCHETYPES, TRAIT_VARIATION, type Archetype, type Traits } from './traits'

const DT = 1 / 60

/** Exact archetype dials (no variation) so the table below is deterministic. */
const traitsOf = (a: Archetype): Traits => ({ ...ARCHETYPES[a], energy: 0.6 })

const perceive = (p: Partial<Perception>): Perception => ({ ...createPerception(), ...p })

const SCENARIOS = {
  none: perceive({}),
  calmEarly: perceive({ attention: 0.8, trust: 0, stimulus: 'calm' }),
  calmTrusted: perceive({ attention: 0.8, trust: 1, stimulus: 'calm' }),
  sudden: perceive({ attention: 0.8, startle: 1, stimulus: 'sudden' }),
  chasing: perceive({ attention: 0.9, pressure: 0.9, stimulus: 'chasing' }),
}

// The owner's grid as a table: scenario → expected dominant emotion per archetype.
const EXPECTED: Record<keyof typeof SCENARIOS, Record<Archetype, EmotionKind>> = {
  none: { friendly: 'content', peeker: 'content', scaredy: 'content', grumpy: 'content' },
  calmEarly: { friendly: 'curious', peeker: 'curious', scaredy: 'scared', grumpy: 'content' },
  calmTrusted: { friendly: 'curious', peeker: 'curious', scaredy: 'content', grumpy: 'content' },
  sudden: { friendly: 'scared', peeker: 'scared', scaredy: 'scared', grumpy: 'grumpy' },
  chasing: { friendly: 'curious', peeker: 'scared', scaredy: 'scared', grumpy: 'grumpy' },
}

describe('scoreEmotions — the archetype grid', () => {
  for (const [scenario, expected] of Object.entries(EXPECTED)) {
    for (const [archetype, emotion] of Object.entries(expected)) {
      it(`${scenario}: ${archetype} feels ${emotion}`, () => {
        const scores = scoreEmotions(
          SCENARIOS[scenario as keyof typeof SCENARIOS],
          traitsOf(archetype as Archetype),
        )
        expect(strongest(scores)).toBe(emotion)
      })
    }
  }

  // Real creatures vary ±TRAIT_VARIATION around their archetype. The grid must hold at every corner of that
  // range, not just at the exact dials (a Grumpy that fled from a flick in the browser proved this matters).
  it('holds at every corner of the trait-variation range', () => {
    const v = TRAIT_VARIATION
    for (const [scenario, expected] of Object.entries(EXPECTED)) {
      for (const [archetype, emotion] of Object.entries(expected)) {
        const base = ARCHETYPES[archetype as Archetype]
        for (const dc of [-v, v]) {
          for (const db of [-v, v]) {
            const traits = {
              curiosity: base.curiosity + dc,
              boldness: base.boldness + db,
              energy: 0.6,
            }
            const got = strongest(
              scoreEmotions(SCENARIOS[scenario as keyof typeof SCENARIOS], traits),
            )
            expect(
              got,
              `${scenario} / ${archetype} (curiosity ${dc > 0 ? '+' : '-'}, boldness ${db > 0 ? '+' : '-'})`,
            ).toBe(emotion)
          }
        }
      }
    }
  })

  it('keeps every score in [0, 1]', () => {
    for (const p of Object.values(SCENARIOS)) {
      for (const a of Object.keys(ARCHETYPES) as Archetype[]) {
        for (const v of Object.values(scoreEmotions(p, traitsOf(a)))) {
          expect(v).toBeGreaterThanOrEqual(0)
          expect(v).toBeLessThanOrEqual(1)
        }
      }
    }
  })
})

describe('stepEmotion', () => {
  it('a new creature can change mood immediately (no hold at spawn)', () => {
    const state = createEmotionState()
    for (let i = 0; i < 6; i++) stepEmotion(state, SCENARIOS.sudden, traitsOf('grumpy'), DT)
    expect(state.kind).toBe('grumpy')
  })

  it('settles on the expected emotion over time', () => {
    const state = createEmotionState()
    for (let i = 0; i < 120; i++) stepEmotion(state, SCENARIOS.calmEarly, traitsOf('friendly'), DT)
    expect(state.kind).toBe('curious')
  })

  it('fear is a reflex: a startled Scaredy is scared within one step', () => {
    const state = createEmotionState()
    stepEmotion(state, SCENARIOS.sudden, traitsOf('scaredy'), DT)
    expect(state.kind).toBe('scared')
  })

  it('does not flicker on borderline input (hysteresis)', () => {
    // Peeker under a calm-ish presence where curious and scared are close; wobble attention every step.
    const state = createEmotionState()
    let switches = 0
    let last = state.kind
    for (let i = 0; i < 600; i++) {
      const attention = 0.75 + (i % 2 === 0 ? 0.05 : -0.05)
      stepEmotion(state, perceive({ attention, trust: 0.05 }), traitsOf('peeker'), DT)
      if (state.kind !== last) {
        switches++
        last = state.kind
      }
    }
    expect(switches).toBeLessThanOrEqual(2)
  })

  it('returns to content once the visitor leaves', () => {
    const state = createEmotionState()
    for (let i = 0; i < 60; i++) stepEmotion(state, SCENARIOS.chasing, traitsOf('grumpy'), DT)
    expect(state.kind).toBe('grumpy')
    for (let i = 0; i < 300; i++) stepEmotion(state, SCENARIOS.none, traitsOf('grumpy'), DT)
    expect(state.kind).toBe('content')
  })
})
