import { lerp } from '../simulation/math'
import type { World } from '../simulation/world'
import { drawBackground, drawVignette } from './background'
import { drawBubbles } from './bubbles'
import { drawCreature } from './drawCreature'
import { drawPerceptionDebug } from './debugDraw'
import { drawEmotes } from './emotes'
import { drawFloor } from './floor'
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

  // Painter's algorithm: draw back-to-front, so creatures lower on screen appear in front.
  const ordered = [...world.creatures].sort((a, b) => a.position.y - b.position.y)
  const hold = world.interaction.hold
  const hand = world.presence.position
  for (const creature of ordered) {
    const x = lerp(creature.prevPosition.x, creature.position.x, alpha)
    const y = lerp(creature.prevPosition.y, creature.position.y, alpha)
    const held =
      hold?.creatureId === creature.id
        ? { hand: { x: hand.x - x, y: hand.y - y }, part: hold.part }
        : null
    drawCreature(ctx, creature, x, y, motion, held)
  }

  drawBubbles(ctx, world, motion)
  drawEmotes(ctx, world, alpha, motion)
  drawVignette(ctx, width, height)
  if (options.debug) drawPerceptionDebug(ctx, world, alpha)
}
