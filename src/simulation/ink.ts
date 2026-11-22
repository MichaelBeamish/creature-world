/**
 * Ink — the cloud a creature squirts when shaken too hard (task #21). A second small particle system, built like
 * the bubbles:
 *
 * - **Fixed pool (ring buffer):** `capacity` puff records allocated once; new puffs overwrite the oldest slot.
 * - **Analytic motion:** a puff stores only its birth and random traits; `inkPuffAt` gives its position, size and
 *   opacity at any time in closed form (it bursts outward, slows, swells, drifts up and fades).
 * - **Independent random stream**, so the creatures' randomness is unchanged.
 */
import type { Creature } from './creature'
import { createRng, int, range, type Rng } from './rng'
import type { World } from './world'

export interface InkPuff {
  active: boolean
  bornAt: number
  x0: number
  y0: number
  /** Unit direction the puff bursts toward, and how far it travels (px). */
  dirX: number
  dirY: number
  spread: number
  /** Radius at birth and when fully swollen (px). */
  radius0: number
  radius1: number
  /** Upward drift (px/s), swirl phase, lifetime (s). */
  rise: number
  phase: number
  life: number
}

export interface InkSystem {
  /** Fixed-size pool; never grows. */
  pool: InkPuff[]
  /** Next slot to (re)use. */
  next: number
  rng: Rng
}

export const INK = {
  capacity: 72,
  /** Puffs in one squirt. */
  burst: [14, 18],
  /** How far puffs burst out (× creature size), and how quickly they slow down (s, time constant). */
  spread: [1.8, 6],
  spreadTime: 0.35,
  /** Puff radius at birth / fully swollen (× creature size). */
  radius0: [0.6, 1],
  radius1: [2.6, 4.2],
  /** Upward drift (px/s) and a gentle side-to-side swirl (px). */
  rise: [4, 12],
  swirl: 6,
  /** Lifetime (s): the cloud thins out and is gone by then. */
  life: [4, 6],
  /** How much of the cloud is aimed back toward the hand (0 = all around, 1 = only toward the hand). */
  aim: 0.55,
  /** Opacity of a fresh puff's core. */
  opacity: 0.9,
  streamSalt: 0x1c0ffee5,
} as const

export function createInk(seed: number): InkSystem {
  const pool: InkPuff[] = Array.from({ length: INK.capacity }, () => ({
    active: false,
    bornAt: 0,
    x0: 0,
    y0: 0,
    dirX: 0,
    dirY: 0,
    spread: 0,
    radius0: 0,
    radius1: 0,
    rise: 0,
    phase: 0,
    life: 0,
  }))
  return { pool, next: 0, rng: createRng(seed ^ INK.streamSalt) }
}

/**
 * Squirt a cloud from the creature. (towardX, towardY) is a unit direction the cloud leans toward — the hand —
 * so the ink ends up between the visitor and the escaping creature, like a smoke screen.
 */
export function spawnInk(
  system: InkSystem,
  creature: Creature,
  time: number,
  towardX: number,
  towardY: number,
  aim: number = INK.aim,
): void {
  const { rng } = system
  const count = int(rng, INK.burst[0], INK.burst[1])
  const towardAngle = Math.atan2(towardY, towardX)
  for (let i = 0; i < count; i++) {
    const p = system.pool[system.next]!
    system.next = (system.next + 1) % system.pool.length
    // A random direction, pulled toward the hand by `aim`.
    const angle = towardAngle + range(rng, -Math.PI, Math.PI) * (1 - aim)
    p.active = true
    p.bornAt = time + i * 0.015 // a fast stagger: one quick squirt
    p.x0 = creature.position.x
    p.y0 = creature.position.y
    p.dirX = Math.cos(angle)
    p.dirY = Math.sin(angle)
    p.spread = range(rng, INK.spread[0], INK.spread[1]) * creature.size
    p.radius0 = range(rng, INK.radius0[0], INK.radius0[1]) * creature.size
    p.radius1 = range(rng, INK.radius1[0], INK.radius1[1]) * creature.size
    p.rise = range(rng, INK.rise[0], INK.rise[1])
    p.phase = range(rng, 0, Math.PI * 2)
    p.life = range(rng, INK.life[0], INK.life[1])
  }
}

/** Retire finished puffs (the slot simply becomes reusable). */
export function stepInk(world: World): void {
  for (const p of world.ink.pool) {
    if (p.active && world.time - p.bornAt >= p.life) p.active = false
  }
}

export interface InkPuffState {
  state: 'waiting' | 'spreading' | 'gone'
  x: number
  y: number
  radius: number
  /** 0..1 — fades as the puff thins out. */
  opacity: number
}

/**
 * Where a puff is at `time`, in closed form. `drift` scales the upward drift and swirl (reduced under reduced motion).
 * It bursts out and slows (1 − e^(−t/τ)), swells, drifts up and fades.
 */
export function inkPuffAt(p: InkPuff, time: number, drift = 1): InkPuffState {
  const age = time - p.bornAt
  if (age < 0) return { state: 'waiting', x: p.x0, y: p.y0, radius: p.radius0, opacity: 0 }
  if (age >= p.life) return { state: 'gone', x: p.x0, y: p.y0, radius: p.radius1, opacity: 0 }
  const out = 1 - Math.exp(-age / INK.spreadTime)
  const swirl = drift * INK.swirl * Math.sin(age * 1.3 + p.phase) * out
  const x = p.x0 + p.dirX * p.spread * out + swirl
  const y = p.y0 + p.dirY * p.spread * out - drift * p.rise * age
  const radius = p.radius0 + (p.radius1 - p.radius0) * out
  const u = age / p.life
  const opacity = INK.opacity * (1 - u) ** 1.5 * Math.min(1, age / 0.06) // a 60 ms fade-in avoids popping
  return { state: 'spreading', x, y, radius, opacity }
}
