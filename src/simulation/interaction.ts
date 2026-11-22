/**
 * Direct interaction: boop (quick click/tap) and grab-and-drag (press and hold).
 *
 * - **Hit-testing** uses the body proportions the simulation owns (`BODY`): an ellipse for the head and a
 *   fan-shaped zone below it for the tentacles. Head hits beat tentacle hits; the top-most creature wins.
 * - **Boop vs grab** is decided from the press: released quickly without moving → boop; otherwise → hold.
 * - **Holding** is a layer *above* the mind (ADR 0004): the mind's intent becomes `'held'` while emotions keep
 *   updating underneath (holding counts as maximum pressure, so each archetype feels what the grid predicts).
 *   Movement follows a spring to the cursor, offset by a **pull**: rhythmic yanks in a slowly drifting direction
 *   (never beyond the tether), plus a sideways wriggle — both set by fear/grumpiness × energy, so a Friendly barely
 *   struggles. A top speed (`maxHeldSpeed`) keeps catch-ups fast but never instant.
 * - **Sound events** (grab, struggle squeaks, boop) are recorded here; the audio layer plays them.
 * - Own random stream for squeak timing, so the creatures' randomness is unchanged.
 */
import { BODY, type Creature } from './creature'
import { showEmote, type EmoteKind } from './expression'
import { createRng, range, type Rng } from './rng'
import { vec2, type Vec2 } from './vec2'
import type { World } from './world'

export type GrabPart = 'head' | 'tentacle'
export type InteractionSoundKind = 'grab' | 'squeak' | 'boop'

export interface InteractionSound {
  kind: InteractionSoundKind
  creatureId: number
}

/** A press that hasn't yet become a boop or a hold. */
export interface Press {
  creatureId: number
  part: GrabPart
  /** Grab point relative to the creature's center (world px). */
  offset: Vec2
  at: number
  x0: number
  y0: number
  maxMove: number
}

export interface Hold {
  creatureId: number
  part: GrabPart
  offset: Vec2
  since: number
  /** Starting direction (radians) of the creature's pull; it drifts from here. */
  pullAngle: number
  /** Seconds until the next struggle squeak. */
  squeakTimer: number
}

export interface Interaction {
  press: Press | null
  hold: Hold | null
  /** Recent sound events (newest last, capped). The audio layer reports each once. */
  sounds: InteractionSound[]
  rng: Rng
}

export const INTERACTION = {
  /** Head hit area: the mantle ellipse scaled by this (a little forgiving). */
  headTolerance: 1.12,
  /** Tentacle zone: how far below the roots (× tentacle length), and its half-width at root / tip (× size). */
  tentacleReach: 1.1,
  tentacleHalfWidth: [0.75, 2.0],
  /** Boop: released within this time and moved less than this (px). Otherwise it's a hold. */
  boopSeconds: 0.25,
  boopMove: 8,
  /** Spring pulling the grab point to its target (1/s²) and its damping (1/s). */
  spring: 120,
  damping: 12,
  /** The grab point never trails the cursor by more than this (px) — unless blocked, or catching up. */
  tether: 50,
  /** Top speed of a held creature (px/s): catching up after being blocked is fast, never instant. */
  maxHeldSpeed: 1200,
  /** Pull: how far (px) a fully upset creature strains away from the hand (stays inside the tether). */
  maxPull: 36,
  /** Upset below this (fear + grumpiness) is calm: no struggle. And how much curiosity eases the struggle. */
  calmUpset: 0.3,
  curiousEase: 0.5,
  /** Pull rhythm (yanks per second): timid creatures yank fast, bold ones slow and firm; energy speeds it up. */
  pullHz: [2.2, 0.9],
  /** How quickly the pull direction drifts (rad/s, roughly). */
  pullDrift: 0.8,
  /** Sideways wriggle (px/s² at full struggle). */
  wriggleForce: 160,
  wriggleHz: 2.5,
  /** Struggle squeaks while held (s), when struggling at least this much. */
  squeakEvery: [0.4, 0.8],
  squeakThreshold: 0.35,
  /** Boop squash impulse (squash units per second). */
  boopSquash: 6,
  /** Startle a boop gives timid creatures (they scoot away). */
  boopStartle: 0.8,
  soundLog: 16,
  streamSalt: 0x9a8b0005,
} as const

export function createInteraction(seed: number): Interaction {
  return { press: null, hold: null, sounds: [], rng: createRng(seed ^ INTERACTION.streamSalt) }
}

/** Which creature (and part) is under (x, y)? Head hits win over tentacles; the top-most creature wins. */
export function creatureAt(
  world: World,
  x: number,
  y: number,
): { creature: Creature; part: GrabPart } | null {
  // Drawn back to front by y, so the creature lowest on screen is on top.
  const topFirst = [...world.creatures].sort((a, b) => b.position.y - a.position.y)
  for (const c of topFirst) if (hitsHead(c, x, y)) return { creature: c, part: 'head' }
  for (const c of topFirst) if (hitsTentacles(c, x, y)) return { creature: c, part: 'tentacle' }
  return null
}

function hitsHead(c: Creature, x: number, y: number): boolean {
  const rx = c.size * INTERACTION.headTolerance
  const ry = c.size * BODY.mantleHalfHeight * INTERACTION.headTolerance
  return ((x - c.position.x) / rx) ** 2 + ((y - c.position.y) / ry) ** 2 <= 1
}

function hitsTentacles(c: Creature, x: number, y: number): boolean {
  const top = c.position.y + c.size * BODY.tentacleRootY
  const length = c.size * BODY.tentacleLength * INTERACTION.tentacleReach
  const t = (y - top) / length
  if (t < 0 || t > 1) return false
  const [rootHalf, tipHalf] = INTERACTION.tentacleHalfWidth
  return Math.abs(x - c.position.x) <= c.size * (rootHalf + (tipHalf - rootHalf) * t)
}

/**
 * How hard a held creature struggles (0 .. ~1.4): fear/grumpiness above a calm dead zone, × energy.
 * Curious creatures struggle less (they're half-interested in you) — so a curious, unbothered Friendly doesn't.
 */
export function struggleLevel(c: Creature): number {
  const upset = Math.min(1, c.mind.emotion.levels.scared + c.mind.emotion.levels.grumpy)
  const beyondCalm = Math.max(0, (upset - INTERACTION.calmUpset) / (1 - INTERACTION.calmUpset))
  return (
    beyondCalm * (0.6 + 0.8 * c.traits.energy) * (1 - INTERACTION.curiousEase * c.traits.curiosity)
  )
}

export function isHeld(world: World, c: Creature): boolean {
  return world.interaction.hold?.creatureId === c.id
}

/** Advance one fixed step (after presence, before the creatures think). */
export function stepInteraction(world: World, dt: number): void {
  const it = world.interaction
  const p = world.presence
  const find = (id: number) => world.creatures.find((c) => c.id === id)

  if (it.hold && !p.pressed) {
    release(world, it.hold)
    it.hold = null
  }

  if (it.press) {
    const press = it.press
    const moved = Math.hypot(p.position.x - press.x0, p.position.y - press.y0)
    press.maxMove = Math.max(press.maxMove, moved)
    const creature = find(press.creatureId)
    if (!creature) {
      it.press = null
    } else if (!p.pressed) {
      boop(world, creature) // released quickly and without dragging
      it.press = null
    } else if (
      world.time - press.at >= INTERACTION.boopSeconds ||
      press.maxMove > INTERACTION.boopMove
    ) {
      it.hold = {
        creatureId: press.creatureId,
        part: press.part,
        offset: press.offset,
        since: world.time,
        pullAngle: range(it.rng, 0, Math.PI * 2),
        squeakTimer: range(it.rng, INTERACTION.squeakEvery[0], INTERACTION.squeakEvery[1]),
      }
      it.press = null
      sound(it, 'grab', creature.id)
    }
  }

  if (p.justPressed && !it.hold && !it.press) {
    const hit = creatureAt(world, p.position.x, p.position.y)
    if (hit) {
      it.press = {
        creatureId: hit.creature.id,
        part: hit.part,
        offset: vec2(
          p.position.x - hit.creature.position.x,
          p.position.y - hit.creature.position.y,
        ),
        at: world.time,
        x0: p.position.x,
        y0: p.position.y,
        maxMove: 0,
      }
    }
  }

  if (it.hold) {
    const creature = find(it.hold.creatureId)
    if (!creature) {
      it.hold = null
      return
    }
    it.hold.squeakTimer -= dt
    if (it.hold.squeakTimer <= 0) {
      if (struggleLevel(creature) >= INTERACTION.squeakThreshold) sound(it, 'squeak', creature.id)
      it.hold.squeakTimer = range(it.rng, INTERACTION.squeakEvery[0], INTERACTION.squeakEvery[1])
    }
  }
}

/**
 * Where a held creature is straining toward, relative to the hand (px): a drifting direction × rhythmic yanks.
 * Stateless (a function of time and the hold), so it's deterministic and costs nothing to store.
 */
export function pullOffset(out: Vec2, c: Creature, hold: Hold, time: number): Vec2 {
  const I = INTERACTION
  const t = time - hold.since
  // The direction wanders smoothly: two incommensurate sines never quite repeat.
  const angle =
    hold.pullAngle + Math.sin(t * I.pullDrift + c.id) * 1.4 + Math.sin(t * I.pullDrift * 0.37) * 0.9
  // Yanks: strain hard, ease off, strain again (a sharpened pulse, never fully slack).
  const [timidHz, boldHz] = I.pullHz
  const hz = (timidHz + (boldHz - timidHz) * c.traits.boldness) * (0.7 + 0.6 * c.traits.energy)
  const pulse = (0.5 - 0.5 * Math.cos(t * hz * Math.PI * 2)) ** 2
  const amount = I.maxPull * Math.min(1, struggleLevel(c)) * (0.35 + 0.65 * pulse)
  out.x = Math.cos(angle) * amount
  out.y = Math.sin(angle) * amount
  return out
}

const pull = vec2()

/** Spring toward the hand (+ the creature's pull) and a sideways wriggle, for intent 'held'. */
export function heldForce(out: Vec2, world: World, c: Creature): Vec2 {
  const hold = world.interaction.hold
  const cursor = world.presence.position
  if (!hold) {
    out.x = 0
    out.y = 0
    return out
  }
  const I = INTERACTION
  pullOffset(pull, c, hold, world.time)
  // Spring: the grab point (center + offset) is pulled toward the hand + the creature's pull, damped.
  out.x = I.spring * (cursor.x + pull.x - (c.position.x + hold.offset.x)) - I.damping * c.velocity.x
  out.y = I.spring * (cursor.y + pull.y - (c.position.y + hold.offset.y)) - I.damping * c.velocity.y

  // Wriggle: side to side, across the direction of the pull.
  const len = Math.hypot(pull.x, pull.y)
  const ax = len > 1e-6 ? pull.x / len : 0
  const ay = len > 1e-6 ? pull.y / len : 1
  const level = struggleLevel(c)
  const wriggle = Math.sin(world.time * I.wriggleHz * Math.PI * 2 + c.id) * I.wriggleForce * level
  out.x += -ay * wriggle
  out.y += ax * wriggle
  return out
}

/**
 * Keep the grab point within the tether of the hand (after integration, before constraints) — but never faster
 * than `maxHeldSpeed`: if it fell far behind (blocked, or a very fast flick), it zooms to catch up over a few frames.
 */
export function applyTether(world: World, dt: number): void {
  const hold = world.interaction.hold
  if (!hold) return
  const c = world.creatures.find((cr) => cr.id === hold.creatureId)
  if (!c) return
  const cursor = world.presence.position
  const dx = cursor.x - (c.position.x + hold.offset.x)
  const dy = cursor.y - (c.position.y + hold.offset.y)
  const d = Math.hypot(dx, dy)
  if (d > INTERACTION.tether) {
    const pullIn = 1 - INTERACTION.tether / d
    c.position.x += dx * pullIn
    c.position.y += dy * pullIn
  }
  // Cap this step's total movement (velocity + tether) at the top speed.
  const mx = c.position.x - c.prevPosition.x
  const my = c.position.y - c.prevPosition.y
  const moved = Math.hypot(mx, my)
  const max = INTERACTION.maxHeldSpeed * dt
  if (moved > max) {
    c.position.x = c.prevPosition.x + (mx * max) / moved
    c.position.y = c.prevPosition.y + (my * max) / moved
  }
}

/** Emote for a boop / release, by personality quadrant (curiosity × boldness). */
function emoteFor(c: Creature): EmoteKind {
  const bold = c.traits.boldness >= 0.5
  const curious = c.traits.curiosity >= 0.5
  if (bold && curious) return 'heart'
  if (!bold && curious) return 'question'
  if (!bold && !curious) return 'exclaim'
  return 'anger'
}

function boop(world: World, c: Creature): void {
  c.anim.squashVel += INTERACTION.boopSquash
  c.anim.blinkTimer = 0 // a surprised blink
  if (c.traits.boldness < 0.5) {
    c.perception.startle = Math.max(c.perception.startle, INTERACTION.boopStartle) // timid ones scoot away
  }
  showEmote(c, emoteFor(c))
  sound(world.interaction, 'boop', c.id)
}

function release(world: World, hold: Hold): void {
  const c = world.creatures.find((cr) => cr.id === hold.creatureId)
  if (!c) return
  // A Friendly is glad to be held: a ♥ on release. Everyone else just reacts through their mood.
  if (c.traits.boldness >= 0.5 && c.traits.curiosity >= 0.5) showEmote(c, 'heart')
}

function sound(it: Interaction, kind: InteractionSoundKind, creatureId: number): void {
  it.sounds.push({ kind, creatureId })
  if (it.sounds.length > INTERACTION.soundLog) it.sounds.shift()
}
