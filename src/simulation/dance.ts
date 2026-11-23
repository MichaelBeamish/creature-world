/**
 * Dancing at the party (task #32d): a mind layer. While the party is on, calm creatures dance — each in its own
 * style, by the same trait dials as food and play — and the Grumpy sulks in the bottom-right corner.
 *
 * - **bounce** (bold + curious, the Friendly): on the dance floor under the disco ball; big hops, spins in the drops.
 * - **sway** (timid + curious, the Peeker): starts at the edge of the floor and edges closer over the song.
 * - **shy** (timid + incurious, the Scaredy): at the edge, small wiggles — braver (closer, bigger) over a minute.
 * - **sulk** (bold + incurious, the Grumpy): the bottom-right corner, 💢 now and then (and a secret toe-tap — drawn).
 *
 * How hard they dance follows the song's energy (`partyMoment`): small bobs in the intro and builds, all-out in the
 * drops. The simulation decides *where* and *how much*; the renderer draws the moves on the beat (`danceMoves`).
 */
import type { Creature } from './creature'
import { showEmote } from './expression'
import type { IntentKind } from './mindState'
import { partyMoment } from './party'
import { DISCO, discoRadius } from './props'
import { range } from './rng'
import { swimBounds } from './scenery'
import type { Vec2 } from './vec2'
import type { World } from './world'

export type DanceStyle = 'bounce' | 'sway' | 'shy' | 'sulk'

export const DANCE = {
  /** The party must have faded in this far before anyone dances. */
  startLevel: 0.2,
  /** Each creature notices the party this long (s) after it starts (staggered by id). */
  notice: [0.5, 2],
  /** The dance floor: its center (fraction of the swim area's height), and how far out each style dances (px). */
  floorY: 0.55,
  bounceRing: 90,
  /** The Peeker starts this far out and edges in to `swayTo` over `swaySeconds`. */
  swayFrom: 360,
  swayTo: 160,
  swaySeconds: 90,
  /** The Scaredy: starts far out, braver (closer, bigger moves) over `braveSeconds`. */
  shyFrom: 420,
  shyTo: 220,
  braveSeconds: 60,
  /** The timid dancers (Peeker, Scaredy) never dance closer than this (px) to the disco ball itself. */
  ballClear: 200,
  /** In the drops, dancers step this far (px) to the other side every 2 bars. */
  sidestep: 40,
  /** The Grumpy's corner: this far (px) in from the bottom-right of the swim area. */
  corner: { right: 110, bottom: 90 },
  /** Seconds between happy chirps (calm parts / drops), and between the Grumpy's 💢. */
  cheerEvery: [5, 10],
  cheerEveryDrop: [2.5, 5],
  sulkEvery: [7, 12],
  /** How hard each style dances at full energy. The Scaredy grows from `shyAmount[0]` to `[1]` as it gets braver. */
  amount: { bounce: 1, sway: 0.8, shy: 0.4, sulk: 0 },
  shyAmount: [0.35, 0.8],
  /** Swim-speed multiplier on the way to its spot. */
  speed: 1.8,
} as const

/** This creature's dance style — by its trait dials (not its name). */
export function danceStyle(c: Creature): DanceStyle {
  const bold = c.traits.boldness >= 0.5
  const curious = c.traits.curiosity >= 0.5
  if (bold) return curious ? 'bounce' : 'sulk'
  return curious ? 'sway' : 'shy'
}

/** 0..1 — how brave a timid dancer has become (time at the party / the time it takes). */
function bravery(c: Creature, world: World, seconds: number): number {
  const since = c.mind.dance?.since ?? world.time
  return Math.min(1, Math.max(0, (world.time - since) / seconds))
}

/**
 * Decide whether to dance (or sulk) this step — called by the mind after food. Shows the noticing emote, the happy
 * chirps and the Grumpy's 💢 on their cues, and updates how hard it dances. Returns 'dance' / 'sulk', or null.
 */
export function chooseDance(c: Creature, world: World): IntentKind | null {
  const party = world.party
  const mind = c.mind
  if (!party.on || party.level < DANCE.startLevel) {
    mind.dance = null
    return null
  }
  if (mind.emotion.kind === 'scared') return null // a fright still wins
  const style = danceStyle(c)
  const rng = world.rng
  if (!mind.dance) {
    mind.dance = {
      since: world.time,
      noticeAt:
        world.time + DANCE.notice[0] + ((c.id * 0.37) % 1) * (DANCE.notice[1] - DANCE.notice[0]),
      noticed: false,
      cueAt: Infinity,
      amount: 0,
    }
  }
  const d = mind.dance
  const m = partyMoment(world)

  if (!d.noticed && world.time >= d.noticeAt) {
    d.noticed = true
    showEmote(
      c,
      style === 'sulk'
        ? 'anger'
        : style === 'bounce'
          ? 'heart'
          : style === 'sway'
            ? 'question'
            : 'exclaim',
    )
    d.cueAt = world.time + range(rng, 2, 4)
  }
  if (d.noticed && world.time >= d.cueAt) {
    if (style === 'sulk') {
      showEmote(c, 'anger')
      d.cueAt = world.time + range(rng, DANCE.sulkEvery[0], DANCE.sulkEvery[1])
    } else {
      showEmote(c, style === 'bounce' ? 'heart' : 'exclaim')
      const every = m.section === 'drop' ? DANCE.cheerEveryDrop : DANCE.cheerEvery
      d.cueAt = world.time + range(rng, every[0], every[1])
    }
  }

  const base =
    style === 'shy'
      ? DANCE.shyAmount[0] +
        (DANCE.shyAmount[1] - DANCE.shyAmount[0]) * bravery(c, world, DANCE.braveSeconds)
      : DANCE.amount[style]
  // Small in the intro and builds, all-out in the drops (energy^1.5 keeps the builds modest).
  d.amount = d.noticed ? base * Math.pow(m.energy, 1.5) : 0
  return style === 'sulk' ? 'sulk' : 'dance'
}

/** Where this creature dances (or sulks) right now (px). */
export function danceTarget(world: World, c: Creature, out: Vec2): Vec2 {
  const bounds = swimBounds(world)
  const style = danceStyle(c)
  if (style === 'sulk') {
    out.x = bounds.width - DANCE.corner.right
    out.y = bounds.height - DANCE.corner.bottom
    return out
  }
  const ball = world.props.items.find((p) => p.kind === 'discoBall')
  const cx = ball ? ball.position.x : world.width / 2
  const cy = bounds.height * DANCE.floorY
  const radius =
    style === 'bounce'
      ? DANCE.bounceRing
      : style === 'sway'
        ? DANCE.swayFrom + (DANCE.swayTo - DANCE.swayFrom) * bravery(c, world, DANCE.swaySeconds)
        : DANCE.shyFrom + (DANCE.shyTo - DANCE.shyFrom) * bravery(c, world, DANCE.braveSeconds)
  const angle = c.id * 2.399 // spread round the floor
  const m = partyMoment(world)
  const side = Math.floor(m.beats / 8 + c.id) % 2 === 0 ? 1 : -1
  out.x = cx + Math.cos(angle) * radius + side * DANCE.sidestep * m.pulseAmount
  out.y = cy + Math.sin(angle) * radius * 0.4
  // A timid dancer keeps its distance from the ball itself (however the floor and the sidestep fall).
  if (style !== 'bounce' && ball) {
    const dx = out.x - ball.position.x
    const dy = out.y - ball.position.y
    const d = Math.hypot(dx, dy) || 1
    if (d < DANCE.ballClear) {
      out.x = ball.position.x + (dx / d) * DANCE.ballClear
      out.y = ball.position.y + (dy / d) * DANCE.ballClear
    }
  }
  const margin = 60
  out.x = Math.max(margin, Math.min(bounds.width - margin, out.x))
  out.y = Math.max(DISCO.hangY + discoRadius(world) + 70, Math.min(bounds.height - margin, out.y))
  return out
}
