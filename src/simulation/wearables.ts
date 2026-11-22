/**
 * Dress-up (task #30): creatures wear items from the chest — one per spot (head, eyes, face; the nose glasses take
 * both eyes and face). Dropping an item on a creature puts it on (whatever was in that spot falls off); pressing a
 * worn item takes it off. Fallen items sink and, if left on the sand, return to the chest by themselves (props.ts).
 *
 * Only the Grumpy minds: while wearing anything, every few seconds it does an angry shake (💢) and one item falls off,
 * until it's wearing nothing. (Same dials as `standsItsGround` in interaction.ts: bold + incurious — not imported, so
 * this module stays below interaction.ts, which calls it.)
 */
import type { Creature, Dress } from './creature'
import { showEmote } from './expression'
import {
  dropProp,
  isWearable,
  removeProp,
  WEARABLES,
  type Prop,
  type WearableKind,
  type WearSpot,
} from './props'
import type { IntentKind } from './mindState'
import type { Vec2 } from './vec2'
import type { World } from './world'

export const WEAR = {
  /** The Grumpy: first shake this long (s) after putting something on, then every `shakeEvery` s; each shake lasts
   *  `shakeSeconds` and drops one item. */
  firstShake: 1.5,
  shakeEvery: 2.5,
  shakeSeconds: 0.9,
  /** A worn item can be pressed within this distance (× size) of its spot. */
  grabRadius: 0.6,
} as const

/** Spots in the order the Grumpy shakes them off: hats first. */
const SPOTS: readonly WearSpot[] = ['head', 'eyes', 'face', 'hand', 'cuffs']

/** Where a spot is on a creature, roughly, in world coordinates (for hit-testing and for items falling off). */
export function spotPosition(c: Creature, spot: WearSpot): Vec2 {
  // The hand: the raised tentacle's tip, up and out to the right (matches the renderer's raised arm).
  if (spot === 'hand')
    return { x: c.position.x + c.size * HAND.x, y: c.position.y + c.size * HAND.y }
  const y = spot === 'head' ? -1.15 : spot === 'eyes' ? 0.35 : spot === 'face' ? 0.75 : 2.0
  return { x: c.position.x, y: c.position.y + c.size * y }
}

/** Where the raised tentacle's tip is, relative to the mantle center (× size). */
export const HAND = { x: 1.75, y: 0.05 } as const

/** The spots an item fills. */
export function spotsOf(kind: WearableKind): readonly WearSpot[] {
  const spot = WEARABLES[kind]
  return spot === 'eyesFace' ? ['eyes', 'face'] : [spot]
}

/** Is the creature wearing anything? */
export function isDressed(d: Dress): boolean {
  return (
    d.head !== null || d.eyes !== null || d.face !== null || d.hand !== null || d.cuffs !== null
  )
}

/** Put an item on: whatever fills those spots falls off first. */
export function wearOn(world: World, c: Creature, kind: WearableKind): void {
  for (const spot of spotsOf(kind)) {
    if (c.dress[spot]) dropOff(world, c, spot)
  }
  for (const spot of spotsOf(kind)) c.dress[spot] = kind
  // The Grumpy doesn't like it.
  if (minds(c) && !isFinite(c.dress.shakeAt)) c.dress.shakeAt = world.time + WEAR.firstShake
}

/** Take the item in a spot off (it leaves every spot it filled). Returns what it was. */
export function takeOff(c: Creature, spot: WearSpot): WearableKind | null {
  const kind = c.dress[spot]
  if (!kind) return null
  for (const s of spotsOf(kind)) c.dress[s] = null
  if (!isDressed(c.dress)) c.dress.shakeAt = Infinity
  return kind
}

/** Take an item off and let it fall (it sinks from where it was worn). */
export function dropOff(world: World, c: Creature, spot: WearSpot): void {
  const at = spotPosition(c, spot)
  const kind = takeOff(c, spot)
  if (kind) dropProp(world, kind, at.x, at.y)
}

/** The worn item under (x, y), if any: which creature and which spot (front-most creatures first). */
export function wornAt(
  world: World,
  x: number,
  y: number,
): { creature: Creature; spot: WearSpot } | null {
  const topFirst = [...world.creatures].sort((a, b) => b.position.y - a.position.y)
  for (const c of topFirst) {
    for (const spot of SPOTS) {
      if (!c.dress[spot]) continue
      const at = spotPosition(c, spot)
      if (Math.hypot(x - at.x, y - at.y) <= c.size * WEAR.grabRadius) return { creature: c, spot }
    }
  }
  return null
}

/** Picking up dropped items (task #33): who goes for a wearable lying around — by the same trait dials as food. */
export const COLLECT = {
  /** Items within this distance (px) are noticed. */
  notice: 600,
  /** Timid + curious only while the hand is at least this far from the item; timid + incurious only while the hand
   *  is at least `shyClear` px away (or gone) and no other creature is within `shyAlone` px of it. */
  peekerClear: 150,
  shyClear: 250,
  shyAlone: 150,
  /** In reach to grab it (× size): sideways, and below its center (tentacles stretched toward it). */
  reachX: 1.4,
  reachDown: 5,
  /** Swim-speed multiplier on the way. */
  speed: 2.2,
} as const

/** Could this creature wear this item right now? (Only into free spots — no stealing back and forth.) */
function hasRoomFor(c: Creature, kind: WearableKind): boolean {
  return spotsOf(kind).every((s) => c.dress[s] === null)
}

/**
 * Decide whether to go and pick up a dropped item this step (called by the mind when calm and not eating or playing).
 * Puts it on when in reach. Returns 'collect', or null to keep the mind's choice.
 */
export function chooseCollect(c: Creature, world: World): IntentKind | null {
  if (minds(c)) return null // the Grumpy never picks this stuff up
  let item: Prop | null = null
  let best: number = COLLECT.notice
  for (const p of world.props.items) {
    if (!isWearable(p.kind) || p.kind === 'balloon' || !hasRoomFor(c, p.kind)) continue
    const d = Math.hypot(p.position.x - c.position.x, p.position.y - c.position.y)
    if (d < best) {
      best = d
      item = p
    }
  }
  if (!item) {
    c.mind.collect = null
    return null
  }
  const hand = world.presence
  const handGap = hand.active
    ? Math.hypot(hand.position.x - item.position.x, hand.position.y - item.position.y)
    : Infinity
  const curious = c.traits.curiosity >= 0.5
  const bold = c.traits.boldness >= 0.5
  if (!bold && curious && handGap < COLLECT.peekerClear) return null
  if (!bold && !curious) {
    const crowded = world.creatures.some(
      (o) =>
        o !== c &&
        Math.hypot(o.position.x - item!.position.x, o.position.y - item!.position.y) <
          COLLECT.shyAlone,
    )
    if (handGap < COLLECT.shyClear || crowded) return null
  }
  c.mind.collect = { propId: item.id }
  const dx = Math.abs(item.position.x - c.position.x)
  const dy = item.position.y - c.position.y
  if (
    dx <= c.size * COLLECT.reachX &&
    dy >= -c.size * COLLECT.reachX &&
    dy <= c.size * COLLECT.reachDown
  ) {
    removeProp(world, item.id)
    wearOn(world, c, item.kind as WearableKind)
    c.mind.collect = null
    showEmote(c, 'heart')
    return null
  }
  return 'collect'
}

/** Where to steer to pick the item up: just above it (tentacles reach down to it). */
export function collectTarget(world: World, c: Creature, out: Vec2): Vec2 | null {
  const item = world.props.items.find((p) => p.id === c.mind.collect?.propId)
  if (!item) return null
  out.x = item.position.x
  out.y = item.position.y - c.size * 2.4
  return out
}

/** Does this creature mind wearing things? (Bold + incurious: the Grumpy.) */
function minds(c: Creature): boolean {
  return c.traits.boldness >= 0.5 && c.traits.curiosity < 0.5
}

/** 0..1 — how hard the creature is shaking right now (for the renderer); 0 when not shaking. */
export function shakeAmount(c: Creature, time: number): number {
  const t = time - c.dress.shakingSince
  if (t < 0 || t > WEAR.shakeSeconds) return 0
  return Math.sin((t / WEAR.shakeSeconds) * Math.PI) // eases in and out
}

/** Advance one fixed step: a dressed Grumpy shakes, and each shake drops one item (with a 💢). */
export function stepWearables(world: World): void {
  for (const c of world.creatures) {
    const d = c.dress
    if (!isDressed(d)) continue
    if (!minds(c)) continue
    if (world.time >= d.shakeAt && d.shakingSince < d.shakeAt) {
      d.shakingSince = world.time // start a shake
      showEmote(c, 'anger')
    }
    if (d.shakingSince >= d.shakeAt && world.time - d.shakingSince >= WEAR.shakeSeconds) {
      const spot = SPOTS.find((s) => d[s] !== null)
      if (spot) dropOff(world, c, spot) // one item falls off
      d.shakeAt = isDressed(d) ? world.time + WEAR.shakeEvery : Infinity
    }
  }
}
