/**
 * Party lights (task #32a): while the disco ball is out, the pool dims, a few soft colored spotlight beams sweep
 * down from the surface, and mirror-ball spots of light drift across everything. The ball itself hangs on top.
 *
 * Light safety (WCAG 2.3.1): nothing flashes — brightness only changes smoothly, at most `LIGHTS.maxFlashHz` times a
 * second (well under 3). Under reduced motion the lights hold still: a calm colored glow.
 */
import { DISCO } from '../simulation/props'
import type { World } from '../simulation/world'
import type { MotionSettings } from './motion'

export const LIGHTS = {
  /** How dark the pool gets (0..1 opacity of the dimming layer). */
  dim: 0.5,
  /** Beam colors and how many mirror-ball spots. */
  colors: ['#ff4fd8', '#3de8ff', '#9b6bff', '#ffd24a'],
  spots: 34,
  /** The fastest any light may brighten and fade (cycles per second) — under the 3 flashes/s limit. */
  maxFlashHz: 0.9,
} as const

/** 0..1 brightness of a twinkling light: a smooth wave no faster than `LIGHTS.maxFlashHz`. */
export function twinkle(time: number, seed: number): number {
  const hz = LIGHTS.maxFlashHz * (0.5 + 0.5 * frac(seed * 0.618)) // each light its own (slow) pace
  return 0.5 + 0.5 * Math.sin((time * hz + frac(seed * 0.371)) * Math.PI * 2)
}

function frac(x: number): number {
  return x - Math.floor(x)
}

/** Dim the pool, then draw the beams, the light spots and the disco ball (if the party is on or fading). */
export function drawParty(
  ctx: CanvasRenderingContext2D,
  world: World,
  width: number,
  height: number,
  motion: MotionSettings,
): void {
  const k = world.party.level
  const ball = world.props.items.find((p) => p.kind === 'discoBall')
  if (k > 0.005) {
    const t = world.time * motion.partyLights
    ctx.save()
    ctx.fillStyle = `rgba(6, 4, 24, ${LIGHTS.dim * k})`
    ctx.fillRect(0, 0, width, height)
    ctx.globalCompositeOperation = 'lighter'
    drawBeams(ctx, width, height, t, k)
    drawSpots(ctx, ball ? ball.position : { x: width / 2, y: DISCO.hangY }, width, height, t, k)
    ctx.restore()
  }
  if (ball) drawDiscoBall(ctx, ball.position.x, ball.position.y, DISCO.radius, ball.angle, 1)
}

/** Soft spotlight beams from the surface, sweeping slowly side to side. */
function drawBeams(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  k: number,
): void {
  const n = LIGHTS.colors.length
  for (let i = 0; i < n; i++) {
    const x = ((i + 0.5) / n) * width
    const angle = Math.sin(t * 0.3 + i * 1.9) * 0.45 // radians from straight down
    const reach = height * 1.15
    const spread = 0.12
    const tipX = x + Math.sin(angle) * reach
    const tipY = Math.cos(angle) * reach
    const g = ctx.createLinearGradient(x, 0, tipX, tipY)
    const color = LIGHTS.colors[i]!
    g.addColorStop(0, withAlpha(color, 0.32 * k))
    g.addColorStop(1, withAlpha(color, 0))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(x - 6, 0)
    ctx.lineTo(x + Math.sin(angle - spread) * reach, Math.cos(angle - spread) * reach)
    ctx.lineTo(x + Math.sin(angle + spread) * reach, Math.cos(angle + spread) * reach)
    ctx.lineTo(x + 6, 0)
    ctx.closePath()
    ctx.fill()
  }
}

/** Mirror-ball spots: little soft lights circling the ball (as it spins) across the whole scene, gently twinkling. */
function drawSpots(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  width: number,
  height: number,
  t: number,
  k: number,
): void {
  const far = Math.hypot(width, height)
  for (let i = 0; i < LIGHTS.spots; i++) {
    const a = i * 2.399 + t * 0.12 // golden-angle spread, turning slowly with the ball
    const r = far * (0.15 + 0.8 * frac(i * 0.618))
    const x = from.x + Math.cos(a) * r
    const y = from.y + Math.abs(Math.sin(a)) * r * 0.75 // spots land below the ball
    if (x < -20 || x > width + 20 || y > height + 20) continue
    const size = 11 + 11 * frac(i * 0.29)
    const b = (0.35 + 0.65 * twinkle(t, i + 1)) * k
    const g = ctx.createRadialGradient(x, y, 0, x, y, size)
    const color = LIGHTS.colors[i % LIGHTS.colors.length]!
    g.addColorStop(0, withAlpha('#ffffff', 0.75 * b))
    g.addColorStop(0.45, withAlpha(color, 0.55 * b))
    g.addColorStop(1, withAlpha(color, 0))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, size, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** A disco ball at (x, y), radius r: mirrored tiles in rows that slide round as it spins, a few glints, a hook. */
export function drawDiscoBall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  spin: number,
  alpha: number,
): void {
  ctx.save()
  ctx.globalAlpha = alpha
  // The hook on top.
  ctx.strokeStyle = '#b9c2cc'
  ctx.lineWidth = Math.max(1.5, r * 0.08)
  ctx.beginPath()
  ctx.arc(x, y - r - r * 0.18, r * 0.16, 0, Math.PI * 2)
  ctx.stroke()
  // The sphere: a grey gradient, then the tiles.
  const body = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r)
  body.addColorStop(0, '#f4f7fa')
  body.addColorStop(1, '#6f7d8c')
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = body
  ctx.fill()
  ctx.save()
  ctx.clip()
  const rows = 7
  for (let row = 0; row < rows; row++) {
    const lat = -Math.PI / 2 + ((row + 0.5) / rows) * Math.PI // −90°..90°
    const ty = y + Math.sin(lat) * r
    const ring = Math.cos(lat) * r // this row's radius
    const cols = 10
    for (let c = 0; c < cols; c++) {
      const lon = spin + (c / cols) * Math.PI * 2 + row * 0.3
      const front = Math.cos(lon)
      if (front <= 0) continue // round the back
      const tx = x + Math.sin(lon) * ring
      const w = Math.max(0.8, (ring * Math.PI * 2 * front) / cols - 1)
      const h = (Math.PI * r) / rows - 1
      const shade = 0.45 + 0.55 * frac(Math.sin((row * 13 + c) * 12.9898) * 43758.5)
      ctx.fillStyle = `rgba(${Math.round(150 + 105 * shade)}, ${Math.round(160 + 95 * shade)}, ${Math.round(175 + 80 * shade)}, 0.9)`
      ctx.fillRect(tx - w / 2, ty - h / 2, w, h)
    }
  }
  ctx.restore()
  // Glints: two soft little stars that come and go slowly (no flashing).
  ctx.globalCompositeOperation = 'lighter'
  for (const [gx, gy, seed] of [
    [-0.4, -0.45, 1],
    [0.35, 0.1, 2],
  ] as const) {
    const b = twinkle(spin * 1.7, seed)
    const s = r * 0.28 * (0.5 + 0.5 * b)
    ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * b})`
    ctx.beginPath()
    ctx.moveTo(x + gx * r, y + gy * r - s)
    ctx.lineTo(x + gx * r + s * 0.2, y + gy * r)
    ctx.lineTo(x + gx * r, y + gy * r + s)
    ctx.lineTo(x + gx * r - s * 0.2, y + gy * r)
    ctx.closePath()
    ctx.moveTo(x + gx * r - s, y + gy * r)
    ctx.lineTo(x + gx * r, y + gy * r - s * 0.2)
    ctx.lineTo(x + gx * r + s, y + gy * r)
    ctx.lineTo(x + gx * r, y + gy * r + s * 0.2)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

/** '#rrggbb' + alpha → 'rgba(…)'. */
function withAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, a))})`
}
