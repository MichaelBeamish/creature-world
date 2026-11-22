/**
 * A tiny Web Audio synthesizer that plays `ChirpSpec`s and `PuffSpec`s.
 *
 * Signal chain per note: oscillator (+ optional vibrato LFO) → low-pass filter → gain envelope
 * → stereo panner → master volume → speakers. No audio files: every chirp is generated live.
 * Puffs (the ink "pfft"): a white-noise buffer (generated once) → band-pass sweeping down → envelope → panner.
 *
 * Autoplay policy: browsers only allow sound after a user gesture, so the AudioContext is created
 * lazily — on the first unmute click — and not a moment earlier.
 */
import type { ChirpSpec, PuffSpec } from './voice'

export interface Synth {
  /** Must be called from a user gesture (click/tap/key) the first time it unmutes. */
  setMuted(muted: boolean): void
  play(spec: ChirpSpec, pan: number): void
  /** A noise burst (the ink "pfft"). */
  puff(spec: PuffSpec, pan: number): void
  close(): void
}

const MASTER_VOLUME = 0.15
/** Politeness: never more than this many chirps sounding at once. */
const MAX_VOICES = 4
const ATTACK = 0.012 // s — fast, but not a click
const FADE = 0.03 // s — mute fade

export function createSynth(): Synth {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let muted = true
  let voices = 0
  /** One second of white noise, made once and replayed (sliced) by every puff. */
  let noise: AudioBuffer | null = null

  function ensureStarted(): void {
    if (ctx) return
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = 0
    master.connect(ctx.destination)
  }

  return {
    setMuted(next) {
      muted = next
      if (!muted) ensureStarted()
      if (!ctx || !master) return
      if (!muted) void ctx.resume()
      // Smooth fade instead of an abrupt cut (avoids clicks).
      master.gain.setTargetAtTime(muted ? 0 : MASTER_VOLUME, ctx.currentTime, FADE)
    },

    play(spec, pan) {
      if (muted || !ctx || !master || voices >= MAX_VOICES) return
      const now = ctx.currentTime
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = spec.filterHz
      const panner = ctx.createStereoPanner()
      panner.pan.value = pan
      filter.connect(panner).connect(master)

      voices++
      let remaining = spec.notes.length
      for (const note of spec.notes) {
        const t0 = now + note.offset
        const t1 = t0 + note.duration

        const osc = ctx.createOscillator()
        osc.type = spec.wave
        osc.frequency.setValueAtTime(note.startHz, t0)
        osc.frequency.exponentialRampToValueAtTime(note.endHz, t1)

        if (spec.vibratoDepth > 0) {
          const lfo = ctx.createOscillator()
          const depth = ctx.createGain()
          lfo.frequency.value = spec.vibratoHz
          depth.gain.value = note.startHz * spec.vibratoDepth
          lfo.connect(depth).connect(osc.frequency)
          lfo.start(t0)
          lfo.stop(t1)
        }

        // Envelope: quick linear attack, smooth exponential decay to (near) silence.
        const env = ctx.createGain()
        env.gain.setValueAtTime(0, t0)
        env.gain.linearRampToValueAtTime(spec.volume, t0 + ATTACK)
        env.gain.exponentialRampToValueAtTime(0.0001, t1)

        osc.connect(env).connect(filter)
        osc.start(t0)
        osc.stop(t1 + 0.02)
        osc.onended = () => {
          osc.disconnect()
          env.disconnect()
          if (--remaining === 0) {
            filter.disconnect()
            panner.disconnect()
            voices--
          }
        }
      }
    },

    puff(spec, pan) {
      if (muted || !ctx || !master || voices >= MAX_VOICES) return
      if (!noise) {
        noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
        const data = noise.getChannelData(0)
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
      }
      const now = ctx.currentTime
      const end = now + spec.duration
      const source = ctx.createBufferSource()
      source.buffer = noise
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.Q.value = spec.q
      filter.frequency.setValueAtTime(spec.startHz, now)
      filter.frequency.exponentialRampToValueAtTime(spec.endHz, end)
      const env = ctx.createGain()
      env.gain.setValueAtTime(0, now)
      env.gain.linearRampToValueAtTime(spec.volume, now + ATTACK)
      env.gain.exponentialRampToValueAtTime(0.0001, end)
      const panner = ctx.createStereoPanner()
      panner.pan.value = pan
      source.connect(filter).connect(env).connect(panner).connect(master)

      voices++
      source.start(now)
      source.stop(end + 0.02)
      source.onended = () => {
        source.disconnect()
        filter.disconnect()
        env.disconnect()
        panner.disconnect()
        voices--
      }
    },

    close() {
      void ctx?.close()
      ctx = null
      master = null
    },
  }
}
