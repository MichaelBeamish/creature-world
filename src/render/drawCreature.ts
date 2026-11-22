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
/** While the visitor holds a creature: where the hand is, relative to the mantle center, and what it holds. */
export interface HeldPose {
  hand: { x: number; y: number }
  part: 'head' | 'tentacle'
}

export function drawCreature(
  ctx: CanvasRenderingContext2D,
  creature: Creature,
  screenX: number,
  screenY: number,
  motion: MotionSettings = FULL_MOTION,
  held: HeldPose | null = null,
): void {
  const { id, size, anim, velocity } = creature
  const mood = creature.mind.emotion.levels
  const scared = mood.scared
  const grumpy = mood.grumpy

  const fast = MOVEMENT.baseSpeed * 2
  // Boop squash: wider and flatter while squished, a little taller on the rebound (volume roughly kept).
  const squash = anim.squash * motion.squash
  const { rx, ry } = mantleRadii(size, scared, grumpy, anim.breathPhase, motion.breath, {
    x:
      (1 + MOOD.stretch * Math.min(1, Math.abs(velocity.x) / fast)) *
      (1 + MOOD.squashWide * squash),
    y:
      (1 + MOOD.stretch * Math.min(1, Math.abs(velocity.y) / fast)) *
      (1 - MOOD.squashFlat * squash),
  })

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
  const lean = leanAmount * MOTION.maxLean * motion.lean
  ctx.rotate(lean)
  const x = 0
  const y = 0

  // The hand in this rotated local frame (only a tentacle grab bends a tentacle to it).
  const hand =
    held?.part === 'tentacle'
      ? {
          x: held.hand.x * Math.cos(lean) + held.hand.y * Math.sin(lean),
          y: -held.hand.x * Math.sin(lean) + held.hand.y * Math.cos(lean),
        }
      : null
  drawTentacles(ctx, creature, x, y, colors.tentacle, motion, held !== null, hand)
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

/**
 * The mantle's half-width/half-height right now: puffed when grumpy, shrunk when scared, breathing
 * (taller ±3%, wider ±2%, slightly out of phase), stretched along a fast dart. Pure — the tentacle-root
 * test uses it to check that roots stay inside even the smallest body.
 */
export function mantleRadii(
  size: number,
  scared: number,
  grumpy: number,
  breathPhase: number,
  breathScale = 1,
  stretch = { x: 1, y: 1 },
): { rx: number; ry: number } {
  const puff = 1 + MOOD.puff * grumpy - MOOD.shrink * scared
  const breathW = 1 + BREATH.width * breathScale * Math.sin(breathPhase - BREATH.widthLag)
  const breathH = 1 + BREATH.height * breathScale * Math.sin(breathPhase)
  return {
    rx: size * puff * stretch.x * breathW,
    ry: size * puff * stretch.y * BODY.mantleHalfHeight * breathH,
  }
}

/** Where tentacles attach (multiples of size): outer roots at ±spread; the height is BODY.tentacleRootY. */
export const TENTACLE_ROOT = {
  /** Tucked in so the rounded root stays inside the body at its smallest (see drawCreature.test.ts). */
  spread: 0.55,
  /** Root width (the tentacle's thickest point); its rounded cap has radius width / 2. */
  width: 0.36,
  /** Tip width. */
  tipWidth: 0.08,
} as const

/** Root position of tentacle i of n, relative to the mantle center. */
export function tentacleRoot(size: number, i: number, n: number): { x: number; y: number } {
  const s = n === 1 ? 0 : (i / (n - 1)) * 2 - 1 // -1 (left) .. 1 (right)
  return { x: s * size * TENTACLE_ROOT.spread, y: size * BODY.tentacleRootY }
}

/** Mood → body language (multiples of size, or 0..1 blends). */
const MOOD = {
  puff: 0.12,
  shrink: 0.06,
  stretch: 0.1,
  /** Boop squash at full squash: this much wider / flatter. */
  squashWide: 0.3,
  squashFlat: 0.25,
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
  /** While held: trailing ×, tentacle length ×, and fan spread × (hang down, closer together). */
  dangleTrail: 1.8,
  dangleLength: 1.15,
  dangleFan: 0.6,
  /** Longest trail (× size), however fast the creature moves (e.g. dragged quickly). */
  maxTrail: 1.2,
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
  dangling = false,
  hand: { x: number; y: number } | null = null,
): void {
  const { id, size, tentacleCount: n, anim, velocity } = creature
  // Trailing: tentacles lag behind the motion (follow-through), more toward the tips.
  // Held creatures dangle: more trailing, tentacles hang longer and closer together.
  const trail = MOTION.trailSeconds * motion.trail * (dangling ? MOTION.dangleTrail : 1)
  // Capped, so a fast drag bends the tentacles back instead of smearing them into long streaks.
  const trailLength = Math.hypot(velocity.x, velocity.y) * trail
  const trailCap = size * MOTION.maxTrail
  const trailScale = trailLength > trailCap ? (trail * trailCap) / trailLength : trail
  const trailX = -velocity.x * trailScale
  const trailY = -velocity.y * trailScale
  const fan = dangling ? MOTION.dangleFan : 1
  const grabbed = hand ? grabbedTentacle(size, n, hand.x) : -1
  ctx.fillStyle = color
  for (let i = 0; i < n; i++) {
    const s = (n === 1 ? 0 : (i / (n - 1)) * 2 - 1) * fan // -1 (left) .. 1 (right)
    const length =
      size *
      BODY.tentacleLength *
      (0.85 + hash2(id, i) * 0.3) *
      (dangling ? MOTION.dangleLength : 1)
    const wave = (i % 2 === 0 ? -1 : 1) * size * (0.4 + hash2(id, i + 50) * 0.3)
    const root = tentacleRoot(size, i, n)
    const rootX = x + root.x
    const rootY = y + root.y

    // Traveling wave: each point further along lags in phase, so the swing runs root → tip.
    const phase = anim.swayPhase + i * SWAY.spread
    const swing = size * SWAY.amplitude * motion.sway
    const sway1 = swing * 0.35 * Math.sin(phase)
    const sway2 = swing * 0.7 * Math.sin(phase - SWAY.lag)
    const sway3 = swing * Math.sin(phase - SWAY.lag * 2)

    if (i === grabbed && hand) {
      // The tentacle the visitor holds: stretched from its root to the hand, with a gentle S-bend.
      const dx = hand.x - rootX
      const dy = hand.y - rootY
      taperedCurve(
        ctx,
        [rootX, rootY],
        [rootX + dx * 0.33 + wave * 0.4 + sway1, rootY + dy * 0.33],
        [rootX + dx * 0.66 - wave * 0.3 + sway2, rootY + dy * 0.66],
        [hand.x, hand.y],
        size * TENTACLE_ROOT.width,
        size * TENTACLE_ROOT.tipWidth,
      )
      continue
    }

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
      size * TENTACLE_ROOT.width,
      size * TENTACLE_ROOT.tipWidth,
    )
  }
}

/** Which tentacle a hand at local x is holding: the one whose (resting) tip is closest. Pure. */
export function grabbedTentacle(size: number, n: number, handX: number): number {
  let best = 0
  let bestGap = Infinity
  for (let i = 0; i < n; i++) {
    const s = n === 1 ? 0 : (i / (n - 1)) * 2 - 1
    const gap = Math.abs(tentacleRoot(size, i, n).x + s * size * 1.3 - handX)
    if (gap < bestGap) {
      bestGap = gap
      best = i
    }
  }
  return best
}

export type Point = readonly [number, number]

const CURVE_SAMPLES = 16
const CAP_STEPS = 8

/**
 * The outline of a tapered tentacle along a cubic Bézier, as a closed polygon (pure, testable):
 * left edge root → tip, a rounded cap around the tip, right edge tip → root, and a rounded cap
 * around the root — so no flat, cornered end can ever poke out of the body.
 * Edges come from offsetting sampled curve points along the curve's normal.
 */
export function tentacleOutline(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  startWidth: number,
  endWidth: number,
): Point[] {
  const left: Point[] = []
  const right: Point[] = []
  let rootAngle = 0
  let tipAngle = 0

  for (let i = 0; i <= CURVE_SAMPLES; i++) {
    const t = i / CURVE_SAMPLES
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
    if (i === 0) rootAngle = Math.atan2(dy, dx)
    if (i === CURVE_SAMPLES) tipAngle = Math.atan2(dy, dx)
  }

  /** Half-circle points around center, starting at angle from and sweeping by -π (ends excluded). */
  const cap = (center: Point, radius: number, from: number): Point[] =>
    Array.from({ length: CAP_STEPS - 1 }, (_, k) => {
      const a = from - (Math.PI * (k + 1)) / CAP_STEPS
      return [center[0] + Math.cos(a) * radius, center[1] + Math.sin(a) * radius] as const
    })

  return [
    ...left,
    ...cap(p3, endWidth / 2, tipAngle + Math.PI / 2), // around the front of the tip
    ...right.reverse(),
    ...cap(p0, startWidth / 2, rootAngle - Math.PI / 2), // around the back of the root
  ]
}

/** Fills a tapered tentacle (see tentacleOutline). */
function taperedCurve(
  ctx: CanvasRenderingContext2D,
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  startWidth: number,
  endWidth: number,
): void {
  const outline = tentacleOutline(p0, p1, p2, p3, startWidth, endWidth)
  ctx.beginPath()
  ctx.moveTo(outline[0]![0], outline[0]![1])
  for (let i = 1; i < outline.length; i++) ctx.lineTo(outline[i]![0], outline[i]![1])
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
