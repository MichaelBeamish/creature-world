/**
 * Voice design: what a creature's chirp sounds like, as a plain description (no Web Audio here).
 *
 * - Pitch from size (bigger = lower), snapped to a C-major pentatonic scale so overlapping chirps
 *   always harmonize, plus a tiny per-creature detune so no two creatures are identical.
 * - Timbre from personality (waveform, filter, vibrato).
 * - Contour from the emote (? rises, ! blips, 💢 grumbles downward, ♥ coos up two notes) or the
 *   interaction (grab: a surprised "eep!", squeak: a short wobbly struggle squeak, boop: a tiny "bip").
 * Pure and deterministic: same creature + same emote → same sound. `synth.ts` plays these.
 */
import type { EmoteKind } from '../simulation/expression'
import type { InteractionSoundKind } from '../simulation/interaction'
import { CREATURE_LIMITS, type Creature } from '../simulation/creature'
import type { Archetype } from '../simulation/traits'
import { hash2 } from '../render/noise'

export type Waveform = 'sine' | 'triangle' | 'square' | 'sawtooth'

/** Everything a creature can voice: emotes and interaction sounds. */
export type VoiceKind = EmoteKind | InteractionSoundKind

export interface ChirpNote {
  /** Seconds after the chirp starts. */
  offset: number
  duration: number
  /** Pitch glides from start to end over the note. */
  startHz: number
  endHz: number
}

export interface ChirpSpec {
  wave: Waveform
  notes: ChirpNote[]
  /** Pitch wobble: rate (Hz) and depth (fraction of the pitch). */
  vibratoHz: number
  vibratoDepth: number
  /** Low-pass cutoff (Hz) — lower = softer, rounder. */
  filterHz: number
  /** Relative loudness 0..1 (before the master volume). */
  volume: number
}

/** C-major pentatonic: C D E G A (semitones above C). */
const PENTATONIC = [0, 2, 4, 7, 9]
const ROOT_HZ = 261.63 // C4

/** Frequency of the n-th pentatonic step above (or below, if negative) C4. */
export function pentatonicHz(step: number): number {
  const octave = Math.floor(step / PENTATONIC.length)
  const degree = ((step % PENTATONIC.length) + PENTATONIC.length) % PENTATONIC.length
  return ROOT_HZ * 2 ** ((octave * 12 + PENTATONIC[degree]!) / 12)
}

const TIMBRE: Record<
  Archetype,
  {
    wave: Waveform
    register: number
    filterHz: number
    vibratoHz: number
    vibratoDepth: number
    volume: number
  }
> = {
  friendly: {
    wave: 'sine',
    register: 0,
    filterHz: 3200,
    vibratoHz: 0,
    vibratoDepth: 0,
    volume: 0.7,
  },
  peeker: {
    wave: 'triangle',
    register: 1,
    filterHz: 2600,
    vibratoHz: 0,
    vibratoDepth: 0,
    volume: 0.6,
  },
  scaredy: {
    wave: 'sine',
    register: 3,
    filterHz: 3500,
    vibratoHz: 12,
    vibratoDepth: 0.03,
    volume: 0.55,
  },
  grumpy: {
    wave: 'sawtooth',
    register: -4,
    filterHz: 900,
    vibratoHz: 7,
    vibratoDepth: 0.02,
    volume: 0.5,
  },
}

/** Up to ±12 cents of detune, unique per creature (1 cent = 1/100 of a semitone). */
function detune(creature: Creature): number {
  return 2 ** (((hash2(creature.id, 900) - 0.5) * 24) / 1200)
}

/** The creature's base pentatonic step: smaller creatures sit higher. */
export function baseStep(creature: Creature): number {
  const { minSize, maxSize } = CREATURE_LIMITS
  const smallness = 1 - (creature.size - minSize) / (maxSize - minSize) // 0 (big) .. 1 (small)
  return Math.round(smallness * 6) + TIMBRE[creature.archetype].register
}

export function chirpFor(creature: Creature, emote: VoiceKind): ChirpSpec {
  const timbre = TIMBRE[creature.archetype]
  const base = baseStep(creature)
  const tune = detune(creature)
  const hz = (step: number) => pentatonicHz(step) * tune
  // Slight per-creature tempo variation (±10%).
  const tempo = 0.9 + hash2(creature.id, 901) * 0.2

  let notes: ChirpNote[]
  let vibratoHz = timbre.vibratoHz
  let vibratoDepth = timbre.vibratoDepth
  switch (emote) {
    case 'question': // "hm?" — a rising glide
      notes = [{ offset: 0, duration: 0.22 * tempo, startHz: hz(base), endHz: hz(base + 2) }]
      break
    case 'exclaim': // a quick high blip
      notes = [{ offset: 0, duration: 0.09 * tempo, startHz: hz(base + 3), endHz: hz(base + 4) }]
      break
    case 'anger': // a low grumble, falling, with a wobble
      notes = [{ offset: 0, duration: 0.35 * tempo, startHz: hz(base - 1), endHz: hz(base - 3) }]
      vibratoHz = Math.max(vibratoHz, 9)
      vibratoDepth = Math.max(vibratoDepth, 0.04)
      break
    case 'heart': // a soft two-note "coo", going up
      notes = [
        { offset: 0, duration: 0.14 * tempo, startHz: hz(base), endHz: hz(base) },
        { offset: 0.16 * tempo, duration: 0.2 * tempo, startHz: hz(base + 2), endHz: hz(base + 2) },
      ]
      break
    case 'grab': // a surprised "eep!" — a fast upward squeak
      notes = [{ offset: 0, duration: 0.12 * tempo, startHz: hz(base + 2), endHz: hz(base + 5) }]
      break
    case 'squeak': // a short, wobbly struggle squeak
      notes = [{ offset: 0, duration: 0.1 * tempo, startHz: hz(base + 4), endHz: hz(base + 2) }]
      vibratoHz = Math.max(vibratoHz, 14)
      vibratoDepth = Math.max(vibratoDepth, 0.05)
      break
    case 'boop': // a tiny "bip"
      notes = [{ offset: 0, duration: 0.08, startHz: hz(base + 5), endHz: hz(base + 5) }]
      break
  }

  // Peekers chirp twice: a quick, softer echo of each note.
  if (creature.archetype === 'peeker') {
    notes = notes.flatMap((n) => [
      n,
      { ...n, offset: n.offset + n.duration + 0.03, duration: n.duration * 0.7 },
    ])
  }

  return {
    wave: timbre.wave,
    notes,
    vibratoHz,
    vibratoDepth,
    filterHz: timbre.filterHz,
    volume: timbre.volume,
  }
}

/** Stereo position from the creature's horizontal position: -0.7 (left) .. 0.7 (right). */
export function panFor(x: number, width: number): number {
  if (width <= 0) return 0
  return Math.max(-1, Math.min(1, (x / width) * 2 - 1)) * 0.7
}
