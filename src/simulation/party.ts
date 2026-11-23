/**
 * The party (task #32): while the disco ball is out (in the water or in the visitor's hand), the party is on.
 *
 * One beat clock for everything — lights (32a), music (32b), the neon reef (32c) and dancing (32d) all read
 * `beatsAt`, so they stay in sync. `level` fades 0 → 1 as the party starts (the lights dim) and back as it ends.
 *
 * The party song's map (task #32c) lives here too — which bars are intro / build / drop / breakdown — so the music
 * (audio/music.ts), the lights and the dancing all agree on "where we are in the song" (`momentAt`). The simulation
 * never imports audio code; the audio reads this map.
 */
import type { World } from './world'

export const PARTY = {
  /** Tempo (beats per minute) — deep house / tech house. */
  bpm: 126,
  /** Seconds for the party to fade fully in (lights dim) and out (lights come back up). */
  fadeIn: 2.5,
  fadeOut: 2,
} as const

export interface Party {
  on: boolean
  /** World time the party (and its beat clock) started. */
  since: number
  /** 0..1 — how far the party has faded in. */
  level: number
}

export function createParty(): Party {
  return { on: false, since: -Infinity, level: 0 }
}

/** Is the disco ball out — in the water or being carried? */
export function discoBallOut(world: World): boolean {
  return (
    world.interaction.carry?.kind === 'discoBall' ||
    world.props.items.some((p) => p.kind === 'discoBall')
  )
}

/** Beats since the party started (fractional: 3.5 = halfway between the 4th and 5th beat); 0 when off. */
export function beatsAt(world: World): number {
  const party = world.party
  if (!party.on) return 0
  return ((world.time - party.since) * PARTY.bpm) / 60
}

/** The party song's sections (bars): where each starts. 64 bars (~2 min), then it loops back to the first build. */
export const PARTY_SONG_MAP = {
  intro: 0,
  build: 8,
  drop: 16,
  breakdown: 32,
  build2: 40,
  drop2: 48,
  length: 64,
  loopFrom: 8,
} as const

export type PartySection = 'intro' | 'build' | 'drop' | 'breakdown'

/** Where in the song (0..63) bar `bar` of the party is — after the end it loops back to the first build. */
export function songBar(bar: number): number {
  const { length, loopFrom } = PARTY_SONG_MAP
  return bar < length ? bar : loopFrom + ((bar - loopFrom) % (length - loopFrom))
}

/** The section of song bar `bar` (0..63), and how many bars into it. */
export function sectionOf(bar: number): { section: PartySection; start: number; bars: number } {
  const m = PARTY_SONG_MAP
  if (bar < m.build) return { section: 'intro', start: m.intro, bars: m.build - m.intro }
  if (bar < m.drop) return { section: 'build', start: m.build, bars: m.drop - m.build }
  if (bar < m.breakdown) return { section: 'drop', start: m.drop, bars: m.breakdown - m.drop }
  if (bar < m.build2)
    return { section: 'breakdown', start: m.breakdown, bars: m.build2 - m.breakdown }
  if (bar < m.drop2) return { section: 'build', start: m.build2, bars: m.drop2 - m.build2 }
  return { section: 'drop', start: m.drop2, bars: m.length - m.drop2 }
}

export interface PartyMoment {
  section: PartySection
  /** 0..1 — how far through the section. */
  progress: number
  /** 0..1 — how intense the music is right now (each section eases in from the last over a bar: never jumps). */
  energy: number
  /** 0..1 — a swell on each beat that decays before the next one. */
  pulse: number
  /** 0..1 — how much the visuals should pulse with the beat here: the drops yes, the builds no (they rise). */
  pulseAmount: number
  /** Beats since the party started. */
  beats: number
}

/** The intensity of the music at a moment (unsmoothed): low intro, rising builds, full drops, soft breakdown. */
function rawEnergy(beats: number): number {
  if (beats < 0) return 0.3
  const bar = songBar(Math.floor(beats / 4))
  const { section, start, bars } = sectionOf(bar)
  const p = (bar - start + (beats / 4 - Math.floor(beats / 4))) / bars
  switch (section) {
    case 'intro':
      return 0.3 + 0.1 * p
    case 'build':
      return 0.35 + 0.55 * p
    case 'drop':
      return 1
    case 'breakdown':
      return 0.25
  }
}

const PULSE_AMOUNT: Record<PartySection, number> = { intro: 0.3, build: 0, drop: 1, breakdown: 0 }

function pulseAmountAt(beats: number): number {
  return beats < 0
    ? PULSE_AMOUNT.intro
    : PULSE_AMOUNT[sectionOf(songBar(Math.floor(beats / 4))).section]
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Where the party song is at `beats` (pure — tested; the lights and dancing read it). */
export function momentAt(beats: number): PartyMoment {
  const bar = songBar(Math.floor(beats / 4))
  const { section, start, bars } = sectionOf(bar)
  const progress = (bar - start + (beats / 4 - Math.floor(beats / 4))) / bars
  // Each section eases in from where the last one ended — energy over a bar, the beat pulse over a beat.
  const into = beats - (Math.floor(beats / 4) - (bar - start)) * 4 // beats since the section began
  const before = beats - into - 1e-6 // the last moment of the previous section
  const ease = (x: number) => x * x * (3 - 2 * x) // smoothstep
  const energy = mix(rawEnergy(before), rawEnergy(beats), ease(Math.min(1, into / 4)))
  const pulseAmount = mix(pulseAmountAt(before), PULSE_AMOUNT[section], ease(Math.min(1, into)))
  const phase = beats - Math.floor(beats)
  const pulse = Math.exp(-phase * 5)
  return { section, progress, energy, pulse, pulseAmount, beats }
}

/** The party's moment now (calm defaults when the party is off). */
export function partyMoment(world: World): PartyMoment {
  if (!world.party.on) {
    return { section: 'intro', progress: 0, energy: 0, pulse: 0, pulseAmount: 0, beats: 0 }
  }
  return momentAt(beatsAt(world))
}

/** Advance one fixed step: switch on/off with the disco ball, and fade the level. */
export function stepParty(world: World, dt: number): void {
  const party = world.party
  const out = discoBallOut(world)
  if (out && !party.on) party.since = world.time
  party.on = out
  const rate = out ? 1 / PARTY.fadeIn : -1 / PARTY.fadeOut
  party.level = Math.max(0, Math.min(1, party.level + rate * dt))
}
