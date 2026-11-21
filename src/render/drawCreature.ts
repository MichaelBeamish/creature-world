import { BODY, type Creature } from '../simulation/creature'
import { MOVEMENT } from '../simulation/movement'
import { FULL_MOTION, type MotionSettings } from './motion'
import { hash2 } from './noise'

/**
 * Draws one "little octopus" (style B) at (screenX, screenY) — the interpolated mantle center.
 * Pure function of the creature's data: reads it, never mutates it. Shape details come from
 * id/hue/size/tentacleCount; motion (breathing, sway, blinking) from `creature.anim`;
 * lean and tentacle trailing from `creature.velocity`; mood (puff, flush, bristles, eyes, blush)
 * from the smoothed emotion levels — so every change of mood blends in and out continuously.
 */
export function drawCreature(
  ctx: CanvasRenderingContext2D,
  creature: Creature,
  screenX: number,
  screenY: number,
  motion: MotionSettings = FULL_MOTION,
): void {
  const { id, size, anim, velocity } = creature
  const mood = creature.mind.emotion.levels
  const scared = mood.scared
  const grumpy = mood.grumpy

  // Puff up when grumpy, shrink a little when scared; stretch along a fast dart (squash & stretch).
  const puff = 1 + MOOD.puff * grumpy - MOOD.shrink * scared
  const fast = MOVEMENT.baseSpeed * 2
  const stretchX = 1 + MOOD.stretch * Math.min(1, Math.abs(velocity.x) / fast)
  const stretchY = 1 + MOOD.stretch * Math.min(1, Math.abs(velocity.y) / fast)
  // Breathing as gentle squash & stretch: taller ±3%, wider ±2%, slightly out of phase.
  const rx =
    size *
    puff *
    stretchX *
    (1 + BREATH.width * motion.breath * Math.sin(anim.breathPhase - BREATH.widthLag))
  const ry =
    size *
    puff *
    stretchY *
    BODY.mantleHalfHeight *
    (1 + BREATH.height * motion.breath * Math.sin(anim.breathPhase))

  // Grumpy flushes toward red; scared goes pale.
  const hue = mixHue(creature.hue, 2, grumpy * MOOD.flush)
  const sat = (base: number) => base + 20 * grumpy - 15 * scared
  const light = (base: number) => base - 6 * grumpy + 6 * scared
  const colors = {
    tentacle: `hsl(${hue} ${sat(40)}% ${light(60)}%)`,
    fuzz: `hsl(${hue} ${sat(42)}% ${light(64)}%)`,
    body: `hsl(${hue} ${sat(55)}% ${light(74)}%)`,
    highlight: `hsl(${hue} ${sat(70)}% ${light(85)}%)`,
  }

  // Lean into the direction of travel (up to ~8°), rotating around the mantle center.
  // Everything below is drawn in this local frame, with the mantle center at (0, 0).
  const leanAmount = Math.max(-1, Math.min(1, velocity.x / MOVEMENT.baseSpeed))
  ctx.save()
  ctx.translate(screenX, screenY)
  ctx.rotate(leanAmount * MOTION.maxLean * motion.lean)
  const x = 0
  const y = 0

  drawTentacles(ctx, creature, x, y, colors.tentacle, motion)
  // Fur bristles (stands on end) when scared or grumpy.
  const bristle = 1 + MOOD.bristle * Math.max(scared, grumpy)
  drawFuzz(ctx, id, x, y, rx, ry, size, colors.fuzz, bristle)

  // Mantle with soft shading: a radial gradient lit from the upper left.
  const shade = ctx.createRadialGradient(x - rx * 0.35, y - ry * 0.45, size * 0.2, x, y, ry * 1.15)
  shade.addColorStop(0, colors.highlight)
  shade.addColorStop(1, colors.body)
  ctx.fillStyle = shade
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()

  const eyeY = y + size * 0.35
  drawBlush(ctx, x, eyeY, size, affection(creature))
  drawEyes(ctx, x, eyeY, size, anim.eyeOpenness, {
    gaze: creature.expression.gaze,
    scared,
    grumpy,
    curious: mood.curious,
    lidColor: colors.body,
  })
  ctx.restore()
}

/** Mood → body language (multiples of size, or 0..1 blends). */
const MOOD = {
  puff: 0.12,
  shrink: 0.06,
  stretch: 0.1,
  /** How far grumpy pulls the hue toward red (0..1). */
  flush: 0.6,
  /** Extra fur length when bristling (1 + this × mood). */
  bristle: 1.6,
} as const

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
/** Secondary motion while swimming. */
const MOTION = {
  /** Maximum body lean in radians (~8°) at top speed. */
  maxLean: 0.14,
  /** Tentacle tips trail behind by velocity × this many seconds (roots trail least). */
  trailSeconds: 0.45,
} as const

/** Blend hue `from` toward `to` by t (0..1), the short way around the color wheel. */
function mixHue(from: number, to: number, t: number): number {
  const delta = ((to - from + 540) % 360) - 180
  return (from + delta * t + 360) % 360
}

/** 0..1 — a bold, curious creature with a trusted visitor close by blushes. */
function affection(creature: Creature): number {
  if (creature.traits.boldness < 0.5) return 0
  const closeness = Math.max(0, 1 - creature.perception.distance / 160)
  return creature.mind.emotion.levels.curious * creature.perception.trust * closeness
}

function drawTentacles(
  ctx: CanvasRenderingContext2D,
  creature: Creature,
  x: number,
  y: number,
  color: string,
  motion: MotionSettings,
): void {
  const { id, size, tentacleCount: n, anim, velocity } = creature
  // Trailing: tentacles lag behind the motion (follow-through), more toward the tips.
  const trailX = -velocity.x * MOTION.trailSeconds * motion.trail
  const trailY = -velocity.y * MOTION.trailSeconds * motion.trail
  ctx.fillStyle = color
  for (let i = 0; i < n; i++) {
    const s = n === 1 ? 0 : (i / (n - 1)) * 2 - 1 // -1 (left) .. 1 (right)
    const length = size * BODY.tentacleLength * (0.85 + hash2(id, i) * 0.3)
    const wave = (i % 2 === 0 ? -1 : 1) * size * (0.4 + hash2(id, i + 50) * 0.3)
    const rootX = x + s * size * 0.75
    const rootY = y + size * BODY.tentacleRootY

    // Traveling wave: each point further along lags in phase, so the swing runs root → tip.
    const phase = anim.swayPhase + i * SWAY.spread
    const swing = size * SWAY.amplitude * motion.sway
    const sway1 = swing * 0.35 * Math.sin(phase)
    const sway2 = swing * 0.7 * Math.sin(phase - SWAY.lag)
    const sway3 = swing * Math.sin(phase - SWAY.lag * 2)

    // Cubic Bézier: fan outward, with an S-shaped wave plus the sway.
    taperedCurve(
      ctx,
      [rootX, rootY],
      [rootX + s * size * 0.6 + wave + sway1 + trailX * 0.3, rootY + length * 0.33 + trailY * 0.3],
      [
        rootX + s * size * 0.9 - wave + sway2 + trailX * 0.65,
        rootY + length * 0.66 + trailY * 0.65,
      ],
      [rootX + s * size * 1.3 + wave * 0.5 + sway3 + trailX, rootY + length + trailY],
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
  bristle: number,
): void {
  const strands = Math.round(size * 2.2)
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1.2, size * 0.05)
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (let i = 0; i < strands; i++) {
    const angle = (i / strands) * Math.PI * 2 + hash2(id, i + 100) * 0.1
    const length = size * (0.08 + hash2(id, i + 200) * 0.1) * bristle
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

interface EyeMood {
  /** Where the eyes look (length 0..1). */
  gaze: { x: number; y: number }
  scared: number
  grumpy: number
  curious: number
  /** Body color, used for the grumpy half-lid. */
  lidColor: string
}

function drawEyes(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  openness: number,
  mood: EyeMood,
): void {
  const gap = size * 0.36
  // Scared: wide eyes with tiny pupils. Curious: bigger pupils.
  const r = size * 0.24 * (1 + 0.25 * mood.scared)
  const pupil = size * 0.13 * (1 - 0.45 * mood.scared + 0.25 * mood.curious)
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

    // Open (or partly open): the eye white squashes vertically; pupil, highlight and lid are clipped to it.
    const eyeRy = r * 1.12 * openness
    ctx.save()
    ctx.beginPath()
    ctx.ellipse(ex, cy, r, eyeRy, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#fffdf8'
    ctx.fill()
    ctx.clip()

    // Pupils look along the gaze, staying inside the eye.
    const reach = (r - pupil) * 0.85
    const px = ex + mood.gaze.x * reach
    const py = cy + r * 0.12 + mood.gaze.y * reach * 0.8
    ctx.fillStyle = '#1b1530'
    ctx.beginPath()
    ctx.arc(px, py, pupil, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(px - pupil * 0.35, py - pupil * 0.2, pupil * 0.32, 0, Math.PI * 2)
    ctx.fill()

    // Grumpy: a slanted half-lid, lower toward the middle of the face — a glare.
    if (mood.grumpy > 0.05) {
      const top = cy - eyeRy - 1
      const inner = top + eyeRy * 2 * 0.62 * mood.grumpy
      const outer = top + eyeRy * 2 * 0.25 * mood.grumpy
      ctx.fillStyle = mood.lidColor
      ctx.beginPath()
      ctx.moveTo(ex - side * (r + 1), top)
      ctx.lineTo(ex + side * (r + 1), top)
      ctx.lineTo(ex + side * (r + 1), outer)
      ctx.lineTo(ex - side * (r + 1), inner)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
  }
}

/** Soft pink cheeks below the eyes (affection). */
function drawBlush(
  ctx: CanvasRenderingContext2D,
  cx: number,
  eyeY: number,
  size: number,
  amount: number,
): void {
  if (amount < 0.02) return
  ctx.save()
  ctx.globalAlpha = Math.min(1, amount) * 0.55
  ctx.fillStyle = 'hsl(345 85% 72%)'
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(
      cx + side * size * 0.62,
      eyeY + size * 0.3,
      size * 0.17,
      size * 0.09,
      0,
      0,
      Math.PI * 2,
    )
    ctx.fill()
  }
  ctx.restore()
}
