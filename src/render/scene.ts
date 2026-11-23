import { lerp } from '../simulation/math'
import { aimAtHand, dizziness, stressFraction } from '../simulation/interaction'
import type { World } from '../simulation/world'
import { drawBackground, drawVignette } from './background'
import { drawBubbles } from './bubbles'
import { drawChest, drawChestItems } from './chest'
import { drawCreature } from './drawCreature'
import { drawPerceptionDebug } from './debugDraw'
import { drawEmotes } from './emotes'
import { drawFloor } from './floor'
import { drawInk } from './ink'
import { drawProps } from './props'
import { drawPartyBackdrop, drawPartyLights } from './party'
import { danceStyle } from '../simulation/dance'
import { beatsAt } from '../simulation/party'
import { FULL_MOTION, type MotionSettings } from './motion'

export interface SceneOptions {
  /** Dev-only perception view (`?debug`). */
  debug?: boolean
  /** Decorative motion (toned down when the user prefers reduced motion). */
  motion?: MotionSettings
}

/**
 * Draws the whole world for one frame. Reads the world, never mutates it.
 * `alpha` (from the fixed-step loop) interpolates each creature between its last two positions.
 */
export function drawScene(
  ctx: CanvasRenderingContext2D,
  world: World,
  alpha: number,
  width: number,
  height: number,
  options: SceneOptions = {},
): void {
  const motion = options.motion ?? FULL_MOTION

  drawBackground(ctx, width, height, world.time, motion)
  drawFloor(ctx, world, width, height, motion)
  drawChest(ctx, world) // on the sand, behind the creatures
  drawProps(ctx, world, motion) // shrimp sinking / lying on the sand
  drawPartyBackdrop(ctx, world, width, height, motion) // the party dims the pool; the neon reef glows behind everyone

  // Painter's algorithm: draw back-to-front, so creatures lower on screen appear in front.
  const ordered = [...world.creatures].sort((a, b) => a.position.y - b.position.y)
  const hold = world.interaction.hold
  const hand = world.presence.position
  // Ink is a smoke screen in front of the creatures — except a chasing Grumpy, which charges out of its own cloud
  // (drawn after the ink, so its firing tentacles stay visible).
  const charging = world.interaction.chase?.creatureId
  const draw = (creature: World['creatures'][number]) => {
    const x = lerp(creature.prevPosition.x, creature.position.x, alpha)
    const y = lerp(creature.prevPosition.y, creature.position.y, alpha)
    const held =
      hold?.creatureId === creature.id
        ? {
            hand: { x: hand.x - x, y: hand.y - y },
            part: hold.part,
            stress: stressFraction(world, creature),
          }
        : null
    drawCreature(ctx, creature, x, y, motion, {
      held,
      dizzy: dizziness(world, creature),
      aim: { amount: aimAtHand(world, creature), hand: { x: hand.x - x, y: hand.y - y } },
      time: world.time,
      dance:
        creature.mind.dance && (creature.mind.intent === 'dance' || creature.mind.intent === 'sulk')
          ? {
              style: danceStyle(creature),
              amount: creature.mind.dance.amount,
              beats: beatsAt(world),
            }
          : null,
    })
  }
  for (const creature of ordered) if (creature.id !== charging) draw(creature)
  drawInk(ctx, world, motion) // in front of the creatures: a smoke screen
  for (const creature of ordered) if (creature.id === charging) draw(creature)
  drawBubbles(ctx, world, motion)
  drawPartyLights(ctx, world, width, height, motion) // beams, light spots, rays and the disco ball on top
  drawChestItems(ctx, world, motion) // the open chest's items + the one being carried, above everything else
  drawEmotes(ctx, world, alpha, motion)
  drawVignette(ctx, width, height)
  if (options.debug) drawPerceptionDebug(ctx, world, alpha)
}
