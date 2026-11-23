import { describe, expect, it } from 'vitest'
import {
  A_MINOR,
  barNotes,
  chirpDelay,
  DEEP_END,
  deepEndBar,
  midiHz,
  notesBetween,
  SONG,
  SONGS,
  DEEP_END_EXTENDED,
  deepEndExtendedBar,
  PARTY_SONG,
  stepBeat,
} from './music'

const of = (bar: number, instrument: string) =>
  barNotes(bar).filter((n) => n.instrument === instrument)

describe('the party song (task #32b)', () => {
  it('the kick lands on every beat (four on the floor)', () => {
    for (const bar of [0, 1, 5, 7]) {
      expect(of(bar, 'kick').map((n) => n.beat)).toEqual([0, 1, 2, 3].map((b) => bar * 4 + b))
    }
  })

  it('the clap is on beats 2 and 4', () => {
    expect(of(1, 'clap').map((n) => n.beat - 4)).toEqual([1, 3])
  })

  it('the first bar is an intro — just kick and hats — then everything drops in', () => {
    const intro = new Set(barNotes(0).map((n) => n.instrument))
    expect([...intro].sort()).toEqual(['hat', 'kick', 'shaker'])
    const next = new Set(barNotes(1).map((n) => n.instrument))
    for (const i of ['bass', 'stab', 'clap']) expect(next.has(i as never)).toBe(true)
  })

  it('every pitched note is in A minor', () => {
    for (let bar = 0; bar < 16; bar++) {
      for (const n of barNotes(bar)) {
        for (const p of n.pitches) expect(A_MINOR).toContain(((p % 12) + 12) % 12)
      }
    }
  })

  it('the bass is deep: each bar has a root under 70 Hz (octave jumps above it roll the line)', () => {
    for (let bar = 1; bar < 5; bar++) {
      const lowest = Math.min(...of(bar, 'bass').map((n) => midiHz(n.pitches[0]!)))
      expect(lowest).toBeLessThan(70)
    }
  })

  it('swings the offbeat 16ths a little late, and leaves the on-beat ones straight', () => {
    expect(stepBeat(4)).toBe(1)
    expect(stepBeat(3)).toBeCloseTo(0.75 + (SONG.swing - 0.5) * 0.5)
    expect(stepBeat(3)).toBeGreaterThan(0.75)
  })

  it('a filter sweep fills the last bar of every 8-bar section (and the stabs make room)', () => {
    expect(of(7, 'sweep')).toHaveLength(1)
    expect(of(15, 'sweep')).toHaveLength(1)
    expect(of(6, 'sweep')).toHaveLength(0)
    expect(of(7, 'stab')).toHaveLength(0)
  })

  it('the 4-bar loop repeats exactly (outside the intro and the sweeps)', () => {
    const shape = (bar: number) =>
      barNotes(bar).map((n) => [n.instrument, Math.round((n.beat - bar * 4) * 1e6), n.pitches])
    expect(shape(9)).toEqual(shape(1))
    expect(shape(10)).toEqual(shape(2))
  })

  it('notesBetween gives each note exactly once, in time order, across bar boundaries', () => {
    const whole = notesBetween(0, 12)
    const pieces = [...notesBetween(0, 3.3), ...notesBetween(3.3, 7.95), ...notesBetween(7.95, 12)]
    expect(pieces).toEqual(whole)
    for (let i = 1; i < whole.length; i++)
      expect(whole[i]!.beat).toBeGreaterThanOrEqual(whole[i - 1]!.beat)
    expect(notesBetween(5, 5)).toEqual([])
  })
})

describe('chirps in time (task #32b)', () => {
  it('wait for the next half-beat', () => {
    const bpm = 120 // half a second per beat
    expect(chirpDelay(2, bpm)).toBe(0) // already on it
    expect(chirpDelay(2.1, bpm)).toBeCloseTo(0.2)
    expect(chirpDelay(2.6, bpm)).toBeCloseTo(0.2)
  })
})

describe('"Deep End" — builds and drops (task #32b)', () => {
  const deep = SONGS[1]!
  const inBar = (bar: number, instrument: string) =>
    barNotes(bar, deep).filter((n) => n.instrument === instrument)

  it('builds up: the snare roll gets faster bar by bar, with a riser into the drop', () => {
    const counts = [0, 1, 2, 3].map((k) => inBar(DEEP_END.build + k, 'snare').length)
    for (let k = 1; k < 4; k++) expect(counts[k]!).toBeGreaterThan(counts[k - 1]! - 1)
    expect(counts[3]!).toBeGreaterThan(counts[0]! * 3)
    expect(inBar(DEEP_END.build, 'riser')).toHaveLength(1)
  })

  it('leaves the last beat before each drop silent (no kick in the last bar of a build)', () => {
    for (const build of [DEEP_END.build, DEEP_END.build2]) {
      const last = barNotes(build + 3, deep)
      expect(last.filter((n) => n.instrument === 'kick')).toHaveLength(0)
      const lastBeat = (build + 3) * 4 + 3
      expect(last.filter((n) => n.beat >= lastBeat)).toHaveLength(0)
    }
  })

  it('each drop hits with an impact, a big sub and the wobble bass', () => {
    for (const drop of [DEEP_END.drop, DEEP_END.drop2]) {
      expect(inBar(drop, 'impact')).toHaveLength(1)
      expect(inBar(drop, 'sub').length).toBeGreaterThan(0)
      expect(inBar(drop, 'wobble').length).toBeGreaterThan(0)
      expect(inBar(drop, 'kick')).toHaveLength(4)
    }
  })

  it('the two drops have different basslines', () => {
    const line = (bar: number) => inBar(bar, 'wobble').map((n) => Math.round(n.beat * 100))
    expect(line(DEEP_END.drop2 + 1).map((b) => b - 64 * 100)).not.toEqual(line(DEEP_END.drop + 1))
  })

  it('the breakdown has no drums — just pads and a sub', () => {
    const kinds = new Set(barNotes(DEEP_END.breakdown, deep).map((n) => n.instrument))
    expect(kinds.has('kick')).toBe(false)
    expect(kinds.has('pad')).toBe(true)
  })

  it('after the end it loops back to the first build, so the drops keep coming', () => {
    expect(deepEndBar(DEEP_END.length)).toBe(DEEP_END.loopFrom)
    expect(deepEndBar(DEEP_END.length + 4)).toBe(DEEP_END.drop)
  })

  it('every pitched note is in A minor, and the sub goes deep', () => {
    for (let bar = 0; bar < DEEP_END.length; bar++) {
      for (const n of barNotes(bar, deep)) {
        for (const p of n.pitches) expect(A_MINOR).toContain(((p % 12) + 12) % 12)
        if (n.instrument === 'sub') expect(midiHz(n.pitches[0]!)).toBeLessThan(60)
      }
    }
  })
})

describe('"Deep End (Extended)" — the party song', () => {
  const ext = SONGS[2]!
  const S = DEEP_END_EXTENDED
  const inBar = (bar: number, instrument: string) =>
    barNotes(bar, ext).filter((n) => n.instrument === instrument)

  it('is the song the party plays; the other songs are kept', () => {
    expect(PARTY_SONG).toBe(ext)
    expect(SONGS.map((s) => s.name)).toEqual([
      'Tide Pool Groove',
      'Deep End',
      'Deep End (Extended)',
    ])
  })

  it('every section is twice as long as in "Deep End"', () => {
    expect(S.breakdown - S.drop).toBe(2 * (DEEP_END.breakdown - DEEP_END.drop))
    expect(S.length - S.drop2).toBe(2 * (DEEP_END.length - DEEP_END.drop2))
    expect(S.drop - S.build).toBe(2 * (DEEP_END.drop - DEEP_END.build))
    expect(S.length).toBe(2 * DEEP_END.length)
  })

  it('the dancy part keeps going: wobble, sub and kick in every bar of both 16-bar drops', () => {
    for (const start of [S.drop, S.drop2]) {
      for (let bar = start; bar < start + 16; bar++) {
        expect(inBar(bar, 'wobble').length).toBeGreaterThan(0)
        expect(inBar(bar, 'sub').length).toBeGreaterThan(0)
        expect(inBar(bar, 'kick')).toHaveLength(4)
      }
    }
  })

  it('each drop hits with an impact, and evolves halfway (a smaller impact, more parts)', () => {
    for (const start of [S.drop, S.drop2]) {
      expect(inBar(start, 'impact')).toHaveLength(1)
      expect(inBar(start + 8, 'impact')).toHaveLength(1)
      expect(barNotes(start + 9, ext).length).toBeGreaterThan(barNotes(start + 1, ext).length)
    }
  })

  it('builds for 8 bars and leaves the last beat before each drop silent', () => {
    for (const build of [S.build, S.build2]) {
      expect(inBar(build, 'riser')[0]!.length).toBe(32)
      expect(inBar(build + 7, 'snare').length).toBeGreaterThan(inBar(build, 'snare').length * 3)
      const lastBeat = (build + 7) * 4 + 3
      expect(barNotes(build + 7, ext).filter((n) => n.beat >= lastBeat)).toHaveLength(0)
    }
  })

  it('loops back to the first build after ~2 minutes; every note in A minor', () => {
    expect(deepEndExtendedBar(S.length)).toBe(S.loopFrom)
    for (let bar = 0; bar < S.length; bar++) {
      for (const n of barNotes(bar, ext)) {
        for (const p of n.pitches) expect(A_MINOR).toContain(((p % 12) + 12) % 12)
      }
    }
  })
})
