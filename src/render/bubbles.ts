/**
 * Draws live bubbles: a translucent circle with a rim and a highlight; when popping, a quick expanding ring.
 * Pure function of the world: positions come from the analytic `bubbleAt`. Reads state; never mutates it.
 */
import { bubbleAt } from '../simulation/bubbles'
import type { World } from '../simulation/world'
import type { MotionSettings } from './motion'

export function drawBubbles(
  ctx: CanvasRenderingContext2D,
  world: World,
  motion: MotionSettings,
): void {
  ctx.save()
  for (const b of world.bubbles.pool) {
    if (!b.active) continue
    const s = bubbleAt(b, world.time, motion.bubbleWobble)
    if (s.state === 'rising') {
      ctx.globalAlpha = 1
      ctx.fillStyle = 'rgba(200, 235, 245, 0.12)'
      ctx.strokeStyle = 'rgba(200, 235, 245, 0.55)'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      // Little highlight, upper left.
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
      ctx.beginPath()
      ctx.arc(
        s.x - s.radius * 0.35,
        s.y - s.radius * 0.35,
        Math.max(0.8, s.radius * 0.22),
        0,
        Math.PI * 2,
      )
      ctx.fill()
    } else if (s.state === 'popping') {
      // Pop: a thin ring that expands and fades.
      ctx.globalAlpha = 1 - s.popProgress
      ctx.strokeStyle = 'rgba(220, 245, 250, 0.8)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.radius * (1 + s.popProgress * 1.2), 0, Math.PI * 2)
      ctx.stroke()
    }
  }
  ctx.restore()
}
