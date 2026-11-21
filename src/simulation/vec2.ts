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
