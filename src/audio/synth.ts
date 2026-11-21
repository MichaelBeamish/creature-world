/**
 * A tiny Web Audio synthesizer that plays `ChirpSpec`s.
 *
 * Signal chain per note: oscillator (+ optional vibrato LFO) → low-pass filter → gain envelope
 * → stereo panner → master volume → speakers. No audio files: every chirp is generated live.
 *
 * Autoplay policy: browsers only allow sound after a user gesture, so the AudioContext is created
 * lazily — on the first unmute click — and not a moment earlier.
 */
import type { ChirpSpec } from './voice'

export interface Synth {
  /** Must be called from a user gesture (click/tap/key) the first time it unmutes. */
  setMuted(muted: boolean): void
  play(spec: ChirpSpec, pan: number): void
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

    close() {
      void ctx?.close()
      ctx = null
      master = null
    },
  }
}
