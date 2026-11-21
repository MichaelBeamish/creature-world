import { lerp } from '../simulation/math'
import type { World } from '../simulation/world'
import { drawCreature } from './drawCreature'
import { drawPerceptionDebug } from './debugDraw'

export interface SceneOptions {
  /** Dev-only perception view (`?debug`). */
  debug?: boolean
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
  // Soft "deep water" backdrop: slightly lighter near the surface.
  const water = ctx.createLinearGradient(0, 0, 0, height)
  water.addColorStop(0, '#13384b')
  water.addColorStop(1, '#0b2230')
  ctx.fillStyle = water
  ctx.fillRect(0, 0, width, height)

  // Painter's algorithm: draw back-to-front, so creatures lower on screen appear in front.
  const ordered = [...world.creatures].sort((a, b) => a.position.y - b.position.y)
  for (const creature of ordered) {
    const x = lerp(creature.prevPosition.x, creature.position.x, alpha)
    const y = lerp(creature.prevPosition.y, creature.position.y, alpha)
    drawCreature(ctx, creature, x, y)
  }

  if (options.debug) drawPerceptionDebug(ctx, world, alpha)
}
