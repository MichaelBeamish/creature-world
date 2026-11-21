/**
 * Dev-only perception view (enable with `?debug` in the URL). Task #10 extends this into the full debug overlay.
 * Reads the world; never mutates it.
 */
import { lerp } from '../simulation/math'
import { PERCEPTION, type Stimulus } from '../simulation/perception'
import type { World } from '../simulation/world'

const STIMULUS_COLOR: Record<Stimulus, string> = {
  none: '#9fc2c6',
  calm: '#8fe3a8',
  sudden: '#ffd166',
  chasing: '#ff7b7b',
}

export function drawPerceptionDebug(
  ctx: CanvasRenderingContext2D,
  world: World,
  alpha: number,
): void {
  ctx.save()
  ctx.font = '12px ui-monospace, monospace'
  ctx.textAlign = 'center'

  for (const c of world.creatures) {
    const x = lerp(c.prevPosition.x, c.position.x, alpha)
    const y = lerp(c.prevPosition.y, c.position.y, alpha)
    const p = c.perception
    const color = STIMULUS_COLOR[p.stimulus]

    // Perception radius: brighter with attention.
    ctx.globalAlpha = 0.12 + 0.6 * p.attention
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(x, y, PERCEPTION.radius, 0, Math.PI * 2)
    ctx.stroke()

    // Label above the head.
    ctx.globalAlpha = 1
    ctx.fillStyle = color
    const top = y - c.size * 1.6
    ctx.fillText(p.stimulus, x, top - 14)
    ctx.fillStyle = '#e8f4f2'
    ctx.fillText(
      `att ${p.attention.toFixed(2)}  trust ${p.trust.toFixed(2)}  press ${p.pressure.toFixed(2)}`,
      x,
      top,
    )
  }

  // The visitor: a ring at the cursor with its smoothed speed.
  const v = world.presence
  if (v.active) {
    ctx.globalAlpha = 0.9
    ctx.strokeStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(v.position.x, v.position.y, 8, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'left'
    ctx.fillText(`${Math.round(v.speed)} px/s`, v.position.x + 12, v.position.y - 10)
  }
  ctx.restore()
}
