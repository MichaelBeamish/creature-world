/**
 * The living tide pool: water gradient, drifting light caustics, floating motes, and a soft vignette.
 *
 * Everything is a pure function of (time, size) — no particle state to store or update. Motes are
 * positioned from a per-index hash plus slow drift over time, wrapped around the screen.
 * With reduced motion, `motion.background` is 0 and the scene holds perfectly still.
 */
import type { MotionSettings } from './motion'
import { hash2 } from './noise'

const MOTE_COUNT = 40
const CAUSTIC_COUNT = 6

export interface Mote {
  x: number
  y: number
  radius: number
  alpha: number
}

/** Where mote `i` is at `time` (s): drifts slowly up and sideways, wrapping around the screen. */
export function motePosition(i: number, time: number, width: number, height: number): Mote {
  const rise = 4 + hash2(i, 1) * 8 // px/s upward
  const sway = 6 + hash2(i, 2) * 10 // px of sideways wobble
  const wobble = 0.15 + hash2(i, 3) * 0.25 // wobbles per second
  const baseX = hash2(i, 4) * width
  const baseY = hash2(i, 5) * height
  const y = (((baseY - rise * time) % height) + height) % height
  const x = (((baseX + sway * Math.sin(time * wobble * Math.PI * 2 + i)) % width) + width) % width
  return { x, y, radius: 0.8 + hash2(i, 6) * 1.7, alpha: 0.12 + hash2(i, 7) * 0.2 }
}

/** Water + caustics + motes. Call before the creatures. */
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  worldTime: number,
  motion: MotionSettings,
): void {
  const t = worldTime * motion.background

  // Deep water: slightly lighter near the surface.
  const water = ctx.createLinearGradient(0, 0, 0, height)
  water.addColorStop(0, '#13384b')
  water.addColorStop(1, '#0b2230')
  ctx.fillStyle = water
  ctx.fillRect(0, 0, width, height)

  // Caustics: a few large, very soft light patches drifting slowly near the surface.
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < CAUSTIC_COUNT; i++) {
    const cx = (hash2(i, 10) + 0.08 * Math.sin(t * 0.07 + i * 1.7)) * width
    const cy = (hash2(i, 11) * 0.55 + 0.05 * Math.sin(t * 0.05 + i)) * height
    const r = (0.18 + hash2(i, 12) * 0.2) * Math.max(width, height)
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    glow.addColorStop(0, 'rgba(120, 200, 210, 0.06)')
    glow.addColorStop(1, 'rgba(120, 200, 210, 0)')
    ctx.fillStyle = glow
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  }
  ctx.restore()

  // Floating motes (plankton / specks), one batched style.
  ctx.fillStyle = '#cfeff0'
  for (let i = 0; i < MOTE_COUNT; i++) {
    const m = motePosition(i, t, width, height)
    ctx.globalAlpha = m.alpha
    ctx.beginPath()
    ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

/** A soft dark vignette at the edges. Call after the creatures so it frames the whole scene. */
export function drawVignette(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const cx = width / 2
  const cy = height / 2
  const r = Math.hypot(cx, cy)
  const vignette = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r)
  vignette.addColorStop(0, 'rgba(4, 14, 20, 0)')
  vignette.addColorStop(1, 'rgba(4, 14, 20, 0.45)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, width, height)
}
