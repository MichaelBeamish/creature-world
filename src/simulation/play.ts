/**
 * Playing with toys (task #29) — a layer in the mind after food, only when calm, decided by the trait dials:
 *
 * - **Bold + curious** (the Friendly) plays *fetch*: it swims behind the toy and nudges it toward the visitor's hand
 *   (♥ when it delivers it).
 * - **Timid + curious** (the Peeker) *nudges* a toy once (`?`), darts back to watch, and comes back for another.
 * - **Bold + incurious** (the Grumpy) won't play: a toy that comes close gets *swatted* away (💢).
 * - **Timid + incurious** (the Scaredy) plays *shyly*: only when nobody's watching (the hand away from the toy, no
 *   other creature near it) it sneaks up, nudges it and scurries back; otherwise it keeps its distance. It flinches
 *   (`!`) when the ball lands hard nearby.
 *
 * Pushing a toy isn't scripted: any creature whose body touches a toy pushes it (`resolveToyContacts`), so a playing
 * creature just steers to a point *behind* the toy (opposite where it wants it to go) and swims through it — the
 * "kick from behind" trick from football AI. Interest runs out after a while, then it's bored of toys for a bit.
 */
import type { Creature } from './creature'
import { showEmote } from './expression'
import { recordSound } from './interaction'
import type { IntentKind } from './mindState'
import { TOY, type Prop } from './props'
import type { Vec2 } from './vec2'
import type { World } from './world'

export const PLAY = {
  /** Toys within this distance (px) are noticed. */
  notice: 700,
  /** A play session lasts this long (s); then it's bored of toys for `bored` s. */
  sessionSeconds: 12,
  bored: 6,
  /** Fetch: aim for a point this far (× size) behind the toy; delivered when the toy is within `deliver` px of the
   *  hand. With no hand, it nudges the toy toward the middle of the pool. */
  behind: 1.4,
  deliver: 110,
  /** Nudge (Peeker): after touching the toy it backs off to `peekBack` px for `peekBackSeconds` s, then returns. */
  peekBack: 170,
  peekBackSeconds: 2.5,
  /** Shy (Scaredy): plays only while the hand is at least `shyClear` px from the toy (or gone) and no other creature
   *  is within `shyAlone` px of it; otherwise keeps at least `avoid` px away. Flinches at a hard landing within
   *  `flinch` px. */
  shyClear: 250,
  shyAlone: 150,
  avoid: 150,
  flinch: 160,
  /** Swat (Grumpy): a toy within this far (× size) of its body (head or tentacles) gets swatted away at `swatSpeed`
   *  px/s, at most every `swatEvery` s. */
  swatRange: 0.8,
  swatSpeed: 380,
  swatEvery: 1,
  /** Contact: how much of the creature's speed a bumped toy takes, plus a small kick (px/s) along the contact normal. */
  push: 1.3,
  kick: 60,
  /** The ball is livelier: it takes more of a hit, and pops upward (`ballLift` px/s for a full hit). */
  ballPush: 1.9,
  ballLift: 90,
  /** The duck squeaks on a bump (relative speed above `squeakSpeed` px/s), at most every `squeakEvery` s. */
  squeakSpeed: 25,
  squeakEvery: 0.6,
  /** Swim-speed multiplier while playing. */
  speed: 3,
} as const

type Style = 'fetch' | 'nudge' | 'swat' | 'shy'

/** How this personality treats toys. */
export function playStyle(c: Creature): Style {
  const bold = c.traits.boldness >= 0.5
  const curious = c.traits.curiosity >= 0.5
  if (curious) return bold ? 'fetch' : 'nudge'
  return bold ? 'swat' : 'shy'
}

function isToy(p: Prop): p is Prop & { kind: 'duck' | 'ball' } {
  return p.kind === 'duck' || p.kind === 'ball'
}

function nearestToy(world: World, c: Creature, within: number): Prop | null {
  let best: Prop | null = null
  let bestD = within
  for (const p of world.props.items) {
    if (!isToy(p)) continue
    const d = Math.hypot(p.position.x - c.position.x, p.position.y - c.position.y)
    if (d < bestD) {
      bestD = d
      best = p
    }
  }
  return best
}

/**
 * Decide whether to play this step (called by the mind after food, only when calm and not eating).
 * Returns 'play', or null to keep the mind's choice.
 */
export function choosePlay(c: Creature, world: World): IntentKind | null {
  const mind = c.mind
  const style = playStyle(c)
  if (style === 'swat') return null // the Grumpy doesn't play (it swats — see resolveToyContacts)
  if (style === 'shy') {
    // Plays only when nobody's watching; otherwise keeps away from toys.
    const toy = nearestToy(world, c, PLAY.notice)
    if (toy && !watched(world, c, toy) && world.time >= mind.playBoredUntil) {
      if (mind.play?.propId !== toy.id) {
        mind.play = { propId: toy.id, since: world.time, phase: 'go', phaseSince: world.time }
      } else if (
        mind.play.phase === 'back' &&
        world.time - mind.play.phaseSince > PLAY.peekBackSeconds
      ) {
        mind.play.phase = 'go' // back from scurrying away: another nudge
        mind.play.phaseSince = world.time
      }
      if (world.time - mind.play.since > PLAY.sessionSeconds) return endPlay(c, world)
      return 'play'
    }
    const near = nearestToy(world, c, PLAY.avoid)
    mind.play = near
      ? { propId: near.id, since: world.time, phase: 'back', phaseSince: world.time }
      : null
    return near ? 'play' : null
  }

  if (world.time < mind.playBoredUntil) return null
  const toy = mind.play
    ? world.props.items.find((p) => p.id === mind.play!.propId)
    : nearestToy(world, c, PLAY.notice)
  if (!toy) {
    mind.play = null
    return null
  }
  if (!mind.play || mind.play.propId !== toy.id) {
    mind.play = { propId: toy.id, since: world.time, phase: 'go', phaseSince: world.time }
  }
  const play = mind.play
  if (world.time - play.since > PLAY.sessionSeconds) return endPlay(c, world)

  if (style === 'fetch') {
    const hand = world.presence
    if (hand.active) {
      const d = Math.hypot(hand.position.x - toy.position.x, hand.position.y - toy.position.y)
      if (d < PLAY.deliver) {
        showEmote(c, 'heart') // delivered!
        return endPlay(c, world)
      }
    }
  } else if (play.phase === 'back' && world.time - play.phaseSince > PLAY.peekBackSeconds) {
    play.phase = 'go'
    play.phaseSince = world.time
  }
  return 'play'
}

/** Is someone watching this toy? (The hand near it, or another creature close to it.) */
function watched(world: World, c: Creature, toy: Prop): boolean {
  const hand = world.presence
  if (
    hand.active &&
    Math.hypot(hand.position.x - toy.position.x, hand.position.y - toy.position.y) < PLAY.shyClear
  ) {
    return true
  }
  return world.creatures.some(
    (o) =>
      o !== c &&
      Math.hypot(o.position.x - toy.position.x, o.position.y - toy.position.y) < PLAY.shyAlone,
  )
}

function endPlay(c: Creature, world: World): null {
  c.mind.play = null
  c.mind.playBoredUntil = world.time + PLAY.bored
  return null
}

/** Where to steer while playing (movement reads it), and whether to swim away from the toy instead. */
export function playTarget(world: World, c: Creature, out: Vec2): { away: boolean } | null {
  const play = c.mind.play
  const toy = play ? world.props.items.find((p) => p.id === play.propId) : undefined
  if (!play || !toy) return null
  out.x = toy.position.x
  out.y = toy.position.y
  if (play.phase === 'back') return { away: true } // nudge/shy: back off and watch, or keep away

  // Where the toy should go: toward the hand (fetch), or straight on along the approach (nudge).
  let gx: number
  let gy: number
  const hand = world.presence
  if (playStyle(c) === 'fetch') {
    gx = (hand.active ? hand.position.x : world.width / 2) - toy.position.x
    gy = (hand.active ? hand.position.y : world.height / 2) - toy.position.y
  } else {
    gx = toy.position.x - c.position.x
    gy = toy.position.y - c.position.y
  }
  const gl = Math.hypot(gx, gy) || 1
  gx /= gl
  gy /= gl
  // Behind the toy (opposite the goal)? Then swim through it; otherwise get behind it first.
  const toC = { x: c.position.x - toy.position.x, y: c.position.y - toy.position.y }
  const along = toC.x * gx + toC.y * gy // negative = behind
  const lateral = Math.abs(toC.x * -gy + toC.y * gx)
  const behind = c.size * PLAY.behind
  if (along < 0 && lateral < c.size) {
    out.x = toy.position.x + gx * c.size
    out.y = toy.position.y + gy * c.size
  } else {
    out.x = toy.position.x - gx * behind
    out.y = toy.position.y - gy * behind
  }
  return { away: false }
}

/** A creature's body as two circles (head; tentacle bundle below it): what touches a toy. */
function bodyCircles(c: Creature): [number, number, number][] {
  return [
    [c.position.x, c.position.y, c.size * 1.1],
    [c.position.x, c.position.y + c.size * 2.2, c.size * 1.4],
  ]
}

/**
 * After everyone has moved: creatures push toys they touch (the toy takes the creature's speed plus a small kick and
 * spins), the duck squeaks, the Grumpy swats toys that come close, and a Scaredy flinches at a hard landing nearby.
 */
export function resolveToyContacts(world: World): void {
  for (const toy of world.props.items) {
    if (!isToy(toy)) continue
    const r = TOY.radius[toy.kind]
    for (const c of world.creatures) {
      // The Grumpy swats a toy that comes close (and isn't being carried by the visitor).
      if (playStyle(c) === 'swat') swat(world, c, toy)

      for (const [cx, cy, cr] of bodyCircles(c)) {
        const dx = toy.position.x - cx
        const dy = toy.position.y - cy
        const d = Math.hypot(dx, dy)
        if (d >= cr + r || d < 1e-6) continue
        const nx = dx / d
        const ny = dy / d
        // Push the toy out of the body…
        toy.position.x = cx + nx * (cr + r)
        toy.position.y = cy + ny * (cr + r)
        // …and give it the creature's speed along the contact normal (plus a little kick), and some spin.
        const vn = c.velocity.x * nx + c.velocity.y * ny
        const tn = toy.velocity.x * nx + toy.velocity.y * ny
        const ball = toy.kind === 'ball'
        const target = Math.max(0, vn) * (ball ? PLAY.ballPush : PLAY.push) + PLAY.kick
        if (tn < target) {
          toy.velocity.x += nx * (target - tn)
          toy.velocity.y += ny * (target - tn)
          // The ball pops up off a hit (more for a harder hit), then arcs back down.
          if (ball) toy.velocity.y -= PLAY.ballLift * Math.min(1, (target - tn) / 120)
          toy.spin += (c.velocity.x * -ny + c.velocity.y * nx) / r
          if (toy.kind === 'duck' && target - tn > PLAY.squeakSpeed) squeak(world, toy, c)
          if (
            c.mind.play?.propId === toy.id &&
            (playStyle(c) === 'nudge' || playStyle(c) === 'shy') &&
            c.mind.play.phase === 'go'
          ) {
            c.mind.play.phase = 'back' // nudged it: back off and watch
            c.mind.play.phaseSince = world.time
            showEmote(c, 'question')
          }
        }
        break
      }
    }
    // A hard landing near a Scaredy makes it flinch.
    if (toy.kind === 'ball' && toy.bouncedAt === world.time) {
      for (const c of world.creatures) {
        if (playStyle(c) !== 'shy') continue
        const d = Math.hypot(toy.position.x - c.position.x, toy.position.y - c.position.y)
        if (d < PLAY.flinch) {
          c.perception.startle = Math.max(c.perception.startle, 0.7)
          showEmote(c, 'exclaim')
        }
      }
    }
  }
}

function squeak(world: World, toy: Prop, c: Creature): void {
  if (world.time - toy.squeakedAt < PLAY.squeakEvery) return
  toy.squeakedAt = world.time
  recordSound(world, 'squee', c.id)
}

function swat(world: World, c: Creature, toy: Prop): void {
  // Close to its body (head or tentacles)?
  const r = TOY.radius[toy.kind as 'duck' | 'ball']
  const near = bodyCircles(c).find(
    ([cx, cy, cr]) =>
      Math.hypot(toy.position.x - cx, toy.position.y - cy) < cr + r + c.size * PLAY.swatRange,
  )
  if (!near) return
  const dx = toy.position.x - near[0]
  const dy = toy.position.y - near[1]
  const d = Math.hypot(dx, dy)
  if (d < 1e-6) return
  if (world.time - c.mind.swattedAt < PLAY.swatEvery) return
  c.mind.swattedAt = world.time
  toy.velocity.x = (dx / d) * PLAY.swatSpeed
  // A swatted ball is launched up and away.
  toy.velocity.y = (dy / d) * PLAY.swatSpeed - (toy.kind === 'ball' ? PLAY.ballLift * 1.5 : 0)
  toy.spin += 8
  showEmote(c, 'anger')
  if (toy.kind === 'duck') squeak(world, toy, c)
}
