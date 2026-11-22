/**
 * Hard constraints, applied after movement (position-based correction, as in physics engines).
 *
 * Steering makes motion natural but can't *guarantee* rules; this pass does:
 *  1. overlapping footprints are pushed apart (each moves half the overlap along the line between them),
 *  2. every footprint is clamped inside the world bounds (last, so bounds always hold).
 * A few iterations settle chains of contacts. If the world is too crowded to fit everyone,
 * overlap is minimized rather than eliminated.
 *
 * A creature held by the visitor follows the hand, but a creature it bumps into can only be shoved so fast
 * (`CONSTRAINTS.shoveSpeed`): whatever the neighbour can't take this step pushes the held creature back instead.
 * So the held one moves as fast as the cursor when the way is clear, and only as fast as the obstacle can get out
 * of the way when it isn't (and not at all into a neighbour pinned against the sand or a wall).
 */
import { footprint, type Creature } from './creature'
import { swimBounds } from './scenery'
import type { World } from './world'

/** Tiny extra push so resolved pairs end up strictly apart despite floating-point rounding. */
const SLOP = 1e-6

export const CONSTRAINTS = {
  /** The fastest a held creature can shove another one out of its way (px/s) — a bit above a fleeing dart. */
  shoveSpeed: 180,
  /** Extra solver passes while something is held, so hand → creature → neighbour → wall chains settle. */
  heldExtraPasses: 5,
} as const

/**
 * @param dt the step length (s): turns `shoveSpeed` into how far a neighbour may be shoved this step.
 */
export function resolveConstraints(world: World, dt = 1 / 60, iterations = 3): void {
  const { creatures } = world
  const bounds = swimBounds(world) // the area above the sand
  const held = world.interaction.hold?.creatureId
  const passes = held === undefined ? iterations : iterations + CONSTRAINTS.heldExtraPasses
  // How far each creature has been shoved by the held one this step (a per-step budget).
  const shoved = new Map<number, number>()
  const budget = CONSTRAINTS.shoveSpeed * dt
  for (let pass = 0; pass < passes; pass++) {
    for (let i = 0; i < creatures.length; i++) {
      for (let j = i + 1; j < creatures.length; j++) {
        const a = creatures[i]!
        const b = creatures[j]!
        if (a.id === held) shovePair(a, b, shoved, budget)
        else if (b.id === held) shovePair(b, a, shoved, budget)
        else separatePair(a, b)
      }
    }
    for (const c of creatures) keepInBounds(c, bounds.width, bounds.height)
  }
}

/**
 * The held creature pushes `other`: the neighbour moves out of the way up to its remaining shove budget;
 * the rest of the overlap pushes the held creature back (and stops it moving further into the neighbour).
 */
function shovePair(
  heldOne: Creature,
  other: Creature,
  shoved: Map<number, number>,
  budget: number,
): void {
  const fh = footprint(heldOne.position, heldOne.size)
  const fo = footprint(other.position, other.size)
  let dx = fo.x - fh.x
  let dy = fo.y - fh.y
  let dist = Math.hypot(dx, dy)
  const minDist = fh.radius + fo.radius
  if (dist >= minDist) return
  if (dist === 0) {
    dx = 1 // coincident: separate horizontally, deterministic
    dy = 0
    dist = 1
  }
  const overlap = minDist - dist + SLOP
  const nx = dx / dist
  const ny = dy / dist
  const used = shoved.get(other.id) ?? 0
  const give = Math.min(overlap, Math.max(0, budget - used))
  shoved.set(other.id, used + give)
  other.position.x += nx * give
  other.position.y += ny * give
  const rest = overlap - give
  if (rest <= 0) return
  heldOne.position.x -= nx * rest
  heldOne.position.y -= ny * rest
  // Blocked: cancel the velocity heading into the neighbour (no build-up, no launch on release).
  const into = heldOne.velocity.x * nx + heldOne.velocity.y * ny
  if (into > 0) {
    heldOne.velocity.x -= nx * into
    heldOne.velocity.y -= ny * into
  }
}

/** Push an overlapping pair apart along the line between them, half each. */
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
