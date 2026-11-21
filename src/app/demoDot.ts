// TEMPORARY (task #2): proves the loop, interpolation and stage work. Delete in task #4.
import { lerp } from '../simulation/math'

export interface DemoDot {
  x: number
  y: number
  prevX: number
  prevY: number
  vx: number
  vy: number
  radius: number
}

export function createDemoDot(): DemoDot {
  return { x: 120, y: 120, prevX: 120, prevY: 120, vx: 220, vy: 160, radius: 18 }
}

/** Advance one fixed step and bounce off the edges. */
export function stepDemoDot(dot: DemoDot, dt: number, width: number, height: number): void {
  dot.prevX = dot.x
  dot.prevY = dot.y
  dot.x += dot.vx * dt
  dot.y += dot.vy * dt

  if (dot.x < dot.radius || dot.x > width - dot.radius) {
    dot.vx = -dot.vx
    dot.x = Math.min(Math.max(dot.x, dot.radius), width - dot.radius)
  }
  if (dot.y < dot.radius || dot.y > height - dot.radius) {
    dot.vy = -dot.vy
    dot.y = Math.min(Math.max(dot.y, dot.radius), height - dot.radius)
  }
}

/** Draw at the interpolated position between the previous and current step. */
export function drawDemoDot(ctx: CanvasRenderingContext2D, dot: DemoDot, alpha: number): void {
  const x = lerp(dot.prevX, dot.x, alpha)
  const y = lerp(dot.prevY, dot.y, alpha)
  ctx.beginPath()
  ctx.arc(x, y, dot.radius, 0, Math.PI * 2)
  ctx.fillStyle = '#f2a7c3'
  ctx.fill()
}
