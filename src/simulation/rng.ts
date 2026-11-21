/**
 * Seeded pseudo-random number generator (mulberry32).
 *
 * Same seed → same sequence, every time, on every machine. That makes "random" creature
 * behavior reproducible in tests and when chasing bugs. `Math.random()` cannot be seeded,
 * so simulation code must use this instead (enforced by ESLint).
 *
 * The state is plain data so it can live inside the (serializable) world.
 */
export interface Rng {
  /** 32-bit internal state; advances on every draw. */
  state: number
}

/** Create a generator. `seed` is treated as a 32-bit integer. */
export function createRng(seed: number): Rng {
  return { state: seed | 0 }
}

/** Uniform float in [0, 1). */
export function next(rng: Rng): number {
  // mulberry32 — tiny, fast, good statistical quality for games. Math.imul = 32-bit integer multiply.
  let t = (rng.state = (rng.state + 0x6d2b79f5) | 0)
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** Uniform float in [min, max). */
export function range(rng: Rng, min: number, max: number): number {
  return min + next(rng) * (max - min)
}

/** Uniform integer in [min, max] (inclusive). */
export function int(rng: Rng, min: number, max: number): number {
  return min + Math.floor(next(rng) * (max - min + 1))
}

/** Uniformly chosen element of a non-empty array. */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick() needs a non-empty array')
  return items[int(rng, 0, items.length - 1)]!
}
