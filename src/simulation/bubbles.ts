/**
 * Bubbles — a small particle system.
 *
 * - **Fixed pool (ring buffer):** `capacity` bubble records are allocated once; new bubbles overwrite the oldest
 *   slot. Memory and cost stay bounded however much the creatures are scared, and nothing is allocated per frame.
 * - **Analytic motion:** a bubble stores only where/when it was born and its random traits. `bubbleAt` computes
 *   its position, size and pop state for any time in closed form — no per-bubble update loop, fully reproducible.
 * - **Spawned from state changes:** a burst when a creature's intent *becomes* flee/hide, a trickle while it keeps
 *   darting, and a Grumpy "huff" when it squares up (standoff).
 * - **Independent random stream** (like the scenery), so creatures' randomness is unchanged.
 */
import { BODY, type Creature } from './creature'
import type { IntentKind } from './mindState'
import { createRng, int, range, type Rng } from './rng'
import type { World } from './world'

export interface Bubble {
  active: boolean
  /** World time (s) when it was released. */
  bornAt: number
  x0: number
  y0: number
  /** Random traits, fixed at birth. */
  radius0: number
  rise: number
  wobbleAmp: number
  wobbleHz: number
  phase: number
  life: number
}

export interface BubbleSystem {
  /** Fixed-size pool; never grows. */
  pool: Bubble[]
  /** Next slot to (re)use. */
  next: number
  rng: Rng
  /** Each creature's intent at the previous step (keyed by creature id) — to detect changes. */
  lastIntent: Record<number, IntentKind>
  /** Seconds until each fleeing creature releases its next trickle bubble. */
  trickle: Record<number, number>
}

export const BUBBLES = {
  capacity: 64,
  /** Bubbles released at once when a creature starts to flee or hide. */
  burst: [2, 3],
  /** Bubbles a Grumpy "huffs" when it squares up (enters standoff). */
  huff: 1,
  /** While fleeing faster than `trickleSpeed` (px/s), one bubble every this many seconds. */
  trickleEvery: [0.6, 1.2],
  trickleSpeed: 45,
  /** Rise speed (px/s) and a gentle upward acceleration (px/s²) — bubbles speed up as they rise. */
  riseSpeed: [40, 70],
  riseAccel: 10,
  /** Side-to-side wobble: amplitude (px) and frequency (Hz). */
  wobbleAmp: [3, 7],
  wobbleHz: [1.2, 2.2],
  /** Starting radius (px); grows by `growth` (fraction) over its life, like real bubbles as pressure drops. */
  radius: [2.5, 5],
  growth: 0.5,
  /** Lifetime (s) before popping, unless it reaches the surface first. */
  life: [2.5, 5],
  /** Bubbles pop this close to the top of the water (px). */
  surface: 8,
  /** How long the pop ring lasts (s). */
  popDuration: 0.18,
  streamSalt: 0xb0bb1e5,
} as const

const SCARED: readonly IntentKind[] = ['flee', 'hide']

export function createBubbles(seed: number): BubbleSystem {
  const pool: Bubble[] = Array.from({ length: BUBBLES.capacity }, () => ({
    active: false,
    bornAt: 0,
    x0: 0,
    y0: 0,
    radius0: 0,
    rise: 0,
    wobbleAmp: 0,
    wobbleHz: 0,
    phase: 0,
    life: 0,
  }))
  return {
    pool,
    next: 0,
    rng: createRng(seed ^ BUBBLES.streamSalt),
    lastIntent: {},
    trickle: {},
  }
}

/** Advance one fixed step: release new bubbles from intent changes / trickles, retire finished ones. */
export function stepBubbles(world: World, dt: number): void {
  const system = world.bubbles
  for (const creature of world.creatures) {
    const intent = creature.mind.intent
    const last = system.lastIntent[creature.id] ?? intent
    const nowScared = SCARED.includes(intent)
    const wasScared = SCARED.includes(last)

    if (nowScared && !wasScared) {
      release(system, creature, world.time, int(system.rng, BUBBLES.burst[0], BUBBLES.burst[1]))
      system.trickle[creature.id] = range(
        system.rng,
        BUBBLES.trickleEvery[0],
        BUBBLES.trickleEvery[1],
      )
    }
    if (intent === 'standoff' && last !== 'standoff') {
      release(system, creature, world.time, BUBBLES.huff)
    }

    const speed = Math.hypot(creature.velocity.x, creature.velocity.y)
    if (nowScared && speed > BUBBLES.trickleSpeed) {
      const left = (system.trickle[creature.id] ?? 0) - dt
      if (left <= 0) {
        release(system, creature, world.time, 1)
        system.trickle[creature.id] = range(
          system.rng,
          BUBBLES.trickleEvery[0],
          BUBBLES.trickleEvery[1],
        )
      } else {
        system.trickle[creature.id] = left
      }
    }
    system.lastIntent[creature.id] = intent
  }

  // Retire bubbles that have finished popping (frees nothing — the slot is simply reusable).
  for (const b of system.pool) {
    if (b.active && bubbleAt(b, world.time).state === 'gone') b.active = false
  }
}

/** Release `count` bubbles from the top of the creature's head, reusing the oldest pool slots. */
function release(system: BubbleSystem, creature: Creature, time: number, count: number): void {
  const { rng } = system
  const headTop = creature.position.y - creature.size * BODY.mantleHalfHeight * 0.8
  for (let i = 0; i < count; i++) {
    const b = system.pool[system.next]!
    system.next = (system.next + 1) % system.pool.length
    b.active = true
    b.bornAt = time + i * 0.04 // a quick stagger, so a burst reads as a little stream
    b.x0 = creature.position.x + range(rng, -0.4, 0.4) * creature.size
    b.y0 = headTop + range(rng, -0.15, 0.15) * creature.size
    b.radius0 = range(rng, BUBBLES.radius[0], BUBBLES.radius[1])
    b.rise = range(rng, BUBBLES.riseSpeed[0], BUBBLES.riseSpeed[1])
    b.wobbleAmp = range(rng, BUBBLES.wobbleAmp[0], BUBBLES.wobbleAmp[1])
    b.wobbleHz = range(rng, BUBBLES.wobbleHz[0], BUBBLES.wobbleHz[1])
    b.phase = range(rng, 0, Math.PI * 2)
    b.life = range(rng, BUBBLES.life[0], BUBBLES.life[1])
  }
}

export interface BubbleState {
  state: 'waiting' | 'rising' | 'popping' | 'gone'
  x: number
  y: number
  radius: number
  /** 0..1 during the pop. */
  popProgress: number
}

/**
 * Where a bubble is at `time`, in closed form. `wobble` scales the side-to-side motion (0 under reduced motion).
 * It rises with a gentle acceleration, wobbles, grows, and pops at the surface or at the end of its life.
 */
export function bubbleAt(b: Bubble, time: number, wobble = 1): BubbleState {
  const age = time - b.bornAt
  if (age < 0) return { state: 'waiting', x: b.x0, y: b.y0, radius: b.radius0, popProgress: 0 }

  // Time to reach the surface: solve y0 - rise·t - ½·a·t² = surface for t.
  const a = BUBBLES.riseAccel
  const distance = Math.max(0, b.y0 - BUBBLES.surface)
  const toSurface = (-b.rise + Math.sqrt(b.rise * b.rise + 2 * a * distance)) / a
  const end = Math.min(b.life, toSurface)
  const t = Math.min(age, end)

  const y = b.y0 - b.rise * t - 0.5 * a * t * t
  const x =
    b.x0 +
    wobble * b.wobbleAmp * Math.sin(b.wobbleHz * Math.PI * 2 * t + b.phase) * Math.min(1, t * 2)
  const radius = b.radius0 * (1 + BUBBLES.growth * Math.min(1, t / b.life))

  if (age < end) return { state: 'rising', x, y, radius, popProgress: 0 }
  const pop = (age - end) / BUBBLES.popDuration
  if (pop < 1) return { state: 'popping', x, y, radius, popProgress: pop }
  return { state: 'gone', x, y, radius, popProgress: 1 }
}
