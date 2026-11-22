/**
 * Draws ink clouds (task #21): each puff is a soft deep-indigo blob (a radial gradient that fades to transparent),
 * so overlapping puffs build a dense core that thins at the edges — a smoke screen. Positions come from the
 * analytic `inkPuffAt`. Pure function of the world: reads state, never mutates it.
 */
import { inkPuffAt } from '../simulation/ink'
import type { World } from '../simulation/world'
import type { MotionSettings } from './motion'

/** Deep indigo (r, g, b): dark enough to hide a creature, blue enough to stay gentle in the moonlit water. */
const INK_RGB = '34, 22, 78'

export function drawInk(ctx: CanvasRenderingContext2D, world: World, motion: MotionSettings): void {
  ctx.save()
  for (const p of world.ink.pool) {
    if (!p.active) continue
    const s = inkPuffAt(p, world.time, motion.inkDrift)
    if (s.state !== 'spreading' || s.opacity <= 0.01) continue
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.radius)
    g.addColorStop(0, `rgba(${INK_RGB}, ${s.opacity})`)
    g.addColorStop(0.55, `rgba(${INK_RGB}, ${s.opacity * 0.6})`)
    g.addColorStop(1, `rgba(${INK_RGB}, 0)`)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}
