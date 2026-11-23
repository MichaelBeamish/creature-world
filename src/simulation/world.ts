import { stepAnimation } from './animation'
import { createBubbles, stepBubbles, type BubbleSystem } from './bubbles'
import { resolveConstraints } from './constraints'
import { stepExpression } from './expression'
import { createCreature, GOLDEN_ANGLE, type Creature } from './creature'
import { ruleMind, type Mind } from './mind'
import { stepMovement } from './movement'
import { stepPerception } from './perception'
import { createPresence, updatePresence, type Presence } from './presence'
import { createRng, range, type Rng } from './rng'
import { createInk, stepInk, type InkSystem } from './ink'
import { resolveToyContacts } from './play'
import { stepWearables } from './wearables'
import { createProps, stepProps, type Props } from './props'
import { createParty, stepParty, type Party } from './party'
import { stepCheerUps } from './cheerUp'
import {
  applyTether,
  createInteraction,
  isHeld,
  stepInteraction,
  type Interaction,
} from './interaction'
import { createScenery, swimBounds, type SceneryItem } from './scenery'
import { dealArchetypes } from './traits'
import { addScaled, copyVec2 } from './vec2'

/** The mind every creature uses (the seam where a future LLM-guided mind would plug in). */
const MIND: Mind = ruleMind

/** The whole simulation state: plain data, so it can be compared, cloned, and snapshotted. */
export interface World {
  /** World size in CSS pixels (matches the canvas). */
  width: number
  height: number
  /** Simulated seconds elapsed. */
  time: number
  /** Number of fixed steps taken. */
  tick: number
  rng: Rng
  creatures: Creature[]
  /** The visitor (cursor/finger). Fed by the app via `setPresenceInput(world.presence, …)`. */
  presence: Presence
  /** Rocks, shells and seaweed on the sea floor (from an independent random stream). */
  scenery: SceneryItem[]
  /** Bubble particles (fixed pool, own random stream). */
  bubbles: BubbleSystem
  /** Boop / grab-and-drag state and its sound events (own random stream). */
  interaction: Interaction
  /** Ink puffs from shaken creatures (fixed pool, own random stream). */
  ink: InkSystem
  /** The treasure chest and the items the visitor brought into the pool (task #28). */
  props: Props
  /** The party while the disco ball is out: on/off, its beat clock, and how far it has faded in (task #32). */
  party: Party
}

export interface WorldConfig {
  seed: number
  width: number
  height: number
  creatureCount: number
}

export function createWorld(config: WorldConfig): World {
  const rng = createRng(config.seed)
  // Creatures spawn in the swimmable area above the sand.
  const bounds = swimBounds({ width: config.width, height: config.height })
  const baseHue = range(rng, 0, 360)
  const archetypes = dealArchetypes(rng, config.creatureCount)
  const creatures: Creature[] = []
  for (let i = 0; i < config.creatureCount; i++) {
    const hue = baseHue + i * GOLDEN_ANGLE
    creatures.push(createCreature(rng, i + 1, bounds, hue, creatures, archetypes[i]))
  }
  return {
    width: config.width,
    height: config.height,
    time: 0,
    tick: 0,
    rng,
    creatures,
    presence: createPresence(),
    scenery: createScenery(config.seed),
    bubbles: createBubbles(config.seed),
    interaction: createInteraction(config.seed),
    ink: createInk(config.seed),
    props: createProps(),
    party: createParty(),
  }
}

/**
 * Advance the world by exactly one fixed step of `dt` seconds. Mutates in place.
 * Order matters (and is fixed, for determinism):
 * presence → interaction → props → perception → mind (emotion, intent) → expression → steering → velocity → position → constraints → animation.
 */
export function stepWorld(world: World, dt: number): void {
  updatePresence(world.presence, dt)
  stepInteraction(world, dt)
  stepWearables(world) // a dressed Grumpy shakes things off
  stepCheerUps(world, dt) // …unless it's the rose (task #38)
  stepProps(world, dt)
  stepParty(world, dt) // the disco ball switches the party on and off
  for (const creature of world.creatures) {
    copyVec2(creature.prevPosition, creature.position)
    stepPerception(
      creature.perception,
      creature.position,
      world.presence,
      dt,
      isHeld(world, creature),
    )
    MIND.think(creature, world, dt)
    stepExpression(creature, world, dt)
    stepMovement(creature, world, dt)
  }
  for (const creature of world.creatures) {
    // Semi-implicit (symplectic) Euler: velocity was updated first, position uses the new velocity.
    // More stable than explicit Euler for steering/springs, at the same cost.
    addScaled(creature.position, creature.velocity, dt)
  }
  applyTether(world, dt) // the held creature never trails the hand by more than the tether
  resolveConstraints(world, dt)
  resolveToyContacts(world) // creatures push toys they touch (and squeak the duck)
  stepBubbles(world, dt)
  stepInk(world)
  for (const creature of world.creatures) {
    stepAnimation(creature.anim, dt, world.rng)
  }
  world.time += dt
  world.tick++
}

/** Update the world bounds (e.g. after a window resize). The next step's constraints pull everyone inside. */
export function resizeWorld(world: World, width: number, height: number): void {
  world.width = width
  world.height = height
}
