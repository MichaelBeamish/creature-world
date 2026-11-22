/**
 * Feeding (task #28): how each personality goes for a shrimp — a layer inside the mind, decided from the trait dials
 * (like everything else), only while the creature is calm (content or curious).
 *
 * - **Bold + curious** (the Friendly): races straight to it and eats.
 * - **Timid + curious** (the Peeker): sneaks in — but only while the visitor's hand is away from the food.
 * - **Timid + incurious** (the Scaredy): waits until the hand is far away (or gone) for a moment and nobody else is
 *   at the food, then creeps in.
 * - **Bold + incurious** (the Grumpy): swims over and *guards* it for a few seconds (others keep away), then eats.
 *
 * Eating: the creature hovers above the shrimp and grabs it with its tentacles stretched out (`inReach`) — the
 * shrimp is gone, a ♥, a squish and a "nom" in its own voice.
 */
import type { Creature } from './creature'
import { showEmote } from './expression'
import { INTERACTION, recordSound } from './interaction'
import type { IntentKind } from './mindState'
import { nearestShrimp, removeProp, type Prop } from './props'
import type { Vec2 } from './vec2'
import type { World } from './world'

export const FEEDING = {
  /** Food within this distance (px) is noticed — the whole pool (food smells carry through the water). */
  notice: 2500,
  /** Timid + curious: only while the hand is at least this far (px) from the food. */
  peekerClear: 150,
  /** Timid + incurious: only while the hand is at least this far (px) from the food (or gone) for `scaredyWait` s,
   *  and no other creature is within `crowd` px of it. */
  scaredyClear: 300,
  scaredyWait: 1,
  crowd: 90,
  /** Bold + incurious: guards for this long (s), then eats; others keep away from food it guards. */
  guardSeconds: 3.5,
  /** Eat: aim for a point this far (× size) above the food, so the tentacles drape onto it. Guard: hover here. */
  hover: 2.4,
  guardHover: 2.8,
  /** Swim-speed multipliers while going for food: racing, sneaking, creeping, guarding. */
  speed: { race: 3.5, sneak: 2, creep: 1.8, guard: 2.5 },
  /** In reach to eat: within this far sideways and this far below its center (× size) — tentacles stretched toward
   *  the food (it hovers a margin above the sand, so its resting tentacle zone may not quite reach the floor). */
  reachX: 1.3,
  reachDown: 5.2,
} as const

type Style = 'race' | 'sneak' | 'creep' | 'guard'

/** How this personality goes for food. */
export function feedingStyle(c: Creature): Style {
  const bold = c.traits.boldness >= 0.5
  const curious = c.traits.curiosity >= 0.5
  if (bold) return curious ? 'race' : 'guard'
  return curious ? 'sneak' : 'creep'
}

/** Swim-speed multiplier while going for food (movement uses it for intents 'eat' and 'guard'). */
export function mealSpeed(c: Creature): number {
  return c.mind.intent === 'guard' ? FEEDING.speed.guard : FEEDING.speed[feedingStyle(c)]
}

/** Is this shrimp being guarded by another creature? */
function guardedByOther(world: World, c: Creature, food: Prop): boolean {
  return world.creatures.some(
    (o) => o !== c && o.mind.intent === 'guard' && o.mind.meal?.propId === food.id,
  )
}

/**
 * Decide whether (and how) to go for food this step. Called by the mind after its emotional choice, only when the
 * creature is calm. Returns 'eat' / 'guard', or null to keep the mind's choice. Eats when in reach.
 */
export function chooseMeal(c: Creature, world: World, dt: number): IntentKind | null {
  const food = nearestShrimp(world, c)
  const mind = c.mind
  if (
    !food ||
    Math.hypot(food.position.x - c.position.x, food.position.y - c.position.y) > FEEDING.notice ||
    guardedByOther(world, c, food)
  ) {
    mind.meal = null
    return null
  }
  if (mind.meal?.propId !== food.id) mind.meal = { propId: food.id, timer: 0 }
  const meal = mind.meal

  const hand = world.presence
  const handGap = hand.active
    ? Math.hypot(hand.position.x - food.position.x, hand.position.y - food.position.y)
    : Infinity

  switch (feedingStyle(c)) {
    case 'race':
      break
    case 'sneak':
      if (handGap < FEEDING.peekerClear) return null // waits (and peeks) while the hand is near the food
      break
    case 'creep': {
      const crowded = world.creatures.some(
        (o) =>
          o !== c &&
          Math.hypot(o.position.x - food.position.x, o.position.y - food.position.y) <
            FEEDING.crowd,
      )
      meal.timer = handGap >= FEEDING.scaredyClear && !crowded ? meal.timer + dt : 0
      if (meal.timer < FEEDING.scaredyWait) return null
      break
    }
    case 'guard':
      if (meal.timer === 0) showEmote(c, 'anger') // mine!
      meal.timer += dt
      if (meal.timer < FEEDING.guardSeconds) return 'guard'
      break
  }

  if (inReach(c, food)) {
    eat(world, c, food)
    return null
  }
  return 'eat'
}

/** Where to steer for food: hover above it (eat) or a little higher (guard). */
export function mealTarget(world: World, c: Creature, out: Vec2): Vec2 | null {
  const food = world.props.items.find((p) => p.id === c.mind.meal?.propId)
  if (!food) return null
  const hover = c.mind.intent === 'guard' ? FEEDING.guardHover : FEEDING.hover
  out.x = food.position.x
  out.y = food.position.y - c.size * hover
  return out
}

/** Can it grab this food with its tentacles stretched out? */
export function inReach(c: Creature, food: Prop): boolean {
  const dx = Math.abs(food.position.x - c.position.x)
  const dy = food.position.y - c.position.y
  return (
    dx <= c.size * FEEDING.reachX &&
    dy >= -c.size * FEEDING.reachX &&
    dy <= c.size * FEEDING.reachDown
  )
}

function eat(world: World, c: Creature, food: Prop): void {
  removeProp(world, food.id)
  c.mind.meal = null
  c.anim.squashVel += INTERACTION.boopSquash * 0.7
  showEmote(c, 'heart')
  recordSound(world, 'nom', c.id)
}
