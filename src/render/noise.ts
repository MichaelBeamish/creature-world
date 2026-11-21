/**
 * Stateless deterministic hash → [0, 1).
 *
 * Gives stable "random-looking" variation for rendering details (fur strands, tentacle wiggle)
 * without storing anything: the same inputs always produce the same value, so nothing flickers.
 * Integer-mixing hash (murmur3-style finalizer) — fast and well distributed.
 */
export function hash2(a: number, b: number): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x9e3779b9, 0x165667b1)
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}
