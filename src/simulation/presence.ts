/**
 * The visitor's presence in the world (their cursor / finger), as plain data.
 *
 * The app copies the latest raw pointer sample in once per fixed step (`setPresenceInput`);
 * everything derived — like velocity — is computed here, per step. So the simulation never
 * touches the DOM, and tests can script a cursor path tick by tick.
 */
import { vec2, type Vec2 } from './vec2'

export interface PresenceInput {
  x: number
  y: number
  active: boolean
}

export interface Presence {
  /** Raw input for the next step, written by the app. */
  input: PresenceInput
  /** Is the visitor present (pointer over the world / recent touch)? */
  active: boolean
  position: Vec2
  /** Smoothed velocity (px/s) — an exponential moving average, so one jittery sample can't fake a flick. */
  velocity: Vec2
  speed: number
}

export const PRESENCE = {
  /** Smoothing time constant for velocity (seconds). Smaller = more responsive, larger = calmer. */
  velocitySmoothing: 0.08,
} as const

export function createPresence(): Presence {
  return {
    input: { x: 0, y: 0, active: false },
    active: false,
    position: vec2(),
    velocity: vec2(),
    speed: 0,
  }
}

/** Store the latest raw pointer sample; it takes effect on the next `updatePresence`. */
export function setPresenceInput(presence: Presence, x: number, y: number, active: boolean): void {
  presence.input.x = x
  presence.input.y = y
  presence.input.active = active
}

/** Advance one fixed step: apply the input and update the smoothed velocity. */
export function updatePresence(presence: Presence, dt: number): void {
  const { input } = presence

  if (!input.active) {
    presence.active = false
    presence.velocity.x = 0
    presence.velocity.y = 0
    presence.speed = 0
    return
  }

  if (!presence.active) {
    // Just arrived: start at rest, so entering the window doesn't register as a huge jump.
    presence.active = true
    presence.position.x = input.x
    presence.position.y = input.y
    presence.velocity.x = 0
    presence.velocity.y = 0
    presence.speed = 0
    return
  }

  const rawVx = (input.x - presence.position.x) / dt
  const rawVy = (input.y - presence.position.y) / dt
  // Exponential moving average; the blend factor is derived from dt, so it's step-size independent.
  const blend = 1 - Math.exp(-dt / PRESENCE.velocitySmoothing)
  presence.velocity.x += (rawVx - presence.velocity.x) * blend
  presence.velocity.y += (rawVy - presence.velocity.y) * blend
  presence.speed = Math.hypot(presence.velocity.x, presence.velocity.y)
  presence.position.x = input.x
  presence.position.y = input.y
}
