import { BODY, type Creature } from '../simulation/creature'
import { hash2 } from './noise'

/**
 * Draws one "little octopus" (style B) at (x, y) — the interpolated mantle center.
 * Pure function of the creature's data: reads it, never mutates it. Shape details come from
 * id/hue/size/tentacleCount; motion (breathing, sway, blinking) from `creature.anim`.
 */
export function drawCreature(
  ctx: CanvasRenderingContext2D,
  creature: Creature,
  x: number,
  y: number,
): void {
  const { id, hue, size, anim } = creature
  // Breathing as gentle squash & stretch: taller ±3%, wider ±2%, slightly out of phase.
  const rx = size * (1 + BREATH.width * Math.sin(anim.breathPhase - BREATH.widthLag))
  const ry = size * BODY.mantleHalfHeight * (1 + BREATH.height * Math.sin(anim.breathPhase))
  const colors = {
    tentacle: `hsl(${hue} 40% 60%)`,
    fuzz: `hsl(${hue} 42% 64%)`,
    body: `hsl(${hue} 55% 74%)`,
    highlight: `hsl(${hue} 70% 85%)`,
  }

  drawTentacles(ctx, creature, x, y, colors.tentacle)
  drawFuzz(ctx, id, x, y, rx, ry, size, colors.fuzz)

  // Mantle with soft shading: a radial gradient lit from the upper left.
  const shade = ctx.createRadialGradient(x - rx * 0.35, y - ry * 0.45, size * 0.2, x, y, ry * 1.15)
  shade.addColorStop(0, colors.highlight)
  shade.addColorStop(1, colors.body)
  ctx.fillStyle = shade
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()

  drawEyes(ctx, x, y + size * 0.35, size, anim.eyeOpenness)
}

/** Motion amplitudes — kept subtle so creatures read as calm, not jittery. */
const BREATH = { height: 0.03, width: 0.02, widthLag: 0.8 } as const
const SWAY = {
  /** Sideways swing at the tip, as a multiple of size; control points swing less (root moves least). */
  amplitude: 0.35,
  /** Phase offset between neighboring tentacles, so they don't move in lockstep. */
  spread: 0.9,
  /** Phase lag per segment along the tentacle → the motion travels from root to tip. */
  lag: 0.9,
} as const

function drawTentacles(
  ctx: CanvasRenderingContext2D,
  creature: Creature,
  x: number,
  y: number,
  color: string,
): void {
  const { id, size, tentacleCount: n, anim } = creature
  ctx.fillStyle = color
  for (let i = 0; i < n; i++) {
    const s = n === 1 ? 0 : (i / (n - 1)) * 2 - 1 // -1 (left) .. 1 (right)
    const length = size * BODY.tentacleLength * (0.85 + hash2(id, i) * 0.3)
    const wave = (i % 2 === 0 ? -1 : 1) * size * (0.4 + hash2(id, i + 50) * 0.3)
    const rootX = x + s * size * 0.75
    const rootY = y + size * BODY.tentacleRootY

    // Traveling wave: each point further along lags in phase, so the swing runs root → tip.
    const phase = anim.swayPhase + i * SWAY.spread
    const swing = size * SWAY.amplitude
    const sway1 = swing * 0.35 * Math.sin(phase)
    const sway2 = swing * 0.7 * Math.sin(phase - SWAY.lag)
    const sway3 = swing * Math.sin(phase - SWAY.lag * 2)

    // Cubic Bézier: fan outward, with an S-shaped wave plus the sway.
    taperedCurve(
      ctx,
      [rootX, rootY],
      [rootX + s * size * 0.6 + wave + sway1, rootY + length * 0.33],
      [rootX + s * size * 0.9 - wave + sway2, rootY + length * 0.66],
      [rootX + s * size * 1.3 + wave * 0.5 + sway3, rootY + length],
      size * 0.36,
      size * 0.08,
    )
  }
}

type Point = readonly [number, number]

/**
 * Fills a shape along a cubic Bézier whose width tapers from `startWidth` to `endWidth`,
 * with a rounded tip. Built by offsetting sampled curve points along the curve's normal.
 */
function taperedCurve(
  ctx: CanvasRenderingContext2D,
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  startWidth: number,
  endWidth: number,
): void {
  const SAMPLES = 16
  const left: Point[] = []
  const right: Point[] = []
  let tipAngle = 0

  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES
    const u = 1 - t
    // Position on the curve.
    const px = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0]
    const py = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]
    // Tangent (derivative) → unit normal.
    const dx =
      3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0])
    const dy =
      3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1])
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len
    const ny = dx / len
    const half = (startWidth + (endWidth - startWidth) * t) / 2
    left.push([px + nx * half, py + ny * half])
    right.push([px - nx * half, py - ny * half])
    if (i === SAMPLES) tipAngle = Math.atan2(dy, dx)
  }

  ctx.beginPath()
  ctx.moveTo(left[0]![0], left[0]![1])
  for (const [px, py] of left) ctx.lineTo(px, py)
  // Rounded tip: half circle from the left edge, around the front, to the right edge.
  ctx.arc(p3[0], p3[1], endWidth / 2, tipAngle + Math.PI / 2, tipAngle - Math.PI / 2, true)
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i]![0], right[i]![1])
  ctx.closePath()
  ctx.fill()
}

/** Short strands poking out around the mantle edge — one batched path per creature. */
function drawFuzz(
  ctx: CanvasRenderingContext2D,
  id: number,
  x: number,
  y: number,
  rx: number,
  ry: number,
  size: number,
  color: string,
): void {
  const strands = Math.round(size * 2.2)
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1.2, size * 0.05)
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (let i = 0; i < strands; i++) {
    const angle = (i / strands) * Math.PI * 2 + hash2(id, i + 100) * 0.1
    const length = size * (0.08 + hash2(id, i + 200) * 0.1)
    const tilt = (hash2(id, i + 300) - 0.5) * 0.6
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const ex = x + cos * rx
    const ey = y + sin * ry
    ctx.moveTo(ex - cos * size * 0.1, ey - sin * size * 0.1)
    ctx.lineTo(ex + Math.cos(angle + tilt) * length, ey + Math.sin(angle + tilt) * length)
  }
  ctx.stroke()
}

/** Below this openness the eye is drawn as a closed lid (a curved line) instead. */
const CLOSED_EYE = 0.15

function drawEyes(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  openness: number,
): void {
  const gap = size * 0.36
  const r = size * 0.24
  const pupil = size * 0.13
  for (const side of [-1, 1]) {
    const ex = cx + side * gap

    if (openness < CLOSED_EYE) {
      // Closed: a gentle downward-curved lid line.
      ctx.strokeStyle = '#1b1530'
      ctx.lineWidth = Math.max(1.5, size * 0.06)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.arc(ex, cy - r * 0.6, r, Math.PI * 0.2, Math.PI * 0.8)
      ctx.stroke()
      continue
    }

    // Open (or partly open): the eye white squashes vertically; pupil and highlight are clipped to it.
    const eyeRy = r * 1.12 * openness
    ctx.save()
    ctx.beginPath()
    ctx.ellipse(ex, cy, r, eyeRy, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#fffdf8'
    ctx.fill()
    ctx.clip()

    ctx.fillStyle = '#1b1530'
    ctx.beginPath()
    ctx.arc(ex, cy + r * 0.12, pupil, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(ex - pupil * 0.35, cy - pupil * 0.2, pupil * 0.32, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}
