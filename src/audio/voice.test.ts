import { describe, expect, it } from 'vitest'

import { ARCHETYPES, type Archetype } from '../simulation/traits'
import { createWorld } from '../simulation/world'
import { baseStep, chirpFor, panFor, pentatonicHz, type VoiceKind } from './voice'

/** Every sound a creature can make: emotes and interaction sounds (task #20). */
const EMOTES: VoiceKind[] = ['question', 'exclaim', 'anger', 'heart', 'grab', 'squeak', 'boop']

function creature(archetype: Archetype, size: number, id = 1) {
  const c = createWorld({ seed: 3, width: 1280, height: 720, creatureCount: 1 }).creatures[0]!
  c.id = id
  c.archetype = archetype
  c.traits = { ...ARCHETYPES[archetype], energy: 0.6 }
  c.size = size
  return c
}

describe('pentatonicHz', () => {
  it('walks the C-major pentatonic scale (C D E G A) across octaves', () => {
    expect(pentatonicHz(0)).toBeCloseTo(261.63, 2) // C4
    expect(pentatonicHz(3)).toBeCloseTo(261.63 * 2 ** (7 / 12), 2) // G4
    expect(pentatonicHz(5)).toBeCloseTo(523.26, 1) // C5
    expect(pentatonicHz(-1)).toBeCloseTo(261.63 * 2 ** (-3 / 12), 2) // A3
  })
})

describe('chirpFor', () => {
  it('is deterministic: the same creature and emote always sound the same', () => {
    const c = creature('friendly', 30)
    for (const e of EMOTES) expect(chirpFor(c, e)).toEqual(chirpFor(c, e))
  })

  it('every creature in a world has its own voice', () => {
    const world = createWorld({ seed: 42, width: 1280, height: 720, creatureCount: 5 })
    for (const e of EMOTES) {
      const specs = world.creatures.map((c) => JSON.stringify(chirpFor(c, e)))
      expect(new Set(specs).size).toBe(specs.length)
    }
  })

  it('bigger creatures sound lower', () => {
    const small = chirpFor(creature('friendly', 24), 'question').notes[0]!.startHz
    const big = chirpFor(creature('friendly', 40), 'question').notes[0]!.startHz
    expect(big).toBeLessThan(small)
  })

  it('timbre follows the personality', () => {
    expect(chirpFor(creature('friendly', 30), 'question').wave).toBe('sine')
    expect(chirpFor(creature('grumpy', 30), 'question').wave).toBe('sawtooth')
    expect(chirpFor(creature('grumpy', 30), 'question').filterHz).toBeLessThan(1000) // kept soft
    expect(chirpFor(creature('scaredy', 30), 'question').vibratoDepth).toBeGreaterThan(0) // trembles
    // Peekers chirp twice.
    expect(chirpFor(creature('peeker', 30), 'question').notes).toHaveLength(2)
    expect(chirpFor(creature('friendly', 30), 'question').notes).toHaveLength(1)
    // Grumpy sits lower, Scaredy higher, at the same size.
    expect(baseStep(creature('grumpy', 30))).toBeLessThan(baseStep(creature('friendly', 30)))
    expect(baseStep(creature('scaredy', 30))).toBeGreaterThan(baseStep(creature('friendly', 30)))
  })

  it('contour follows the emote', () => {
    const c = creature('friendly', 30)
    const q = chirpFor(c, 'question').notes[0]!
    expect(q.endHz).toBeGreaterThan(q.startHz) // ? rises
    const a = chirpFor(c, 'anger').notes[0]!
    expect(a.endHz).toBeLessThan(a.startHz) // 💢 falls
    expect(chirpFor(c, 'anger').vibratoDepth).toBeGreaterThan(0) // …with a wobble
    expect(chirpFor(c, 'exclaim').notes[0]!.duration).toBeLessThan(0.12) // ! is a quick blip
    const [h1, h2] = chirpFor(c, 'heart').notes
    expect(h2!.startHz).toBeGreaterThan(h1!.startHz) // ♥ two notes going up
    expect(h2!.offset).toBeGreaterThan(h1!.offset)
  })

  it('stays gentle: audible pitches, short chirps, moderate volume', () => {
    for (const archetype of Object.keys(ARCHETYPES) as Archetype[]) {
      for (const size of [24, 30, 36, 40]) {
        for (let id = 1; id <= 20; id++) {
          for (const e of EMOTES) {
            const spec = chirpFor(creature(archetype, size, id), e)
            expect(spec.volume).toBeLessThanOrEqual(0.7)
            for (const n of spec.notes) {
              expect(n.startHz).toBeGreaterThan(80)
              expect(n.startHz).toBeLessThan(2000)
              expect(n.endHz).toBeGreaterThan(80)
              expect(n.endHz).toBeLessThan(2000)
              expect(n.duration).toBeGreaterThan(0.05)
              expect(n.duration).toBeLessThan(0.5)
            }
          }
        }
      }
    }
  })
})

describe('panFor', () => {
  it('maps left / center / right to -0.7 / 0 / 0.7 and clamps outside', () => {
    expect(panFor(0, 1000)).toBeCloseTo(-0.7, 9)
    expect(panFor(500, 1000)).toBeCloseTo(0, 9)
    expect(panFor(1000, 1000)).toBeCloseTo(0.7, 9)
    expect(panFor(-300, 1000)).toBeCloseTo(-0.7, 9)
    expect(panFor(5000, 1000)).toBeCloseTo(0.7, 9)
    expect(panFor(10, 0)).toBe(0)
  })
})
