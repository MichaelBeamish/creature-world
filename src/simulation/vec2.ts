/** 2D vector as plain data. Helpers mutate `out` in place to avoid per-frame allocations. */
export interface Vec2 {
  x: number
  y: number
}

export function vec2(x = 0, y = 0): Vec2 {
  return { x, y }
}

/** out = source */
export function copyVec2(out: Vec2, source: Vec2): Vec2 {
  out.x = source.x
  out.y = source.y
  return out
}

/** out += v * scale */
export function addScaled(out: Vec2, v: Vec2, scale: number): Vec2 {
  out.x += v.x * scale
  out.y += v.y * scale
  return out
}

/** out = (x, y) */
export function setVec2(out: Vec2, x: number, y: number): Vec2 {
  out.x = x
  out.y = y
  return out
}

export function lengthOf(v: Vec2): number {
  return Math.hypot(v.x, v.y)
}

/** Scale `out` down (in place) so its length is at most `max`. */
export function limitLength(out: Vec2, max: number): Vec2 {
  const len = Math.hypot(out.x, out.y)
  if (len > max && len > 0) {
    out.x *= max / len
    out.y *= max / len
  }
  return out
}
