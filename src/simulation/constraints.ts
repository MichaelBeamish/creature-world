/**
 * Hard constraints, applied after movement (position-based correction, as in physics engines).
 *
 * Steering makes motion natural but can't *guarantee* rules; this pass does:
 *  1. overlapping footprints are pushed apart (each moves half the overlap along the line between them),
 *  2. every footprint is clamped inside the world bounds (last, so bounds always hold).
 * A few iterations settle chains of contacts. If the world is too crowded to fit everyone,
 * overlap is minimized rather than eliminated.
 */
import { footprint, type Creature } from './creature'
import type { World } from './world'

/** Tiny extra push so resolved pairs end up strictly apart despite floating-point rounding. */
const SLOP = 1e-6

export function resolveConstraints(world: World, iterations = 3): void {
  const { creatures } = world
  for (let pass = 0; pass < iterations; pass++) {
    for (let i = 0; i < creatures.length; i++) {
      for (let j = i + 1; j < creatures.length; j++) {
        separatePair(creatures[i]!, creatures[j]!)
      }
    }
    for (const c of creatures) keepInBounds(c, world.width, world.height)
  }
}

function separatePair(a: Creature, b: Creature): void {
  const fa = footprint(a.position, a.size)
  const fb = footprint(b.position, b.size)
  let dx = fb.x - fa.x
  let dy = fb.y - fa.y
  let dist = Math.hypot(dx, dy)
  const minDist = fa.radius + fb.radius
  if (dist >= minDist) return
  if (dist === 0) {
    dx = 1 // coincident: separate horizontally, deterministic
    dy = 0
    dist = 1
  }
  const half = (minDist - Math.min(dist, minDist) + SLOP) / 2
  const nx = dx / dist
  const ny = dy / dist
  a.position.x -= nx * half
  a.position.y -= ny * half
  b.position.x += nx * half
  b.position.y += ny * half
}

/** Clamp the footprint inside the bounds (or center it if it can't fit) and cancel velocity into walls. */
function keepInBounds(c: Creature, width: number, height: number): void {
  const f = footprint(c.position, c.size)
  const offsetY = f.y - c.position.y

  let fx = f.x
  if (f.radius * 2 > width) fx = width / 2
  else if (fx - f.radius < 0) fx = f.radius
  else if (fx + f.radius > width) fx = width - f.radius

  let fy = f.y
  if (f.radius * 2 > height) fy = height / 2
  else if (fy - f.radius < 0) fy = f.radius
  else if (fy + f.radius > height) fy = height - f.radius

  // Moving into a wall we were just pushed off? Drop that velocity component (no sticking/jitter).
  if (fx > f.x && c.velocity.x < 0) c.velocity.x = 0
  if (fx < f.x && c.velocity.x > 0) c.velocity.x = 0
  if (fy > f.y && c.velocity.y < 0) c.velocity.y = 0
  if (fy < f.y && c.velocity.y > 0) c.velocity.y = 0

  c.position.x = fx
  c.position.y = fy - offsetY
}
