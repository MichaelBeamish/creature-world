/**
 * Dance moves (task #32d): what a dancing creature's body does at a moment — a pure function of its style, how hard
 * it's dancing (from the simulation, following the song's energy) and the beat clock. `drawCreature` applies it in
 * the creature's local frame, so it combines with everything else (lean, squash, held items).
 *
 * - bounce: hops landing on every beat, squash on landing, a side-to-side lean, tentacles flaring; in the drops a full
 *   spin on the first beat of every 8 bars.
 * - sway: a big side-to-side lean, little hops.
 * - shy: small quick wiggles, tiny hops.
 * - sulk: still, tentacles bunched — and one tentacle tapping on the beat (he can't help it).
 *
 * Reduced motion: no hops, spins or taps — a gentle sway only.
 */
import { CHEER_UP } from '../simulation/cheerUp'
import type { DanceStyle } from '../simulation/dance'

export interface DanceMoves {
  /** Vertical offset (× size, negative = up). */
  bob: number
  /** Extra tilt (radians), including any spin. */
  lean: number
  /** Height scale of the body (< 1 = squashed on landing). */
  squash: number
  /** Tentacle spread multiplier. */
  flare: number
  /** 0..1 — how high the tapping tentacle's tip is lifted (sulk). */
  tap: number
  /** −1..1 — a held glow stick (or whatever it holds) waves to the beat. */
  wave: number
}

const STILL: DanceMoves = { bob: 0, lean: 0, squash: 1, flare: 1, tap: 0, wave: 0 }

const STYLE = {
  bounce: { hop: 0.35, lean: 0.2, squash: 0.14, flare: 0.5 },
  sway: { hop: 0.12, lean: 0.3, squash: 0.06, flare: 0.25 },
  shy: { hop: 0.08, lean: 0.14, squash: 0.05, flare: 0.15 },
} as const

export function danceMoves(
  style: DanceStyle,
  amount: number,
  beats: number,
  full: boolean,
): DanceMoves {
  const f = beats - Math.floor(beats) // 0 on the beat
  if (style === 'sulk') {
    // Bunched up and grumpy — but one tentacle taps along (lifted between beats, down on the beat).
    return { ...STILL, flare: 0.65, tap: full ? Math.pow(Math.sin(Math.PI * f), 2) : 0 }
  }
  if (amount <= 0) return STILL
  const s = STYLE[style]
  // Hop: up between beats, landing on each beat. Lean: one side per beat pair (shy: a quicker wiggle).
  const hop = Math.sin(Math.PI * f)
  const leanWave = style === 'shy' ? Math.sin(Math.PI * 2 * beats) : Math.sin((Math.PI * beats) / 2)
  const land = Math.exp(-f * 8)
  // A full spin on the first beat of every 8 bars, when going all out (the drops).
  const spinning = style === 'bounce' && amount > 0.8 && Math.floor(beats) % 32 === 0
  const spin = spinning ? Math.PI * 2 * (f * f * (3 - 2 * f)) : 0
  if (!full) {
    return {
      ...STILL,
      lean: leanWave * s.lean * 0.4 * amount,
      wave: Math.sin(Math.PI * beats) * 0.4 * amount,
    }
  }
  return {
    bob: -hop * s.hop * amount,
    lean: leanWave * s.lean * amount + spin,
    squash: 1 - s.squash * amount * land,
    flare: 1 + s.flare * amount * hop,
    tap: 0,
    wave: Math.sin(Math.PI * beats) * amount,
  }
}

/**
 * The Grumpy being cheered up by the rose (task #38), `t` seconds in: a slow suspicious tilt while he's sceptical,
 * then a little hop and stretch as he perks up. Reduced motion: still.
 */
export function cheerUpMoves(t: number, full: boolean): DanceMoves {
  if (!full) return STILL
  if (t < CHEER_UP.doubt) {
    // Eyeing it: a slow tilt one way, then the other (and a slight shrink — not sure about this).
    return { ...STILL, lean: Math.sin(t * 1.6) * 0.2, squash: 0.96 }
  }
  const u = t - CHEER_UP.doubt
  if (u < CHEER_UP.perk) {
    const k = Math.sin(Math.PI * (u / CHEER_UP.perk)) // up and back down
    return { ...STILL, bob: -0.45 * k, squash: 1 + 0.18 * k, flare: 1 + 0.4 * k }
  }
  return STILL
}
