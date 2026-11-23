/**
 * The party's songs (task #32b) as plain data: original deep, bass-heavy house — written from scratch.
 *
 * Time is counted in **beats** on the party's beat clock (`beatsAt`), so the music, lights and dancing share one
 * clock. A bar is 4 beats = 16 steps (16th notes). Every song is in A minor (the creatures' pentatonic chirps share
 * its notes) at the party tempo. The party plays one song (`PARTY_SONG`); the others are kept for a future track
 * picker.
 *
 * 1. "Tide Pool Groove" — a steady 4-bar loop (Am – F – C – G): an intro bar, then everything; a sweep every 8 bars.
 * 2. "Deep End" — an arrangement with builds and drops: intro → build → DROP → breakdown → build → DROP 2 → (loops
 *    back to the first build). Heavier: a big sub and a wobble bass.
 * 3. "Deep End (Extended)" — a copy of "Deep End" with every section doubled (drops of 16 bars, ~30 s each), and
 *    the second half of each drop evolving. **The party song.**
 *
 * `notesBetween` is a pure function — the player (musicPlayer.ts) asks it what to play next; tests check the songs.
 */
import { PARTY_SONG_MAP, songBar } from '../simulation/party'

export type Instrument =
  | 'kick'
  | 'clap'
  | 'snare'
  | 'hat'
  | 'shaker'
  | 'rim'
  | 'bass'
  | 'sub'
  | 'wobble'
  | 'stab'
  | 'pad'
  | 'sweep'
  | 'riser'
  | 'impact'

export interface MusicNote {
  instrument: Instrument
  /** When (in beats from the start of the song), swing included. */
  beat: number
  /** How long (beats). */
  length: number
  /** 0..1 loudness. */
  velocity: number
  /** MIDI note numbers (bass lines: one note; stabs and pads: a chord; drums: none). */
  pitches: readonly number[]
}

export interface Song {
  name: string
  /** The notes of bar `bar` (0 = the song's first bar); beats relative to the start of that bar. */
  bar(bar: number): MusicNote[]
}

export const SONG = {
  /** How late the offbeat 16ths land (0.5 = straight, ~0.58 = a gentle house shuffle). */
  swing: 0.58,
  /** "Tide Pool Groove": a filter sweep fills the last bar of every section this many bars long. */
  sectionBars: 8,
} as const

/** A minor's notes (pitch classes: A B C D E F G). Every pitched note is one of these. */
export const A_MINOR: readonly number[] = [9, 11, 0, 2, 4, 5, 7]

/** Where a 16th step lands in its bar (beats), with swing on the offbeat 16ths. */
export function stepBeat(step: number): number {
  const swingDelay = step % 2 === 1 ? (SONG.swing - 0.5) * 0.5 : 0
  return step * 0.25 + swingDelay
}

/** Collects a bar's notes (beats relative to the bar). */
function barBuilder() {
  const notes: MusicNote[] = []
  const add = (
    instrument: Instrument,
    step: number,
    length: number,
    velocity: number,
    pitches: readonly number[] = [],
  ) => notes.push({ instrument, beat: stepBeat(step), length, velocity, pitches })
  return { notes, add }
}

// ---------------------------------------------------------------------------------------------------------------
// 1. "Tide Pool Groove"
// ---------------------------------------------------------------------------------------------------------------

/** The chord of each bar in the 4-bar loop: the bass root (MIDI) and the stab chord (MIDI). */
const GROOVE_CHORDS: readonly { root: number; stab: readonly number[] }[] = [
  { root: 33, stab: [57, 60, 64] }, // Am: A1 · A3 C4 E4
  { root: 29, stab: [57, 60, 65] }, // F:  F1 · A3 C4 F4
  { root: 36, stab: [55, 60, 64] }, // C:  C2 · G3 C4 E4
  { root: 31, stab: [55, 59, 62] }, // G:  G1 · G3 B3 D4
]

/** The rolling bassline (per bar): step, interval above the root (root / fifth / octave), length (beats). */
const GROOVE_BASS: readonly { step: number; interval: number; length: number }[] = [
  { step: 2, interval: 0, length: 0.4 },
  { step: 3, interval: 0, length: 0.2 },
  { step: 6, interval: 12, length: 0.2 },
  { step: 7, interval: 0, length: 0.4 },
  { step: 10, interval: 0, length: 0.4 },
  { step: 11, interval: 7, length: 0.2 },
  { step: 14, interval: 12, length: 0.2 },
  { step: 15, interval: 7, length: 0.2 },
]

const tidePoolGroove: Song = {
  name: 'Tide Pool Groove',
  bar(bar) {
    const { notes, add } = barBuilder()
    const intro = bar === 0
    const sweepBar = bar % SONG.sectionBars === SONG.sectionBars - 1
    const chord = GROOVE_CHORDS[bar % GROOVE_CHORDS.length]!

    for (const step of [0, 4, 8, 12]) add('kick', step, 0.5, 1)
    for (const step of [2, 6, 10, 14]) add('hat', step, 0.4, 0.8)
    for (let step = 0; step < 16; step++) add('shaker', step, 0.1, step % 2 === 1 ? 0.7 : 0.35)
    if (intro) return notes // just kick + hats: then everything drops in

    for (const step of [4, 12]) add('clap', step, 0.3, 0.9)
    if (bar % 2 === 1) add('rim', 7, 0.1, 0.6)
    if (bar % 4 === 3) add('rim', 13, 0.1, 0.5)
    for (const b of GROOVE_BASS) add('bass', b.step, b.length, 0.9, [chord.root + b.interval])
    // In a sweep bar the stabs drop out, leaving room for the rise.
    if (!sweepBar) for (const step of [3, 6, 11]) add('stab', step, 0.25, 0.7, chord.stab)
    if (sweepBar) add('sweep', 0, 4, 0.8)
    return notes
  },
}

// ---------------------------------------------------------------------------------------------------------------
// 2. "Deep End" — builds and drops
// ---------------------------------------------------------------------------------------------------------------

/** Its sections (bars): where each starts. The song is 32 bars, then loops back to the first build. */
export const DEEP_END = {
  intro: 0,
  build: 4,
  drop: 8,
  breakdown: 16,
  build2: 20,
  drop2: 24,
  length: 32,
  loopFrom: 4,
} as const

const DEEP_CHORDS: readonly { root: number; pad: readonly number[] }[] = [
  { root: 33, pad: [57, 60, 64] }, // Am
  { root: 33, pad: [57, 60, 64] }, // Am
  { root: 29, pad: [57, 60, 65] }, // F
  { root: 31, pad: [55, 59, 62] }, // G
]

/** Drop 1's wobble bassline (per bar): step, interval (root / fifth / octave), length (beats). */
const WOBBLE_A: readonly { step: number; interval: number; length: number }[] = [
  { step: 2, interval: 0, length: 0.45 },
  { step: 4, interval: 0, length: 0.2 },
  { step: 6, interval: 12, length: 0.45 },
  { step: 10, interval: 0, length: 0.45 },
  { step: 12, interval: 7, length: 0.2 },
  { step: 14, interval: 12, length: 0.45 },
]

/** Drop 2's: more syncopated, more jumps. */
const WOBBLE_B: readonly { step: number; interval: number; length: number }[] = [
  { step: 2, interval: 0, length: 0.3 },
  { step: 5, interval: 12, length: 0.3 },
  { step: 7, interval: 7, length: 0.3 },
  { step: 10, interval: 0, length: 0.3 },
  { step: 13, interval: 12, length: 0.3 },
  { step: 15, interval: 7, length: 0.2 },
]

/** Where in the song bar `bar` is (after bar 31 it loops back to the first build). */
export function deepEndBar(bar: number): number {
  const { length, loopFrom } = DEEP_END
  return bar < length ? bar : loopFrom + ((bar - loopFrom) % (length - loopFrom))
}

const deepEnd: Song = {
  name: 'Deep End',
  bar(n) {
    const bar = deepEndBar(n)
    const { notes, add } = barBuilder()
    const chord = DEEP_CHORDS[bar % DEEP_CHORDS.length]!
    const root = chord.root
    const fourOnTheFloor = (v: number) => {
      for (const step of [0, 4, 8, 12]) add('kick', step, 0.5, v)
    }

    if (bar < DEEP_END.build) {
      // Intro: kick, shaker, a deep sub pulse; the growl sneaks in for the second half.
      fourOnTheFloor(0.9)
      for (let step = 0; step < 16; step++) add('shaker', step, 0.1, step % 2 === 1 ? 0.55 : 0.25)
      add('sub', 0, 3.5, 0.7, [root])
      if (bar >= 2) {
        for (const step of [2, 6, 10, 14]) add('hat', step, 0.4, 0.6)
        for (const step of [2, 6, 10, 14]) add('bass', step, 0.35, 0.5, [root])
      }
      return notes
    }

    const k = bar - (bar >= DEEP_END.build2 ? DEEP_END.build2 : DEEP_END.build) // 0..3 within a build
    if (
      (bar >= DEEP_END.build && bar < DEEP_END.drop) ||
      (bar >= DEEP_END.build2 && bar < DEEP_END.drop2)
    ) {
      // Build: a snare roll that speeds up, a riser and a sweep; the kick and bass thin out; one beat of silence.
      if (k === 0) {
        add('riser', 0, 16, 0.9)
        add('sweep', 0, 16, 0.8)
      }
      if (k < 3) fourOnTheFloor(0.9)
      if (k < 2) for (const step of [2, 6, 10, 14]) add('bass', step, 0.3, 0.6, [root])
      const lastStep = k === 3 ? 12 : 16 // the last beat before the drop: silence
      for (let step = 0; step < lastStep; step++) add('shaker', step, 0.1, 0.25 + 0.1 * k)
      const every = [4, 2, 1, 1][k]!
      for (let step = 0; step < lastStep; step += every) {
        const v = 0.35 + 0.6 * ((k * 16 + step) / 64)
        add('snare', step, 0.1, v)
        if (k === 3) notes.push({ ...notes[notes.length - 1]!, beat: stepBeat(step) + 0.125 }) // 32nds
      }
      return notes
    }

    if (bar >= DEEP_END.breakdown && bar < DEEP_END.build2) {
      // Breakdown: no drums — long pads and a swelling sub.
      add('pad', 0, 4, 0.7, chord.pad)
      add('sub', 0, 4, 0.55, [root])
      for (const step of [2, 6, 10, 14]) add('shaker', step, 0.1, 0.3)
      return notes
    }

    // A drop: an impact on its first beat, then heavy kick, clap, hats, a big sub and a wobble bass.
    const second = bar >= DEEP_END.drop2
    if (bar === DEEP_END.drop || bar === DEEP_END.drop2) add('impact', 0, 4, 1)
    fourOnTheFloor(1)
    for (const step of [4, 12]) add('clap', step, 0.3, 1)
    for (const step of [2, 6, 10, 14]) add('hat', step, 0.4, 0.85)
    for (let step = 0; step < 16; step++) add('shaker', step, 0.1, step % 2 === 1 ? 0.6 : 0.3)
    for (const step of second ? [0, 6, 8, 14] : [0, 8]) add('sub', step, 1.4, 1, [root])
    for (const b of second ? WOBBLE_B : WOBBLE_A) {
      add('wobble', b.step, b.length, 0.95, [root + b.interval])
    }
    if (second) {
      add('rim', 7, 0.1, 0.6)
      add('rim', 13, 0.1, 0.5)
      add('snare', 15, 0.1, 0.3) // a ghost note
      for (const step of [3, 11]) add('stab', step, 0.25, 0.6, chord.pad)
    }
    return notes
  },
}

// ---------------------------------------------------------------------------------------------------------------
// 3. "Deep End (Extended)" — a copy of "Deep End", every section doubled; the drops evolve halfway through
// ---------------------------------------------------------------------------------------------------------------

/** Its sections (bars) — the party song's map, shared with the lights and dancing (simulation/party.ts). */
export const DEEP_END_EXTENDED = PARTY_SONG_MAP

/** Where in the extended song bar `bar` is (after bar 63 it loops back to the first build). */
export const deepEndExtendedBar = songBar

const deepEndExtended: Song = {
  name: 'Deep End (Extended)',
  bar(n) {
    const S = DEEP_END_EXTENDED
    const bar = deepEndExtendedBar(n)
    const { notes, add } = barBuilder()
    const chord = DEEP_CHORDS[bar % DEEP_CHORDS.length]!
    const root = chord.root
    const fourOnTheFloor = (v: number) => {
      for (const step of [0, 4, 8, 12]) add('kick', step, 0.5, v)
    }

    if (bar < S.build) {
      // Intro (8 bars): kick, shaker, a deep sub pulse; hats and the growl join for the second half.
      fourOnTheFloor(0.9)
      for (let step = 0; step < 16; step++) add('shaker', step, 0.1, step % 2 === 1 ? 0.55 : 0.25)
      add('sub', 0, 3.5, 0.7, [root])
      if (bar >= 4) {
        for (const step of [2, 6, 10, 14]) add('hat', step, 0.4, 0.6)
        for (const step of [2, 6, 10, 14]) add('bass', step, 0.35, 0.5, [root])
      }
      return notes
    }

    const k = bar - (bar >= S.build2 ? S.build2 : S.build) // 0..7 within a build
    if ((bar >= S.build && bar < S.drop) || (bar >= S.build2 && bar < S.drop2)) {
      // Build (8 bars): the roll speeds up every 2 bars (quarters → 8ths → 16ths → 32nds), a long riser and sweep;
      // the bass thins out halfway, the kick drops out for the last bar; one beat of silence before the drop.
      const stage = Math.floor(k / 2) // 0..3
      if (k === 0) {
        add('riser', 0, 32, 0.9)
        add('sweep', 0, 32, 0.8)
      }
      if (k < 7) fourOnTheFloor(0.9)
      if (k < 4) for (const step of [2, 6, 10, 14]) add('bass', step, 0.3, 0.6, [root])
      const lastStep = k === 7 ? 12 : 16
      for (let step = 0; step < lastStep; step++) add('shaker', step, 0.1, 0.25 + 0.05 * k)
      const every = [4, 2, 1, 1][stage]!
      for (let step = 0; step < lastStep; step += every) {
        const v = 0.35 + 0.6 * ((k * 16 + step) / 128)
        add('snare', step, 0.1, v)
        if (stage === 3) notes.push({ ...notes[notes.length - 1]!, beat: stepBeat(step) + 0.125 }) // 32nds
      }
      return notes
    }

    if (bar >= S.breakdown && bar < S.build2) {
      // Breakdown (8 bars): no drums — long pads and a swelling sub; a soft shaker creeps back in the second half.
      add('pad', 0, 4, 0.7, chord.pad)
      add('sub', 0, 4, 0.55, [root])
      const late = bar - S.breakdown >= 4
      for (let step = 0; step < 16; step += late ? 1 : 4)
        add('shaker', step + (late ? 0 : 2), 0.1, 0.3)
      return notes
    }

    // A drop (16 bars): an impact on its first beat (and a smaller one halfway), then heavy kick, clap, hats, a big
    // sub and a wobble bass. The second half of each drop evolves.
    const second = bar >= S.drop2
    const at = bar - (second ? S.drop2 : S.drop) // 0..15
    const late = at >= 8
    if (at === 0) add('impact', 0, 4, 1)
    if (at === 8) add('impact', 0, 4, 0.6)
    fourOnTheFloor(1)
    for (const step of [4, 12]) add('clap', step, 0.3, 1)
    for (const step of [2, 6, 10, 14]) add('hat', step, 0.4, 0.85)
    for (let step = 0; step < 16; step++) add('shaker', step, 0.1, step % 2 === 1 ? 0.6 : 0.3)
    for (const step of second ? [0, 6, 8, 14] : [0, 8]) add('sub', step, 1.4, 1, [root])
    for (const b of second ? WOBBLE_B : WOBBLE_A) {
      add('wobble', b.step, b.length, 0.95, [root + b.interval])
    }
    if (second) {
      add('rim', 7, 0.1, 0.6)
      add('rim', 13, 0.1, 0.5)
      add('snare', 15, 0.1, 0.3) // a ghost note
      for (const step of [3, 11]) add('stab', step, 0.25, 0.6, chord.pad)
      if (late) {
        // Opens up: extra rims and ghost snares, hats on every offbeat 16th.
        add('rim', 3, 0.1, 0.45)
        add('snare', 9, 0.1, 0.25)
        for (const step of [1, 5, 9, 13]) add('hat', step, 0.2, 0.4)
      }
    } else if (late) {
      // Drop 1's second half: chord stabs and a rim join.
      for (const step of [3, 11]) add('stab', step, 0.25, 0.55, chord.pad)
      add('rim', 7, 0.1, 0.5)
    }
    return notes
  },
}

/** All the songs (kept for a future track picker). */
export const SONGS: readonly Song[] = [tidePoolGroove, deepEnd, deepEndExtended]

/** The song the party plays. */
export const PARTY_SONG: Song = deepEndExtended

/** Every note of bar `bar` of `song`, in beats from the start of the song. */
export function barNotes(bar: number, song: Song = SONGS[0]!): MusicNote[] {
  return song.bar(bar).map((n) => ({ ...n, beat: bar * 4 + n.beat }))
}

/** Every note of `song` starting in [fromBeat, toBeat), in time order. */
export function notesBetween(
  fromBeat: number,
  toBeat: number,
  song: Song = SONGS[0]!,
): MusicNote[] {
  if (toBeat <= fromBeat) return []
  const notes: MusicNote[] = []
  for (let bar = Math.max(0, Math.floor(fromBeat / 4)); bar * 4 < toBeat; bar++) {
    for (const n of barNotes(bar, song)) if (n.beat >= fromBeat && n.beat < toBeat) notes.push(n)
  }
  return notes.sort((a, b) => a.beat - b.beat)
}

/** Frequency (Hz) of a MIDI note (69 = A4 = 440 Hz). */
export function midiHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

/** Seconds until the next half-beat — so a chirp during the party lands in time with the music. */
export function chirpDelay(beats: number, bpm: number): number {
  const next = Math.ceil(beats * 2 - 1e-9) / 2
  return ((next - beats) * 60) / bpm
}
