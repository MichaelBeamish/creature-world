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
 * - **Shake → ink** (task #21): shaking the hand fills a **stress** bucket that leaks when calm; past the creature's
 *   limit (bold/curious ones put up with more) it squirts ink, slips free, darts off and stays rattled for a while.
 * - **Sound events** (grab, struggle squeaks, boop, ink) are recorded here; the audio layer plays them.
 * - Own random stream for squeak timing, so the creatures' randomness is unchanged.
 */
import { BODY, type Creature } from './creature'
import { showEmote, type EmoteKind } from './expression'
import { spawnInk } from './ink'
import { createRng, range, type Rng } from './rng'
import { vec2, type Vec2 } from './vec2'
import type { World } from './world'

export type GrabPart = 'head' | 'tentacle'
export type InteractionSoundKind = 'grab' | 'squeak' | 'boop' | 'ink'

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
  /** Shake detection: the hand's (smoothed) velocity last step, its smoothed acceleration, and the stress bucket. */
  handSpeed: number
  shake: number
  stress: number
}

export interface Interaction {
  press: Press | null
  hold: Hold | null
  /** Recent sound events (newest last, capped). The audio layer reports each once. */
  sounds: InteractionSound[]
  /** The creature jetting away after inking, and until when (world time). */
  jet: { creatureId: number; until: number } | null
  /** A Grumpy's second squirt, aimed at the hand: who, and when (world time). */
  followUp: { creatureId: number; at: number } | null
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
  /**
   * Shake → ink. The hand's *speed jolts* (how sharply its speed changes, px/s²) are smoothed (`shakeSmoothing`, s);
   * above `shakeAccel` they fill the stress bucket at (excess / `shakeScale`) per second, and the bucket leaks
   * `stressLeak` per second. Measured: gentle wiggles, sweeps and swirls stay below ~2,300; trackpad shakes are
   * ~4,700–8,000. Ink when stress reaches the creature's limit:
   * `stressLimit[0]` + boldness × `stressLimit[1]` + boldness × curiosity × `stressLimit[2]`
   * (only the Friendly — bold *and* curious — gets the big bonus: it's patient; the others ink within 1–2 s).
   */
  shakeSmoothing: 0.1,
  shakeAccel: 2500,
  shakeScale: 2000,
  stressLeak: 0.35,
  /** The bucket fills at most this fast (per s): only *sustained* shaking inks — a single flick never does. */
  stressFillMax: 1.5,
  stressLimit: [0.76, 1.11, 2.29],
  /** Near the limit (fraction of it), the warning tell starts: faster squeaks (and a tremble, in the renderer). */
  stressWarning: 0.55,
  /** After inking, a jet escape: this fast (px/s), easing off over this long (s), above the normal speed limit. */
  jetSpeed: 380,
  jetSeconds: 0.5,
  /** A bold, incurious creature (the Grumpy) stands its ground instead: a small recoil (px/s), then a second
   *  squirt aimed straight at the hand this long (s) after the first, with this much aim (0..1). */
  recoil: 90,
  followUpDelay: 0.35,
  followUpAim: 0.85,
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
  return {
    press: null,
    hold: null,
    sounds: [],
    jet: null,
    followUp: null,
    rng: createRng(seed ^ INTERACTION.streamSalt),
  }
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

/**
 * Speed limit while jetting away after inking (easing from `jetSpeed` down to 0 over `jetSeconds`), or 0 if not.
 * Movement uses the larger of this and the creature's normal limit.
 */
export function jetLimit(world: World, c: Creature): number {
  const jet = world.interaction.jet
  if (!jet || jet.creatureId !== c.id || world.time >= jet.until) return 0
  return INTERACTION.jetSpeed * ((jet.until - world.time) / INTERACTION.jetSeconds)
}

export function isHeld(world: World, c: Creature): boolean {
  return world.interaction.hold?.creatureId === c.id
}

/** Advance one fixed step (after presence, before the creatures think). */
export function stepInteraction(world: World, dt: number): void {
  const it = world.interaction
  const p = world.presence
  const find = (id: number) => world.creatures.find((c) => c.id === id)

  // A Grumpy's second squirt: straight at the hand.
  if (it.followUp && world.time >= it.followUp.at) {
    const grump = find(it.followUp.creatureId)
    it.followUp = null
    if (grump) {
      const [tx, ty] = towardHand(world, grump)
      spawnInk(world.ink, grump, world.time, tx, ty, INTERACTION.followUpAim)
      showEmote(grump, 'anger')
      sound(it, 'ink', grump.id)
    }
  }

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
        handSpeed: Math.hypot(p.velocity.x, p.velocity.y),
        shake: 0,
        stress: 0,
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
    const hold = it.hold
    updateStress(hold, p.velocity, dt)
    if (hold.stress >= stressLimit(creature)) {
      squirtInk(world, creature)
      it.hold = null // slips free (a fresh press is needed to grab again)
      return
    }

    // Squeaks: while struggling, or as a warning when stress nears the limit — faster the closer it gets.
    const stressed = stressFraction(world, creature)
    const warning =
      Math.max(0, stressed - INTERACTION.stressWarning) / (1 - INTERACTION.stressWarning)
    hold.squeakTimer -= dt * (1 + 2 * warning)
    if (hold.squeakTimer <= 0) {
      if (struggleLevel(creature) >= INTERACTION.squeakThreshold || warning > 0) {
        sound(it, 'squeak', creature.id)
      }
      hold.squeakTimer = range(it.rng, INTERACTION.squeakEvery[0], INTERACTION.squeakEvery[1])
    }
  }
}

/** Shake detection: smoothed hand acceleration above a threshold fills the (leaky) stress bucket. */
function updateStress(hold: Hold, handVelocity: Vec2, dt: number): void {
  const I = INTERACTION
  // How sharply the hand's *speed* changes: a shake goes fast-stop-fast-stop, while a circle or a sweep keeps a
  // steady speed (so swirling a creature around isn't shaking, however fast).
  const speed = Math.hypot(handVelocity.x, handVelocity.y)
  const jolt = Math.abs(speed - hold.handSpeed) / dt
  hold.handSpeed = speed
  // Exponential moving average, step-size independent (like the presence velocity).
  hold.shake += (jolt - hold.shake) * (1 - Math.exp(-dt / I.shakeSmoothing))
  const fill = Math.min(I.stressFillMax, Math.max(0, hold.shake - I.shakeAccel) / I.shakeScale)
  hold.stress = Math.max(0, hold.stress + (fill - I.stressLeak) * dt)
}

/** How much shaking this creature puts up with before it inks (bold ones more; a Friendly — bold and curious — most). */
export function stressLimit(c: Creature): number {
  const [base, bold, friendly] = INTERACTION.stressLimit
  const { boldness, curiosity } = c.traits
  return base + bold * boldness + friendly * boldness * curiosity
}

/** 0..1 — how close the held creature is to inking (0 when not held). Read by the renderer for the warning tell. */
export function stressFraction(world: World, c: Creature): number {
  const hold = world.interaction.hold
  if (!hold || hold.creatureId !== c.id) return 0
  return Math.min(1, hold.stress / stressLimit(c))
}

/** Unit direction from the creature to the hand (straight up if they coincide). */
function towardHand(world: World, c: Creature): [number, number] {
  const hand = world.presence.position
  const tx = hand.x - c.position.x
  const ty = hand.y - c.position.y
  const len = Math.hypot(tx, ty)
  return len < 1e-6 ? [0, -1] : [tx / len, ty / len]
}

/** A bold, incurious creature (the Grumpy) doesn't run from a fight. */
export function standsItsGround(c: Creature): boolean {
  return c.traits.boldness >= 0.5 && c.traits.curiosity < 0.5
}

/**
 * Squirt ink toward the hand, slip free, and remember it (rattled). Most creatures jet away and flee;
 * a Grumpy recoils a little, squirts again straight at the hand, and stays to glare (its grudge is in the mood).
 */
function squirtInk(world: World, c: Creature): void {
  const [tx, ty] = towardHand(world, c)
  spawnInk(world.ink, c, world.time, tx, ty)
  c.perception.startle = 1
  c.perception.rattled = 1
  c.perception.trust = 0
  if (standsItsGround(c)) {
    c.velocity.x = -tx * INTERACTION.recoil
    c.velocity.y = -ty * INTERACTION.recoil
    world.interaction.followUp = { creatureId: c.id, at: world.time + INTERACTION.followUpDelay }
    showEmote(c, 'anger')
  } else {
    c.velocity.x = -tx * INTERACTION.jetSpeed
    c.velocity.y = -ty * INTERACTION.jetSpeed
    world.interaction.jet = { creatureId: c.id, until: world.time + INTERACTION.jetSeconds }
    showEmote(c, 'exclaim')
  }
  sound(world.interaction, 'ink', c.id)
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
