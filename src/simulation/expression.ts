/**
 * Expression: how a creature *shows* what it feels — where its eyes look, which emote pops up,
 * and how its breathing/sway speed follows its mood.
 *
 * Events and timing live here (deterministic, testable); the renderer turns them into pixels.
 */
import type { Creature } from './creature'
import type { EmotionKind } from './emotion'
import { range } from './rng'
import { vec2, type Vec2 } from './vec2'
import type { World } from './world'

export type EmoteKind = 'question' | 'exclaim' | 'anger' | 'heart'

export interface Emote {
  kind: EmoteKind
  /** Seconds since it appeared. */
  age: number
}

export interface Expression {
  /** Where the eyes look: a direction with length 0..1 (0 = straight ahead, 1 = fully to the side). */
  gaze: Vec2
  /** The direction the eyes are currently fixated on; `gaze` darts toward it. */
  fixation: Vec2
  /** Seconds until the eyes may jump to a new fixation (saccade-like dart-and-hold). */
  fixationHold: number
  emote: Emote | null
  /** Seconds until another emote may appear. */
  emoteCooldown: number
  /** The emotion we last reacted to (an emote fires when this changes). */
  lastEmotion: EmotionKind
  /** ♥ is given once per visit (reset when the visitor is gone). */
  heartGiven: boolean
  /** Content creatures occasionally look at a neighbour. */
  glance: { targetId: number; timer: number } | null
  /** Seconds until the next possible glance. */
  glanceTimer: number
}

export const EXPRESSION = {
  emoteLife: 1.5,
  emoteCooldown: 2.5,
  /** How long the eyes hold a fixation before they may dart again (s). */
  fixationHold: [0.15, 0.6],
  /** How fast the eyes dart to a new fixation (time constant, s). */
  dartSpeed: 0.04,
  /** Attention needed to look at the visitor. */
  lookAtVisitor: 0.35,
  /** Gaze strengths: how far the pupils move toward each kind of target. */
  gazeStrength: { visitor: 1, glance: 0.8, travel: 0.6 },
  /** Below this speed (px/s), a content creature looks straight ahead. */
  travelSpeed: 5,
  /** Social glances: how often, how long, how far (s, s, px). */
  glanceEvery: [4, 10],
  glanceDuration: [0.8, 1.6],
  glanceRange: 320,
  /** ♥: a bold, curious creature this close (px) to a visitor it trusts this much. */
  heartDistance: 110,
  heartTrust: 0.7,
  /** Attention below this means the visit is over (♥ may be given again next time). */
  visitOver: 0.05,
  /** Mood → animation speed: rate = base × (1 + Σ level × weight). */
  breathBoost: { scared: 1.5, grumpy: 0.8, curious: 0.3 },
  swayBoost: { scared: 0.8, grumpy: 0.3, curious: 0.4 },
} as const

const EMOTE_FOR: Record<EmotionKind, EmoteKind | null> = {
  content: null,
  curious: 'question',
  scared: 'exclaim',
  grumpy: 'anger',
}

export function createExpression(): Expression {
  return {
    gaze: vec2(),
    fixation: vec2(),
    fixationHold: 0,
    emote: null,
    emoteCooldown: 0,
    lastEmotion: 'content',
    heartGiven: false,
    glance: null,
    glanceTimer: EXPRESSION.glanceEvery[0],
  }
}

/** Show an emote right now (e.g. reacting to a boop), resetting the cooldown. */
export function showEmote(creature: Creature, kind: EmoteKind): void {
  creature.expression.emote = { kind, age: 0 }
  creature.expression.emoteCooldown = EXPRESSION.emoteCooldown
}

/** Advance one fixed step (after the mind has decided its emotion). Mutates the creature in place. */
export function stepExpression(creature: Creature, world: World, dt: number): void {
  stepEmotes(creature, dt)
  stepGlance(creature, world, dt)
  stepGaze(creature, world, dt)
  stepMoodRates(creature)
}

function stepEmotes(creature: Creature, dt: number): void {
  const ex = creature.expression
  const { emotion } = creature.mind
  const { perception, traits } = creature

  ex.emoteCooldown = Math.max(0, ex.emoteCooldown - dt)
  if (ex.emote) {
    ex.emote.age += dt
    if (ex.emote.age >= EXPRESSION.emoteLife) ex.emote = null
  }

  if (perception.attention < EXPRESSION.visitOver) ex.heartGiven = false

  let next: EmoteKind | null = null
  if (emotion.kind !== ex.lastEmotion) {
    next = EMOTE_FOR[emotion.kind]
    ex.lastEmotion = emotion.kind
  }
  const affectionate =
    emotion.kind === 'curious' &&
    traits.boldness >= 0.5 &&
    perception.distance < EXPRESSION.heartDistance &&
    perception.trust > EXPRESSION.heartTrust &&
    !ex.heartGiven
  if (!next && affectionate) next = 'heart'

  if (next && ex.emoteCooldown <= 0) {
    ex.emote = { kind: next, age: 0 }
    ex.emoteCooldown = EXPRESSION.emoteCooldown
    if (next === 'heart') ex.heartGiven = true
  }
}

function stepGlance(creature: Creature, world: World, dt: number): void {
  const ex = creature.expression
  if (creature.mind.emotion.kind !== 'content') {
    ex.glance = null
    return
  }
  if (ex.glance) {
    ex.glance.timer -= dt
    if (ex.glance.timer <= 0) ex.glance = null
    return
  }
  ex.glanceTimer -= dt
  if (ex.glanceTimer > 0) return
  ex.glanceTimer = range(world.rng, EXPRESSION.glanceEvery[0], EXPRESSION.glanceEvery[1])

  // Glance at the nearest neighbour in range (deterministic: no randomness in the choice).
  let nearest: Creature | null = null
  let nearestDist: number = EXPRESSION.glanceRange
  for (const other of world.creatures) {
    if (other === creature) continue
    const d = Math.hypot(
      other.position.x - creature.position.x,
      other.position.y - creature.position.y,
    )
    if (d < nearestDist) {
      nearest = other
      nearestDist = d
    }
  }
  if (nearest) {
    ex.glance = {
      targetId: nearest.id,
      timer: range(world.rng, EXPRESSION.glanceDuration[0], EXPRESSION.glanceDuration[1]),
    }
  }
}

function stepGaze(creature: Creature, world: World, dt: number): void {
  const ex = creature.expression
  const target = gazeTarget(creature, world)

  // Saccade-like: hold a fixation for a moment, then dart to the current target.
  ex.fixationHold -= dt
  if (ex.fixationHold <= 0) {
    ex.fixation.x = target.x
    ex.fixation.y = target.y
    ex.fixationHold = range(world.rng, EXPRESSION.fixationHold[0], EXPRESSION.fixationHold[1])
  }
  const blend = 1 - Math.exp(-dt / EXPRESSION.dartSpeed)
  ex.gaze.x += (ex.fixation.x - ex.gaze.x) * blend
  ex.gaze.y += (ex.fixation.y - ex.gaze.y) * blend
}

/** Where the eyes want to look right now (direction × strength). */
function gazeTarget(creature: Creature, world: World): Vec2 {
  const { position } = creature
  const presence = world.presence
  const S = EXPRESSION.gazeStrength

  if (presence.active && creature.perception.attention >= EXPRESSION.lookAtVisitor) {
    return direction(position, presence.position, S.visitor)
  }
  const glance = creature.expression.glance
  if (glance) {
    const other = world.creatures.find((c) => c.id === glance.targetId)
    if (other) return direction(position, other.position, S.glance)
  }
  const v = creature.velocity
  const speed = Math.hypot(v.x, v.y)
  if (speed > EXPRESSION.travelSpeed)
    return vec2((v.x / speed) * S.travel, (v.y / speed) * S.travel)
  return vec2(0, 0)
}

function direction(from: Vec2, to: Vec2, strength: number): Vec2 {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const d = Math.hypot(dx, dy)
  return d === 0 ? vec2(0, 0) : vec2((dx / d) * strength, (dy / d) * strength)
}

/** Breathing and sway speed follow the mood (phase accumulation keeps the change smooth). */
function stepMoodRates(creature: Creature): void {
  const { levels } = creature.mind.emotion
  const { anim } = creature
  const B = EXPRESSION.breathBoost
  const S = EXPRESSION.swayBoost
  anim.breathRate =
    anim.breathBase *
    (1 + levels.scared * B.scared + levels.grumpy * B.grumpy + levels.curious * B.curious)
  anim.swayRate =
    anim.swayBase *
    (1 + levels.scared * S.scared + levels.grumpy * S.grumpy + levels.curious * S.curious)
}
