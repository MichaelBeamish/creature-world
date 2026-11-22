/**
 * The treasure chest and the things the visitor brings into the pool ("props", task #28).
 *
 * - **The chest** sits on the sand in the bottom-left corner (fixed px, so it lines up with its accessible button).
 *   Open, its items float in an arc above it ("slots"); the visitor drags one out (see `interaction.ts`).
 * - **Props** are plain data — kind, position, velocity — with simple closed-loop physics: a shrimp sinks with a gentle
 *   side-to-side drift and comes to rest on the sand. Creatures perceive and eat them (see `feeding.ts`).
 * - **Bounded:** at most `PROPS.maxShrimp` shrimp in the water; the chest's shrimp slot greys out at the cap.
 */
import type { Creature } from './creature'
import { floorHeight } from './scenery'
import type { Vec2 } from './vec2'
import type { World } from './world'

export type PropKind = 'shrimp'

export interface Prop {
  id: number
  kind: PropKind
  position: Vec2
  /** Where it was dropped, and when (world time) — the drift is a function of time since then. */
  droppedAt: number
  dropX: number
  /** Sinking, or lying on the sand. */
  resting: boolean
}

export interface Props {
  /** Open or closed, and when it last changed (world time) — the renderer eases the lid and the items from it. */
  chest: { open: boolean; changedAt: number }
  items: Prop[]
  nextId: number
}

/** The chest's items, in slot order (more kinds join in later tasks). */
export const CHEST_ITEMS: readonly PropKind[] = ['shrimp']

export const CHEST = {
  /** The chest box: left edge (px from the window's left), width and height (px). */
  left: 24,
  width: 78,
  height: 54,
  /** The chest's bottom sits this far into the sand band (fraction of the band, from the sand line). */
  sink: 0.55,
  /** Open: slots float this far (px) from the top-center of the chest, on an arc leaning right (away from the
   *  window's left edge); a slot's grab radius (px). */
  slotDistance: 78,
  slotRadius: 24,
} as const

export const PROPS = {
  /** At most this many shrimp in the water at once. */
  maxShrimp: 3,
  /** Sinking speed (px/s), and a gentle side-to-side drift while sinking: amplitude (px) and rate (Hz). */
  sinkSpeed: 38,
  driftAmp: 10,
  driftHz: 0.45,
  /** A resting shrimp lies this far below the sand line (fraction of the sand band). */
  restDepth: 0.12,
} as const

export function createProps(): Props {
  return { chest: { open: false, changedAt: -Infinity }, items: [], nextId: 1 }
}

/** The sand line's y (px): the top of the sand band. */
export function sandTop(world: World): number {
  return world.height - floorHeight(world.height)
}

/** The chest's box in px (top-left corner, width, height). The accessible button is laid over exactly this. */
export function chestBox(world: World): { x: number; y: number; width: number; height: number } {
  const floor = floorHeight(world.height)
  const bottom = Math.min(world.height - 6, sandTop(world) + floor * CHEST.sink)
  return { x: CHEST.left, y: bottom - CHEST.height, width: CHEST.width, height: CHEST.height }
}

/** Where slot `index` floats when the chest is open (px). One item: straight up; more: an arc leaning right. */
export function slotPosition(world: World, index: number, count = CHEST_ITEMS.length): Vec2 {
  const box = chestBox(world)
  const cx = box.x + box.width / 2
  const cy = box.y
  const angle = count <= 1 ? -Math.PI / 2 : (-105 + (85 * index) / (count - 1)) * (Math.PI / 180) // −105° … −20°
  return {
    x: cx + Math.cos(angle) * CHEST.slotDistance,
    y: cy + Math.sin(angle) * CHEST.slotDistance,
  }
}

/** Open ↔ close the chest (the app calls this from the chest's button). */
export function toggleChest(world: World): void {
  world.props.chest.open = !world.props.chest.open
  world.props.chest.changedAt = world.time
}

/** Can the visitor take this kind out right now? (Shrimp: only while fewer than the cap are in the water.) */
export function canTake(world: World, kind: PropKind): boolean {
  if (kind === 'shrimp') return countOf(world, 'shrimp') < PROPS.maxShrimp
  return true
}

export function countOf(world: World, kind: PropKind): number {
  return world.props.items.filter((p) => p.kind === kind).length
}

/** The item whose slot is under (x, y) while the chest is open, or null. */
export function slotAt(world: World, x: number, y: number): PropKind | null {
  if (!world.props.chest.open) return null
  for (let i = 0; i < CHEST_ITEMS.length; i++) {
    const s = slotPosition(world, i)
    if (Math.hypot(x - s.x, y - s.y) <= CHEST.slotRadius) return CHEST_ITEMS[i]!
  }
  return null
}

/** Is (x, y) over the chest itself (or, while open, one of its slots)? Dropping an item there puts it back. */
export function overChest(world: World, x: number, y: number): boolean {
  const b = chestBox(world)
  const pad = 8
  if (x >= b.x - pad && x <= b.x + b.width + pad && y >= b.y - pad && y <= b.y + b.height + pad)
    return true
  return slotAt(world, x, y) !== null
}

/** Drop an item into the pool at (x, y): it sinks from there (or lies on the sand if dropped on the sand). */
export function dropProp(world: World, kind: PropKind, x: number, y: number): Prop {
  const rest = restY(world)
  const prop: Prop = {
    id: world.props.nextId++,
    kind,
    position: { x: Math.max(8, Math.min(world.width - 8, x)), y: Math.min(y, rest) },
    droppedAt: world.time,
    dropX: x,
    resting: y >= rest,
  }
  world.props.items.push(prop)
  return prop
}

/** Remove a prop (e.g. a shrimp that was eaten). */
export function removeProp(world: World, id: number): void {
  world.props.items = world.props.items.filter((p) => p.id !== id)
}

/** Where a sinking prop comes to rest (px): just below the sand line. */
export function restY(world: World): number {
  return sandTop(world) + floorHeight(world.height) * PROPS.restDepth
}

/** Advance one fixed step: shrimp sink with a gentle drift and settle on the sand. */
export function stepProps(world: World, dt: number): void {
  const rest = restY(world)
  for (const p of world.props.items) {
    if (p.resting) {
      p.position.y = rest // follows the sand line on resize
      continue
    }
    const t = world.time - p.droppedAt
    p.position.y = Math.min(rest, p.position.y + PROPS.sinkSpeed * dt)
    // Drift: a slow sway that starts at zero offset (sin), so a drop lands exactly where it was released.
    p.position.x = Math.max(
      8,
      Math.min(
        world.width - 8,
        p.dropX + PROPS.driftAmp * Math.sin(t * PROPS.driftHz * Math.PI * 2),
      ),
    )
    if (p.position.y >= rest) p.resting = true
  }
}

/** The nearest shrimp to a creature (or null). */
export function nearestShrimp(world: World, c: Creature): Prop | null {
  let best: Prop | null = null
  let bestD = Infinity
  for (const p of world.props.items) {
    if (p.kind !== 'shrimp') continue
    const d = Math.hypot(p.position.x - c.position.x, p.position.y - c.position.y)
    if (d < bestD) {
      bestD = d
      best = p
    }
  }
  return best
}
