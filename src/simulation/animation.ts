import { next, range, type Rng } from './rng'

const TAU = Math.PI * 2

/**
 * Idle-animation state for one creature, as plain data.
 * Lives in the simulation (not the renderer) because later behavior changes it —
 * e.g. a startled creature breathes faster, a sleepy one closes its eyes.
 */
export interface CreatureAnimation {
  /** Breathing oscillator: phase in radians [0, 2π), rate in radians per second. */
  breathPhase: number
  breathRate: number
  /** The creature's calm breathing rate; mood scales `breathRate` from this (expression.ts). */
  breathBase: number
  /** Tentacle-sway oscillator. */
  swayPhase: number
  swayRate: number
  swayBase: number
  /** Seconds until the next blink starts (counts down while the eyes are open). */
  blinkTimer: number
  /** Seconds into the current blink, or -1 when not blinking. */
  blinkElapsed: number
  /** Extra blinks queued right after this one (1 = a double blink). */
  blinksQueued: number
  /** 0 = closed, 1 = fully open. */
  eyeOpenness: number
}

export const ANIMATION = {
  /** Breaths per second (Hz). */
  breathHz: [0.2, 0.35],
  /** Sway cycles per second (Hz). */
  swayHz: [0.3, 0.5],
  /** Seconds between blinks. */
  blinkWait: [2, 6],
  /** First blink comes a bit sooner, so every creature blinks early on. */
  firstBlinkWait: [0.5, 6],
  /** Seconds for one close-and-open. */
  blinkDuration: 0.16,
  /** Pause between the two blinks of a double blink. */
  doubleBlinkGap: 0.12,
  doubleBlinkChance: 0.15,
} as const

export function createAnimation(rng: Rng): CreatureAnimation {
  const breathPhase = range(rng, 0, TAU)
  const breathRate = range(rng, ANIMATION.breathHz[0], ANIMATION.breathHz[1]) * TAU
  const swayPhase = range(rng, 0, TAU)
  const swayRate = range(rng, ANIMATION.swayHz[0], ANIMATION.swayHz[1]) * TAU
  return {
    breathPhase,
    breathRate,
    breathBase: breathRate,
    swayPhase,
    swayRate,
    swayBase: swayRate,
    blinkTimer: range(rng, ANIMATION.firstBlinkWait[0], ANIMATION.firstBlinkWait[1]),
    blinkElapsed: -1,
    blinksQueued: 0,
    eyeOpenness: 1,
  }
}

/** Advance one fixed step. Mutates `anim` in place; randomness only from the seeded rng. */
export function stepAnimation(anim: CreatureAnimation, dt: number, rng: Rng): void {
  // Phase accumulation: smooth even if a rate changes later (sin(time * rate) would jump).
  // Wrapping keeps the numbers small, so floating-point precision never degrades over long sessions.
  anim.breathPhase = (anim.breathPhase + anim.breathRate * dt) % TAU
  anim.swayPhase = (anim.swayPhase + anim.swayRate * dt) % TAU

  stepBlink(anim, dt, rng)
}

/** Blink state machine: waiting → blinking → (queued double blink | new random wait). */
function stepBlink(anim: CreatureAnimation, dt: number, rng: Rng): void {
  if (anim.blinkElapsed < 0) {
    anim.blinkTimer -= dt
    if (anim.blinkTimer <= 0) anim.blinkElapsed = 0
    else return
  } else {
    anim.blinkElapsed += dt
  }

  const t = anim.blinkElapsed / ANIMATION.blinkDuration
  if (t < 1) {
    // Smooth close-then-open: fully closed at the midpoint.
    anim.eyeOpenness = 1 - Math.sin(Math.PI * t)
    return
  }

  // Blink finished.
  anim.eyeOpenness = 1
  anim.blinkElapsed = -1
  if (anim.blinksQueued > 0) {
    anim.blinksQueued--
    anim.blinkTimer = ANIMATION.doubleBlinkGap
  } else {
    anim.blinkTimer = range(rng, ANIMATION.blinkWait[0], ANIMATION.blinkWait[1])
    anim.blinksQueued = next(rng) < ANIMATION.doubleBlinkChance ? 1 : 0
  }
}
