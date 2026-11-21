/**
 * What a creature notices about the visitor, as plain data updated every fixed step.
 *
 * Perception is the same for every creature: it measures *what is happening*.
 * How a creature *feels* about it (curious, scared, grumpy) is personality — task #8.
 */
import type { Presence } from './presence'
import type { Vec2 } from './vec2'

/** What the visitor is doing, from this creature's point of view. Priority: sudden > chasing > calm > none. */
export type Stimulus = 'none' | 'calm' | 'sudden' | 'chasing'

export interface Perception {
  /** 0..1 — how much the creature is paying attention to the visitor. */
  attention: number
  /** 0..1 — builds slowly while the visitor is calm and nearby. */
  trust: number
  /** 0..1 — builds while the visitor keeps moving toward this creature. */
  pressure: number
  /** 0..1 — jumps to 1 on a sudden fast movement nearby, then fades. */
  startle: number
  stimulus: Stimulus
  /** Distance to the visitor (px); Infinity when absent. */
  distance: number
}

export const PERCEPTION = {
  /** How far a creature notices the visitor (px from the mantle center). */
  radius: 240,
  /** Attention envelope time constants (s): notice fast, lose interest slowly. */
  attentionAttack: 0.15,
  attentionRelease: 1,
  /** Sudden movement: cursor faster than this (px/s) within radius × range sets startle = 1. */
  suddenSpeed: 900,
  suddenRange: 1.2,
  /** Seconds for startle to fade from 1 to 0. */
  startleFade: 0.6,
  /** Chasing: moving toward the creature (within 45°) faster than this (px/s). */
  chaseSpeed: 60,
  chaseCosine: Math.cos(Math.PI / 4),
  /** Seconds for pressure to build from 0 to 1 / fade from 1 to 0. */
  pressureBuild: 1.5,
  pressureFade: 2,
  /** Calm presence: nearby and slower than this (px/s). */
  calmSpeed: 80,
  /** Seconds for trust to build from 0 to 1 / fade from 1 to 0. */
  trustBuild: 4,
  trustFade: 8,
  /** Thresholds for classifying the current stimulus. */
  startleThreshold: 0.3,
  pressureThreshold: 0.5,
} as const

export function createPerception(): Perception {
  return { attention: 0, trust: 0, pressure: 0, startle: 0, stimulus: 'none', distance: Infinity }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** Advance one fixed step for a creature at `position`. Mutates `perception` in place. */
export function stepPerception(
  perception: Perception,
  position: Vec2,
  presence: Presence,
  dt: number,
): void {
  const P = PERCEPTION
  const dx = position.x - presence.position.x
  const dy = position.y - presence.position.y
  const distance = presence.active ? Math.hypot(dx, dy) : Infinity
  const inRange = distance < P.radius
  const speed = presence.speed
  perception.distance = distance

  // Attention: target from proximity (+ a little for motion); asymmetric attack/release envelope.
  const proximity = inRange ? 1 - distance / P.radius : 0
  const target = inRange ? clamp01(0.5 + 0.5 * proximity + Math.min(0.3, speed / 1000)) : 0
  const tau = target > perception.attention ? P.attentionAttack : P.attentionRelease
  perception.attention += (target - perception.attention) * (1 - Math.exp(-dt / tau))

  // Startle: an impulse on a sudden fast movement nearby, fading linearly.
  perception.startle = Math.max(0, perception.startle - dt / P.startleFade)
  if (presence.active && speed > P.suddenSpeed && distance < P.radius * P.suddenRange) {
    perception.startle = 1
  }

  // Chasing: in range and moving toward the creature.
  let approaching = false
  if (inRange && speed > P.chaseSpeed && distance > 0) {
    const towardX = dx / distance
    const towardY = dy / distance
    const cosine = (presence.velocity.x * towardX + presence.velocity.y * towardY) / speed
    approaching = cosine > P.chaseCosine
  }
  perception.pressure = clamp01(
    perception.pressure + (approaching ? dt / P.pressureBuild : -dt / P.pressureFade),
  )

  // Calm presence: nearby and slow → trust builds slowly.
  const calm = inRange && speed < P.calmSpeed
  perception.trust = clamp01(perception.trust + (calm ? dt / P.trustBuild : -dt / P.trustFade))

  perception.stimulus =
    perception.startle > P.startleThreshold
      ? 'sudden'
      : perception.pressure > P.pressureThreshold
        ? 'chasing'
        : calm
          ? 'calm'
          : 'none'
}
