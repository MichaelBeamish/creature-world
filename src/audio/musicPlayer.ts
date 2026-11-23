/**
 * Plays the party's song (music.ts) with Web Audio (task #32b): synthesized instruments and a look-ahead scheduler.
 *
 * "A tale of two clocks": the game loop runs on animation frames (jittery), Web Audio on its own sample-accurate
 * clock. Each frame we *book* the notes that fall in the next `LOOKAHEAD` seconds at exact audio times, so timing
 * never wobbles with the frame rate. The song is pinned to the party's beat clock: "beat 0" maps to an audio time,
 * re-pinned only if the two clocks drift apart (e.g. after the tab was in the background).
 *
 * Mixing: everything → music gain (follows the party's fade) → the synth's master (so mute works for both).
 * The bass and stabs go through a "duck" gain that dips on every kick — the classic house sidechain pump.
 */
import { beatsAt, PARTY } from '../simulation/party'
import type { World } from '../simulation/world'
import { midiHz, notesBetween, PARTY_SONG, type MusicNote } from './music'

export const MUSIC = {
  /** Music level under the chirps (relative to the synth's master). */
  volume: 0.55,
  /** Book notes this far ahead (s). */
  lookahead: 0.15,
  /** Re-pin the song to the beat clock if they drift apart by more than this (s). */
  maxDrift: 0.05,
  /** The sidechain pump: how low the bass/stabs duck on a kick, and how long they take to come back (s). */
  duck: 0.35,
  duckRelease: 0.2,
} as const

export interface AudioOut {
  ctx: AudioContext
  out: AudioNode
}

export interface MusicPlayer {
  /** Call every frame. `audio` is null until sound has first been turned on. */
  update(world: World, audio: AudioOut | null, muted: boolean): void
  stop(): void
}

export function createMusicPlayer(): MusicPlayer {
  /** The music's master gain (follows the party's fade) → the synth's master. */
  let master: { ctx: AudioContext; gain: GainNode; noise: AudioBuffer } | null = null
  /** The current party's own channel (so a restarted song can fade the old one out fast), and which party it's for. */
  let track: Bus | null = null
  let trackSince = -Infinity
  /** Audio time of beat 0, and how far (beats) notes are booked; null when not playing. */
  let anchor: number | null = null
  let bookedTo = 0

  function ensureMaster(audio: AudioOut) {
    if (master && master.ctx === audio.ctx) return master
    const { ctx } = audio
    const gain = ctx.createGain()
    gain.gain.value = 0
    gain.connect(audio.out)
    master = { ctx, gain, noise: noiseBuffer(ctx) }
    track = null
    return master
  }

  /** A fresh channel for a new party; the old one fades out in a tenth of a second. */
  function newTrack(m: NonNullable<typeof master>): Bus {
    if (track) fadeOut(track, m.ctx)
    const gain = m.ctx.createGain()
    gain.connect(m.gain)
    const duck = m.ctx.createGain()
    duck.connect(gain)
    return { ctx: m.ctx, gain, duck, noise: m.noise }
  }

  return {
    update(world, audio, muted) {
      const party = world.party
      if (!audio || muted) {
        anchor = null
        if (master) master.gain.gain.setTargetAtTime(0, master.ctx.currentTime, 0.05)
        return
      }
      const m = ensureMaster(audio)
      const now = m.ctx.currentTime
      m.gain.gain.setTargetAtTime(MUSIC.volume * party.level, now, 0.1) // fades with the party
      if (!party.on) {
        anchor = null // let what's booked ring out; nothing new
        return
      }
      if (!track || trackSince !== party.since) {
        track = newTrack(m) // a new party: the song from its start
        trackSince = party.since
        anchor = null
      }
      const spb = 60 / PARTY.bpm
      const beat = beatsAt(world)
      const expected = now - beat * spb
      if (anchor === null || Math.abs(anchor - expected) > MUSIC.maxDrift) {
        anchor = expected // (re-)pin: join the song at the current beat
        bookedTo = beat
      }
      const horizon = (now + MUSIC.lookahead - anchor) / spb
      for (const note of notesBetween(Math.max(bookedTo, beat), horizon, PARTY_SONG)) {
        play(track, note, anchor + note.beat * spb, note.length * spb)
      }
      bookedTo = Math.max(bookedTo, horizon)
    },
    stop() {
      if (master) master.gain.disconnect()
      master = null
      track = null
      anchor = null
    },
  }
}

type Bus = { ctx: AudioContext; gain: GainNode; duck: GainNode; noise: AudioBuffer }

function play(bus: Bus, note: MusicNote, t: number, seconds: number): void {
  const v = note.velocity
  switch (note.instrument) {
    case 'kick':
      return kick(bus, t, v)
    case 'clap':
      return noiseHit(bus, t, v * 0.5, 'bandpass', 1400, 0.18, bus.gain)
    case 'hat':
      return noiseHit(bus, t, v * 0.22, 'highpass', 8000, 0.11, bus.gain)
    case 'shaker':
      return noiseHit(bus, t, v * 0.09, 'highpass', 6500, 0.04, bus.gain)
    case 'rim':
      return rim(bus, t, v)
    case 'bass':
      return bass(bus, t, seconds, midiHz(note.pitches[0]!), v)
    case 'stab':
      return stab(bus, t, seconds, note.pitches, v)
    case 'sweep':
      return sweep(bus, t, seconds, v)
    case 'snare':
      return snare(bus, t, v)
    case 'sub':
      return sub(bus, t, seconds, midiHz(note.pitches[0]!), v)
    case 'wobble':
      return wobble(bus, t, seconds, midiHz(note.pitches[0]!), v)
    case 'pad':
      return pad(bus, t, seconds, note.pitches, v)
    case 'riser':
      return riser(bus, t, seconds, v)
    case 'impact':
      return impact(bus, t, v)
  }
}

/** Fade an old party's channel out quickly, then unplug it (its booked notes finish into silence). */
function fadeOut(old: Bus, ctx: AudioContext): void {
  old.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.03)
  setTimeout(() => old.gain.disconnect(), 400)
}

/** A punchy kick: a sine dropping fast in pitch. It also ducks the bass and stabs (the sidechain pump). */
function kick({ ctx, gain, duck }: Bus, t: number, v: number): void {
  const osc = ctx.createOscillator()
  const env = ctx.createGain()
  osc.frequency.setValueAtTime(140, t)
  osc.frequency.exponentialRampToValueAtTime(42, t + 0.13)
  env.gain.setValueAtTime(0, t)
  env.gain.linearRampToValueAtTime(1.1 * v, t + 0.004)
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.38)
  osc.connect(env).connect(gain)
  start(osc, t, t + 0.4, [env])
  duck.gain.setValueAtTime(MUSIC.duck, t)
  duck.gain.linearRampToValueAtTime(1, t + MUSIC.duckRelease)
}

/** The bass: a deep sine sub plus a growl (two detuned saws an octave up through a closing low-pass). */
function bass({ ctx, duck }: Bus, t: number, seconds: number, hz: number, v: number): void {
  const end = t + seconds
  const sub = ctx.createOscillator()
  const subEnv = ctx.createGain()
  sub.frequency.value = hz
  envelope(subEnv, t, end, 0.6 * v, 0.008, 0.04)
  sub.connect(subEnv).connect(duck)
  start(sub, t, end + 0.05, [subEnv])

  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.Q.value = 7
  filter.frequency.setValueAtTime(1100, t)
  filter.frequency.exponentialRampToValueAtTime(240, end)
  const growlEnv = ctx.createGain()
  envelope(growlEnv, t, end, 0.16 * v, 0.006, 0.04)
  filter.connect(growlEnv).connect(duck)
  for (const cents of [-9, 9]) {
    const saw = ctx.createOscillator()
    saw.type = 'sawtooth'
    saw.frequency.value = hz * 2
    saw.detune.value = cents
    saw.connect(filter)
    start(saw, t, end + 0.05, [], cents === 9 ? [filter, growlEnv] : [])
  }
}

/** A short dark chord stab: detuned saws through a low-pass that closes quickly. */
function stab(
  { ctx, duck }: Bus,
  t: number,
  seconds: number,
  pitches: readonly number[],
  v: number,
) {
  const end = t + Math.min(seconds, 0.22)
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.Q.value = 2
  filter.frequency.setValueAtTime(1900, t)
  filter.frequency.exponentialRampToValueAtTime(500, end)
  const env = ctx.createGain()
  envelope(env, t, end, 0.06 * v, 0.004, 0.05)
  filter.connect(env).connect(duck)
  pitches.forEach((midi, i) => {
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = midiHz(midi)
    osc.detune.value = i % 2 === 0 ? -6 : 6
    osc.connect(filter)
    start(osc, t, end + 0.08, [], i === pitches.length - 1 ? [filter, env] : [])
  })
}

/** A snare: a short tone body plus a burst of mid noise. */
function snare(bus: Bus, t: number, v: number): void {
  const { ctx, gain } = bus
  const osc = ctx.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(200, t)
  osc.frequency.exponentialRampToValueAtTime(140, t + 0.08)
  const env = ctx.createGain()
  env.gain.setValueAtTime(0.25 * v, t)
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.09)
  osc.connect(env).connect(gain)
  start(osc, t, t + 0.1, [env])
  noiseHit(bus, t, 0.35 * v, 'bandpass', 1900, 0.13, gain)
}

/** A big, clean sub: a deep sine you feel (ducked by the kick). */
function sub({ ctx, duck }: Bus, t: number, seconds: number, hz: number, v: number): void {
  const end = t + seconds
  const osc = ctx.createOscillator()
  osc.frequency.value = hz
  const env = ctx.createGain()
  envelope(env, t, end, 0.85 * v, 0.01, 0.08)
  osc.connect(env).connect(duck)
  start(osc, t, end + 0.05, [env])
}

/** The wobble bass: saws + a square through a resonant low-pass that an LFO opens and closes twice a beat. */
function wobble({ ctx, duck }: Bus, t: number, seconds: number, hz: number, v: number): void {
  const end = t + seconds
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.Q.value = 9
  filter.frequency.value = 520
  const lfo = ctx.createOscillator()
  lfo.frequency.value = (PARTY.bpm / 60) * 2 // eighth notes
  const depth = ctx.createGain()
  depth.gain.value = 420
  lfo.connect(depth).connect(filter.frequency)
  const env = ctx.createGain()
  envelope(env, t, end, 0.2 * v, 0.006, 0.05)
  filter.connect(env).connect(duck)
  const parts: [OscillatorType, number, number][] = [
    ['sawtooth', 2, -10],
    ['sawtooth', 2, 10],
    ['square', 1, 0],
  ]
  parts.forEach(([type, mult, cents], i) => {
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = hz * mult
    osc.detune.value = cents
    osc.connect(filter)
    start(osc, t, end + 0.05, [], i === parts.length - 1 ? [filter, env, depth] : [])
  })
  start(lfo, t, end + 0.05, [])
}

/** A long, soft chord pad (the breakdown). */
function pad(
  { ctx, gain }: Bus,
  t: number,
  seconds: number,
  pitches: readonly number[],
  v: number,
) {
  const end = t + seconds
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 1100
  const env = ctx.createGain()
  envelope(env, t, end, 0.045 * v, Math.min(0.4, seconds / 3), Math.min(0.6, seconds / 3))
  filter.connect(env).connect(gain)
  pitches.forEach((midi, i) => {
    for (const cents of [-7, 7]) {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = midiHz(midi)
      osc.detune.value = cents
      osc.connect(filter)
      const last = i === pitches.length - 1 && cents === 7
      start(osc, t, end + 0.05, [], last ? [filter, env] : [])
    }
  })
}

/** A riser: a saw sliding up two octaves through an opening filter, getting louder — into the drop. */
function riser({ ctx, gain }: Bus, t: number, seconds: number, v: number): void {
  const end = t + seconds
  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(midiHz(57), t)
  osc.frequency.exponentialRampToValueAtTime(midiHz(81), end)
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(400, t)
  filter.frequency.exponentialRampToValueAtTime(6000, end)
  const env = ctx.createGain()
  env.gain.setValueAtTime(0, t)
  env.gain.linearRampToValueAtTime(0.07 * v, end - 0.05)
  env.gain.linearRampToValueAtTime(0, end)
  osc.connect(filter).connect(env).connect(gain)
  start(osc, t, end, [filter, env])
}

/** The drop's impact: a deep boom falling in pitch plus a long noise crash. */
function impact(bus: Bus, t: number, v: number): void {
  const { ctx, gain } = bus
  const osc = ctx.createOscillator()
  osc.frequency.setValueAtTime(70, t)
  osc.frequency.exponentialRampToValueAtTime(28, t + 1.2)
  const env = ctx.createGain()
  env.gain.setValueAtTime(0.9 * v, t)
  env.gain.exponentialRampToValueAtTime(0.001, t + 1.4)
  osc.connect(env).connect(gain)
  start(osc, t, t + 1.5, [env])
  noiseHit(bus, t, 0.22 * v, 'lowpass', 3500, 1.6, gain)
}

/** A rim shot: a short high click. */
function rim({ ctx, gain }: Bus, t: number, v: number): void {
  const osc = ctx.createOscillator()
  osc.type = 'triangle'
  osc.frequency.value = 1750
  const env = ctx.createGain()
  env.gain.setValueAtTime(0.18 * v, t)
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.035)
  osc.connect(env).connect(gain)
  start(osc, t, t + 0.05, [env])
}

/** A rising filtered-noise sweep into the next section. */
function sweep({ ctx, gain, noise }: Bus, t: number, seconds: number, v: number): void {
  const src = ctx.createBufferSource()
  src.buffer = noise
  src.loop = true
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = 3
  filter.frequency.setValueAtTime(300, t)
  filter.frequency.exponentialRampToValueAtTime(7000, t + seconds)
  const env = ctx.createGain()
  env.gain.setValueAtTime(0, t)
  env.gain.linearRampToValueAtTime(0.12 * v, t + seconds * 0.95)
  env.gain.linearRampToValueAtTime(0, t + seconds)
  src.connect(filter).connect(env).connect(gain)
  start(src, t, t + seconds, [filter, env])
}

/** A noise hit (clap, hats, shaker): filtered noise with a quick decay. */
function noiseHit(
  { ctx, noise }: Bus,
  t: number,
  peak: number,
  type: BiquadFilterType,
  hz: number,
  decay: number,
  out: AudioNode,
): void {
  const src = ctx.createBufferSource()
  src.buffer = noise
  const filter = ctx.createBiquadFilter()
  filter.type = type
  filter.frequency.value = hz
  const env = ctx.createGain()
  env.gain.setValueAtTime(peak, t)
  env.gain.exponentialRampToValueAtTime(0.001, t + decay)
  src.connect(filter).connect(env).connect(out)
  start(src, t, t + decay + 0.02, [filter, env])
}

/** Attack to `peak`, hold, then a short release ending at `end`. */
function envelope(
  g: GainNode,
  t: number,
  end: number,
  peak: number,
  attack: number,
  release: number,
) {
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(peak, t + attack)
  g.gain.setValueAtTime(peak, Math.max(t + attack, end - release))
  g.gain.linearRampToValueAtTime(0, end)
}

/** Start/stop a source and tidy up its nodes once it has finished. */
function start(
  src: AudioScheduledSourceNode,
  t: number,
  stopAt: number,
  nodes: AudioNode[],
  alsoDisconnect: AudioNode[] = [],
): void {
  src.start(t)
  src.stop(stopAt)
  src.onended = () => {
    src.disconnect()
    for (const n of [...nodes, ...alsoDisconnect]) n.disconnect()
  }
}

/** One second of white noise (a tiny deterministic generator — no need for Math.random here). */
function noiseBuffer(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let s = 12345
  for (let i = 0; i < data.length; i++) {
    s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff
    data[i] = (s / 0x7fffffff) * 2 - 1
  }
  return buffer
}
