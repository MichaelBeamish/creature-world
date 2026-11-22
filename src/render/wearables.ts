/**
 * Dress-up drawings (task #30). Each item is drawn relative to its spot, in units of the creature's `s` (size):
 *
 * - **head** items: origin at the top of the head; they sit on it and rise upward (−y).
 * - **eyes** items: origin between the eyes; the eye centers are at x = ±0.36·s (radius ≈ 0.24·s).
 * - **face** items: origin just below the eyes (the "mouth" area).
 *
 * `drawCreature` calls `drawWorn` inside its rotated local frame, so worn items follow every pose for free.
 * `drawWearableIcon` draws one centered (chest circles, items sinking in the water).
 */
import { WEARABLES, type WearableKind } from '../simulation/props'

export interface WearExtras {
  /** World time (s): the propeller spins with it. */
  time: number
  /** Swimming speed (px/s): the propeller spins faster. */
  speed: number
  /** 0..1 — how much decorative sparkle/sway (the wand, the balloon); lower under reduced motion. */
  sparkle?: number
  /** Which way (and how far, px) the motion drags things behind — the held balloon lags on its string. */
  drag?: { x: number; y: number }
}

/** A tentacle's cubic Bézier: root, two control points, tip (in the creature's local frame). */
export type Curve = [Point, Point, Point, Point]
type Point = readonly [number, number]

/** Point and direction (unit tangent) along a cubic Bézier at t (0..1). */
function along(c: Curve, t: number): { x: number; y: number; tx: number; ty: number } {
  const [p0, p1, p2, p3] = c
  const u = 1 - t
  const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0]
  const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]
  const dx = 3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0])
  const dy = 3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1])
  const l = Math.hypot(dx, dy) || 1
  return { x, y, tx: dx / l, ty: dy / l }
}

/** How much bigger than their drawing held items are shown (not the balloon). */
const HELD_SCALE = 1.35

/** Draw a held item at the raised tentacle's tip, pointing along the arm (the balloon's string floats straight up). */
export function drawHeld(
  ctx: CanvasRenderingContext2D,
  kind: WearableKind,
  tip: { x: number; y: number; angle: number; lean: number; dragX: number; dragY: number },
  s: number,
  extras: WearExtras,
): void {
  ctx.save()
  ctx.translate(tip.x, tip.y)
  // Items are drawn from their grip (origin) upward (−y): turn "up" to point along the arm.
  if (kind === 'balloon')
    ctx.rotate(-tip.lean) // always floats up, however the body is turned
  else {
    ctx.rotate(tip.angle + Math.PI / 2)
    ctx.scale(HELD_SCALE, HELD_SCALE) // held items read better a bit bigger than a tentacle tip
  }
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  DRAW[kind](ctx, s, { ...extras, drag: { x: tip.dragX, y: tip.dragY } })
  ctx.restore()
}

/** A let-go balloon at (x, y) — the balloon's body — with its string trailing below. */
export function drawFloatingBalloon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  time: number,
): void {
  ctx.save()
  // The drawing puts the balloon 2.4·s above its string's end: start the string below the body.
  ctx.translate(x, y + s * 2.4)
  DRAW.balloon(ctx, s, { time, speed: 0, sparkle: 0 })
  ctx.restore()
}

/** Kandi cuffs: bands of colorful beads across a few tentacles, around the middle, jiggling as it swims. */
export function drawCuffs(
  ctx: CanvasRenderingContext2D,
  curves: Curve[],
  s: number,
  extras: WearExtras,
): void {
  const n = curves.length
  const picks = [0, Math.floor(n / 2), n - 2].filter((i, k, a) => i >= 0 && a.indexOf(i) === k)
  for (const i of picks) {
    const c = curves[i]
    if (!c) continue
    for (const t of [0.45, 0.55]) {
      const p = along(c, t + Math.sin(extras.time * 7 + i + t * 10) * 0.012)
      const width = s * (0.36 - 0.28 * t) // about the tentacle's width there
      drawBeadBand(ctx, p.x, p.y, -p.ty, p.tx, width, s, i * 3 + t * 10)
    }
  }
}

const BEADS = ['#ff4fb4', '#ffd21f', '#3cc84a', '#2f8cff', '#9b4dff', '#ff8a1f']

/** A row of beads across (nx, ny) — the direction across the tentacle — centered at (x, y). */
function drawBeadBand(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  nx: number,
  ny: number,
  width: number,
  s: number,
  seed: number,
) {
  const count = 5
  const r = Math.max(1.4, s * 0.08)
  for (let k = 0; k < count; k++) {
    const f = (k / (count - 1) - 0.5) * (width + r)
    ctx.beginPath()
    ctx.arc(x + nx * f, y + ny * f, r, 0, Math.PI * 2)
    ctx.fillStyle = BEADS[(k + Math.floor(seed)) % BEADS.length]!
    ctx.fill()
  }
}

const EYE_GAP = 0.36

/** Draw everything a creature wears, in its local frame: hats on top, glasses on the eyes, beards below. */
export function drawWorn(
  ctx: CanvasRenderingContext2D,
  dress: { head: WearableKind | null; eyes: WearableKind | null; face: WearableKind | null },
  s: number,
  headTop: number,
  eyeY: number,
  extras: WearExtras,
): void {
  if (dress.face && dress.face !== dress.eyes) drawAt(ctx, dress.face, 0, eyeY + s * 0.4, s, extras)
  // Usually the head item goes on top; but an eyes item that reaches up past the head (the snorkel's tube) is drawn
  // over it, so the tube runs up the outside of the hat or wig.
  const eyesOnTop = dress.eyes !== null && OVER_HEAD.has(dress.eyes)
  if (dress.eyes && !eyesOnTop) drawAt(ctx, dress.eyes, 0, eyeY, s, extras)
  if (dress.head) drawAt(ctx, dress.head, 0, headTop + s * (SIT_LOWER[dress.head] ?? 0), s, extras)
  if (dress.eyes && eyesOnTop) drawAt(ctx, dress.eyes, 0, eyeY, s, extras)
}

/** Eyes items drawn over the head item, because part of them reaches above the head. */
const OVER_HEAD: ReadonlySet<WearableKind> = new Set<WearableKind>(['snorkelMask'])

/** Icon fit for items too big for a circle: shrink factor, and where their middle is (× the shrunk size, down). */
const ICON_FIT: Partial<Record<WearableKind, { scale: number; dy: number }>> = {
  bouffantWig: { scale: 0.62, dy: 0.33 },
  clownWig: { scale: 0.52, dy: -0.6 },
  // Held items are drawn from their grip upward: shift down by about half their length.
  glowStick: { scale: 1.15, dy: 0.55 },
  cutlass: { scale: 0.9, dy: 0.85 },
  sodaCan: { scale: 1.5, dy: 0.42 },
  magicWand: { scale: 1.0, dy: 0.75 },
  balloon: { scale: 0.62, dy: 1.5 },
  rose: { scale: 1.1, dy: 0.65 },
  trident: { scale: 0.9, dy: 0.85 },
  kandiCuffs: { scale: 1.6, dy: 0 },
}

/** One item centered at (x, y) — for the chest's circles and for items in the water. */
export function drawWearableIcon(
  ctx: CanvasRenderingContext2D,
  kind: WearableKind,
  x: number,
  y: number,
  s: number,
  angle: number,
  alpha: number,
  extras: WearExtras = { time: 0, speed: 0 },
): void {
  // Shift so the drawing's visual middle lands on (x, y).
  const spot = WEARABLES[kind]
  // Big items (the wigs wrap the whole head) are shrunk to fit a circle and centered on their own middle.
  const fit = ICON_FIT[kind]
  if (fit) s *= fit.scale
  const dy = fit ? fit.dy * s : spot === 'head' ? s * 0.45 : spot === 'face' ? -s * 0.1 : 0
  ctx.save()
  ctx.globalAlpha *= alpha
  ctx.translate(x, y)
  ctx.rotate(angle)
  drawAt(ctx, kind, 0, dy, s, extras)
  ctx.restore()
}

function drawAt(
  ctx: CanvasRenderingContext2D,
  kind: WearableKind,
  x: number,
  y: number,
  s: number,
  extras: WearExtras,
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  DRAW[kind](ctx, s, extras)
  ctx.restore()
}

type Draw = (ctx: CanvasRenderingContext2D, s: number, extras: WearExtras) => void

/** A heart shape centered at (cx, cy), r ≈ its half-width. */
function heart(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(cx, cy + r * 0.9)
  ctx.bezierCurveTo(cx - r * 1.3, cy + r * 0.05, cx - r * 0.85, cy - r * 1.05, cx, cy - r * 0.35)
  ctx.bezierCurveTo(cx + r * 0.85, cy - r * 1.05, cx + r * 1.3, cy + r * 0.05, cx, cy + r * 0.9)
  ctx.closePath()
}

/** A neon color that slowly cycles through the rainbow (for the LED gear). */
function neon(time: number, offset = 0): string {
  return `hsl(${(time * 60 + offset) % 360} 100% 62%)`
}

/** Draw `paint` with a soft glow of `color` around it (rave gear glows — and pops once the party dims the pool). */
function glowing(ctx: CanvasRenderingContext2D, color: string, blur: number, paint: () => void) {
  ctx.save()
  ctx.shadowColor = color
  ctx.shadowBlur = blur
  paint()
  ctx.restore()
}

const fill = (ctx: CanvasRenderingContext2D, color: string) => {
  ctx.fillStyle = color
  ctx.fill()
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2
    const rr = i % 2 === 0 ? r : r * 0.45
    if (i === 0) ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
    else ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
  }
  ctx.closePath()
}

/** A knit cap dome (the propeller beanie). */
function knitCap(ctx: CanvasRenderingContext2D, s: number, color: string, cuff: string) {
  ctx.beginPath()
  ctx.moveTo(-s * 0.78, s * 0.05)
  ctx.bezierCurveTo(-s * 0.8, -s * 0.85, s * 0.8, -s * 0.85, s * 0.78, s * 0.05)
  ctx.closePath()
  fill(ctx, color)
  // Knit ribs.
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)'
  ctx.lineWidth = Math.max(1, s * 0.04)
  for (const rx of [-0.4, 0, 0.4]) {
    ctx.beginPath()
    ctx.moveTo(s * rx, -s * 0.1)
    ctx.lineTo(s * rx * 0.8, -s * 0.5)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.roundRect(-s * 0.84, -s * 0.12, s * 1.68, s * 0.24, s * 0.1)
  fill(ctx, cuff)
}

/** A curly handlebar mustache (part of the nose glasses). */
function drawMustache(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath()
  for (const side of [-1, 1]) {
    // Thick in the middle (where the two curls meet), tapering out into the curls.
    ctx.moveTo(0, -s * 0.07)
    ctx.bezierCurveTo(
      side * s * 0.25,
      -s * 0.16,
      side * s * 0.5,
      s * 0.16,
      side * s * 0.72,
      -s * 0.02,
    )
    ctx.bezierCurveTo(
      side * s * 0.82,
      -s * 0.12,
      side * s * 0.78,
      -s * 0.25,
      side * s * 0.66,
      -s * 0.2,
    )
    ctx.bezierCurveTo(side * s * 0.6, s * 0.1, side * s * 0.3, s * 0.22, 0, s * 0.18)
  }
  fill(ctx, '#3b2716')
}

/** Some hats sit lower on the head than others (× size, down). */
const SIT_LOWER: Partial<Record<WearableKind, number>> = {
  pirateHat: 0.18,
  bouffantWig: 0.3,
  clownWig: 0.3,
}

const DRAW: Record<WearableKind, Draw> = {
  glowStick(ctx, s, { time }) {
    // A neon glow stick (its color slowly cycles), with a little cap.
    const color = neon(time, 200)
    glowing(ctx, color, s * 0.6, () => {
      ctx.beginPath()
      ctx.roundRect(-s * 0.09, -s * 1.15, s * 0.18, s * 1.25, s * 0.09)
      fill(ctx, color)
    })
    ctx.beginPath()
    ctx.roundRect(-s * 0.11, -s * 0.05, s * 0.22, s * 0.18, s * 0.05)
    fill(ctx, '#3a3a44')
  },
  cutlass(ctx, s) {
    // A pirate cutlass: a curved silver blade, a gold guard, a brown grip.
    ctx.beginPath()
    ctx.roundRect(-s * 0.07, -s * 0.38, s * 0.14, s * 0.42, s * 0.05)
    fill(ctx, '#6b4423')
    ctx.strokeStyle = '#d9b44a'
    ctx.lineWidth = Math.max(1.5, s * 0.08)
    ctx.beginPath()
    ctx.moveTo(-s * 0.22, -s * 0.4)
    ctx.quadraticCurveTo(0, -s * 0.48, s * 0.22, -s * 0.4)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(-s * 0.08, -s * 0.44)
    ctx.quadraticCurveTo(s * 0.0, -s * 1.1, s * 0.32, -s * 1.7)
    ctx.quadraticCurveTo(s * 0.36, -s * 1.05, s * 0.1, -s * 0.44)
    ctx.closePath()
    fill(ctx, '#d6dde4')
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'
    ctx.lineWidth = Math.max(1, s * 0.03)
    ctx.beginPath()
    ctx.moveTo(s * 0.04, -s * 0.6)
    ctx.quadraticCurveTo(s * 0.1, -s * 1.1, s * 0.28, -s * 1.55)
    ctx.stroke()
  },
  sodaCan(ctx, s, { time }) {
    // A bright soda can with a straw, and a little fizz.
    ctx.beginPath()
    ctx.roundRect(-s * 0.2, -s * 0.65, s * 0.4, s * 0.68, s * 0.06)
    fill(ctx, '#e8242f')
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = Math.max(1, s * 0.06)
    ctx.beginPath()
    ctx.moveTo(-s * 0.2, -s * 0.28)
    ctx.quadraticCurveTo(0, -s * 0.42, s * 0.2, -s * 0.26)
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(0, -s * 0.65, s * 0.2, s * 0.05, 0, 0, Math.PI * 2)
    fill(ctx, '#c9cdd2')
    ctx.strokeStyle = '#ff6fb1'
    ctx.lineWidth = Math.max(1.5, s * 0.06)
    ctx.beginPath()
    ctx.moveTo(s * 0.05, -s * 0.6)
    ctx.lineTo(s * 0.14, -s * 1.0)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)' // fizz
    for (let k = 0; k < 3; k++) {
      const t = (time * 0.8 + k / 3) % 1
      ctx.beginPath()
      ctx.arc(-s * 0.08 + k * s * 0.06, -s * (0.72 + t * 0.35), s * 0.025, 0, Math.PI * 2)
      ctx.fill()
    }
  },
  magicWand(ctx, s, { time, sparkle = 1 }) {
    // A black wand with a white tip and a gold star that sparkles.
    ctx.strokeStyle = '#1d1d24'
    ctx.lineWidth = Math.max(2, s * 0.1)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, -s * 1.1)
    ctx.stroke()
    ctx.fillStyle = '#ffe58a'
    glowing(ctx, '#ffe58a', s * 0.5, () => {
      star(ctx, 0, -s * 1.3, s * 0.28)
      ctx.fill()
    })
    // Sparkles twinkling around the star (fewer under reduced motion).
    const count = Math.round(4 * sparkle)
    for (let k = 0; k < count; k++) {
      const phase = (time * 1.5 + k / Math.max(1, count)) % 1
      const a = k * 2.4 + Math.floor(time * 1.5 + k / count) * 1.7
      const r = s * (0.35 + 0.25 * phase)
      ctx.globalAlpha = 1 - phase
      ctx.fillStyle = '#fff6c8'
      star(ctx, Math.cos(a) * r, -s * 1.3 + Math.sin(a) * r, s * 0.08)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  },
  balloon(ctx, s, { time, sparkle = 1, drag = { x: 0, y: 0 } }) {
    // A red balloon floating up on a string, bobbing and drifting a little.
    // Dragged along, it lags well behind on its string (the string stays about the same length, so it dips as it
    // swings out sideways).
    const lagX = Math.max(-s * 2, Math.min(s * 2, drag.x * 2.2))
    const bx = Math.sin(time * 1.3) * s * 0.25 * sparkle + lagX
    const dip = s * 2.4 - Math.sqrt(Math.max(0, (s * 2.4) ** 2 - lagX * lagX * 0.6))
    const by =
      -s * 2.4 +
      dip +
      Math.min(s * 0.8, Math.max(-s * 0.4, drag.y * 0.6)) +
      Math.sin(time * 1.9) * s * 0.08 * sparkle
    ctx.strokeStyle = 'rgba(240, 240, 240, 0.8)'
    ctx.lineWidth = Math.max(1, s * 0.03)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.bezierCurveTo(s * 0.15, -s * 0.8, bx - s * 0.15, by + s * 1.0, bx, by + s * 0.62)
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(bx, by, s * 0.5, s * 0.6, 0, 0, Math.PI * 2)
    fill(ctx, '#e8242f')
    ctx.beginPath()
    ctx.moveTo(bx - s * 0.08, by + s * 0.66)
    ctx.lineTo(bx + s * 0.08, by + s * 0.66)
    ctx.lineTo(bx, by + s * 0.58)
    ctx.closePath()
    fill(ctx, '#c01d27')
    ctx.beginPath()
    ctx.ellipse(bx - s * 0.18, by - s * 0.22, s * 0.1, s * 0.17, -0.5, 0, Math.PI * 2)
    fill(ctx, 'rgba(255, 255, 255, 0.45)')
  },
  rose(ctx, s) {
    // A red rose on a green stem with a leaf.
    ctx.strokeStyle = '#2f8a3e'
    ctx.lineWidth = Math.max(1.5, s * 0.07)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.quadraticCurveTo(s * 0.08, -s * 0.5, 0, -s * 0.95)
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(s * 0.14, -s * 0.45, s * 0.16, s * 0.07, -0.6, 0, Math.PI * 2)
    fill(ctx, '#3ca34e')
    for (const [px, py, r, c] of [
      [0, -1.12, 0.26, '#b3142c'],
      [-0.12, -1.08, 0.18, '#d61f3a'],
      [0.12, -1.08, 0.18, '#d61f3a'],
      [0, -1.2, 0.14, '#e8424f'],
    ] as const) {
      ctx.beginPath()
      ctx.arc(s * px, s * py, s * r, 0, Math.PI * 2)
      fill(ctx, c)
    }
    ctx.strokeStyle = 'rgba(110, 10, 25, 0.6)'
    ctx.lineWidth = Math.max(1, s * 0.03)
    ctx.beginPath()
    ctx.arc(0, -s * 1.14, s * 0.1, 0.5, 4.5)
    ctx.stroke()
  },
  trident(ctx, s) {
    // A tiny golden trident: a shaft and three barbed prongs.
    ctx.strokeStyle = '#d9b44a'
    ctx.lineWidth = Math.max(2, s * 0.09)
    ctx.beginPath()
    ctx.moveTo(0, s * 0.1)
    ctx.lineTo(0, -s * 1.55)
    ctx.moveTo(-s * 0.3, -s * 1.2)
    ctx.quadraticCurveTo(-s * 0.3, -s * 1.0, 0, -s * 1.0)
    ctx.quadraticCurveTo(s * 0.3, -s * 1.0, s * 0.3, -s * 1.2)
    ctx.moveTo(-s * 0.3, -s * 1.2)
    ctx.lineTo(-s * 0.3, -s * 1.55)
    ctx.moveTo(s * 0.3, -s * 1.2)
    ctx.lineTo(s * 0.3, -s * 1.55)
    ctx.stroke()
    ctx.fillStyle = '#d9b44a'
    for (const px of [-0.3, 0, 0.3]) {
      ctx.beginPath()
      ctx.moveTo(s * (px - 0.09), -s * 1.5)
      ctx.lineTo(s * px, -s * 1.75)
      ctx.lineTo(s * (px + 0.09), -s * 1.5)
      ctx.closePath()
      ctx.fill()
    }
  },
  kandiCuffs(ctx, s) {
    // (The chest icon: a stack of three beaded bracelets. On a creature they're drawn across its tentacles.)
    for (let row = 0; row < 3; row++) {
      drawBeadBand(ctx, 0, (row - 1) * s * 0.18, 1, 0, s * 0.55, s, row * 2)
    }
  },
  wizardHat(ctx, s) {
    // Tall, slightly bent purple cone with stars, on a wide brim.
    ctx.beginPath()
    ctx.moveTo(-s * 0.62, -s * 0.05)
    ctx.quadraticCurveTo(-s * 0.2, -s * 0.9, s * 0.25, -s * 1.75)
    ctx.quadraticCurveTo(s * 0.3, -s * 0.9, s * 0.62, -s * 0.05)
    ctx.closePath()
    fill(ctx, '#5b3fa8')
    ctx.beginPath()
    ctx.ellipse(0, 0, s * 1.0, s * 0.2, 0, 0, Math.PI * 2)
    fill(ctx, '#4a3290')
    ctx.fillStyle = '#ffe58a'
    star(ctx, -s * 0.12, -s * 0.55, s * 0.14)
    ctx.fill()
    star(ctx, s * 0.14, -s * 1.0, s * 0.1)
    ctx.fill()
  },
  propellerBeanie(ctx, s, { time, speed }) {
    // Colored segments, a stem, and a propeller that spins faster the faster it swims.
    knitCap(ctx, s, '#3e8ede', '#e8c547')
    ctx.beginPath()
    ctx.moveTo(-s * 0.05, -s * 0.62)
    ctx.lineTo(s * 0.05, -s * 0.62)
    ctx.lineTo(s * 0.04, -s * 0.8)
    ctx.lineTo(-s * 0.04, -s * 0.8)
    ctx.closePath()
    fill(ctx, '#555')
    const spin = time * (6 + speed * 0.06)
    const blade = Math.cos(spin) // seen edge-on: the blades' apparent length swings
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.ellipse(
        side * s * 0.32 * blade,
        -s * 0.82,
        Math.abs(s * 0.32 * blade) + 1,
        s * 0.07,
        0,
        0,
        Math.PI * 2,
      )
      fill(ctx, side < 0 ? '#e14b4b' : '#4bb34b')
    }
    ctx.beginPath()
    ctx.arc(0, -s * 0.82, s * 0.06, 0, Math.PI * 2)
    fill(ctx, '#ffd84d')
  },
  cowboyHat(ctx, s) {
    // A wide curled brim and a pinched crown with a band.
    ctx.beginPath()
    ctx.moveTo(-s * 1.15, -s * 0.15)
    ctx.quadraticCurveTo(0, s * 0.25, s * 1.15, -s * 0.15)
    ctx.quadraticCurveTo(s * 1.2, s * 0.05, s * 0.9, s * 0.12)
    ctx.quadraticCurveTo(0, s * 0.35, -s * 0.9, s * 0.12)
    ctx.quadraticCurveTo(-s * 1.2, s * 0.05, -s * 1.15, -s * 0.15)
    fill(ctx, '#8b5a2b')
    ctx.beginPath()
    ctx.moveTo(-s * 0.55, s * 0.08)
    ctx.quadraticCurveTo(-s * 0.6, -s * 0.75, -s * 0.15, -s * 0.7)
    ctx.quadraticCurveTo(0, -s * 0.55, s * 0.15, -s * 0.7)
    ctx.quadraticCurveTo(s * 0.6, -s * 0.75, s * 0.55, s * 0.08)
    ctx.closePath()
    fill(ctx, '#a06a35')
    ctx.beginPath()
    ctx.rect(-s * 0.56, -s * 0.12, s * 1.12, s * 0.14)
    fill(ctx, '#3b2716')
  },
  partyHat(ctx, s) {
    // A striped cone with a pom-pom.
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(-s * 0.48, 0)
    ctx.lineTo(0, -s * 1.35)
    ctx.lineTo(s * 0.48, 0)
    ctx.closePath()
    ctx.clip()
    ctx.fillStyle = '#ff6fb1'
    ctx.fillRect(-s, -s * 1.4, s * 2, s * 1.5)
    ctx.fillStyle = '#ffd84d'
    for (let i = 0; i < 5; i++) {
      ctx.save()
      ctx.translate(0, -s * 0.25 * i)
      ctx.rotate(-0.5)
      ctx.fillRect(-s, -s * 0.05, s * 2, s * 0.1)
      ctx.restore()
    }
    ctx.restore()
    ctx.beginPath()
    ctx.arc(0, -s * 1.38, s * 0.15, 0, Math.PI * 2)
    fill(ctx, '#6fd3ff')
  },
  pirateHat(ctx, s) {
    // A buccaneer captain's hat: a big black hat with the front brim turned up, gold trim, a skull and crossbones,
    // and a red feather plume sweeping back.
    ctx.beginPath() // the feather, behind the hat
    ctx.moveTo(s * 0.35, -s * 0.55)
    ctx.quadraticCurveTo(s * 1.2, -s * 1.25, s * 1.35, -s * 0.55)
    ctx.quadraticCurveTo(s * 1.0, -s * 0.85, s * 0.45, -s * 0.4)
    ctx.closePath()
    fill(ctx, '#c0392b')
    ctx.beginPath() // the wide brim
    ctx.ellipse(0, -s * 0.02, s * 1.2, s * 0.22, 0, 0, Math.PI * 2)
    fill(ctx, '#18181f')
    ctx.beginPath() // the crown
    ctx.moveTo(-s * 0.55, -s * 0.05)
    ctx.quadraticCurveTo(-s * 0.6, -s * 0.85, 0, -s * 0.85)
    ctx.quadraticCurveTo(s * 0.6, -s * 0.85, s * 0.55, -s * 0.05)
    ctx.closePath()
    fill(ctx, '#18181f')
    ctx.beginPath() // the front brim, turned up
    ctx.moveTo(-s * 1.05, -s * 0.1)
    ctx.quadraticCurveTo(-s * 0.7, -s * 1.0, 0, -s * 1.05)
    ctx.quadraticCurveTo(s * 0.7, -s * 1.0, s * 1.05, -s * 0.1)
    ctx.quadraticCurveTo(0, -s * 0.35, -s * 1.05, -s * 0.1)
    fill(ctx, '#24242d')
    ctx.strokeStyle = '#d9b44a' // gold trim along the upturned brim
    ctx.lineWidth = Math.max(1.2, s * 0.06)
    ctx.beginPath()
    ctx.moveTo(-s * 1.02, -s * 0.12)
    ctx.quadraticCurveTo(-s * 0.7, -s * 0.98, 0, -s * 1.02)
    ctx.quadraticCurveTo(s * 0.7, -s * 0.98, s * 1.02, -s * 0.12)
    ctx.stroke()
    // Skull and crossbones on the front.
    ctx.strokeStyle = '#f2efe6'
    ctx.lineWidth = Math.max(1.2, s * 0.06)
    ctx.beginPath()
    ctx.moveTo(-s * 0.2, -s * 0.38)
    ctx.lineTo(s * 0.2, -s * 0.66)
    ctx.moveTo(s * 0.2, -s * 0.38)
    ctx.lineTo(-s * 0.2, -s * 0.66)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(0, -s * 0.6, s * 0.13, 0, Math.PI * 2)
    fill(ctx, '#f2efe6')
    ctx.fillStyle = '#18181f'
    for (const ex of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(ex * s * 0.05, -s * 0.62, s * 0.03, 0, Math.PI * 2)
      ctx.fill()
    }
  },
  bouffantWig(ctx, s) {
    // Big, voluminous blonde curls piled high and spilling down the sides (20% bigger than the head).
    ctx.scale(1.2, 1.2)
    const curls: [number, number, number][] = [
      [0, -0.75, 0.48],
      [-0.45, -0.6, 0.4],
      [0.45, -0.6, 0.4],
      [-0.8, -0.25, 0.34],
      [0.8, -0.25, 0.34],
      [-0.92, 0.2, 0.3],
      [0.92, 0.2, 0.3],
      [-0.2, -1.05, 0.32],
      [0.25, -1.05, 0.32],
      [-0.85, 0.6, 0.24],
      [0.85, 0.6, 0.24],
    ]
    for (const [cx, cy, r] of curls) {
      ctx.beginPath()
      ctx.arc(s * cx, s * cy, s * r, 0, Math.PI * 2)
      fill(ctx, '#f7dc6f')
    }
    ctx.strokeStyle = 'rgba(190, 150, 40, 0.55)'
    ctx.lineWidth = Math.max(1, s * 0.04)
    for (const [cx, cy, r] of curls) {
      ctx.beginPath()
      ctx.arc(s * cx, s * cy, s * r * 0.6, 0.4, 2.4)
      ctx.stroke()
    }
  },
  tiara(ctx, s) {
    // A dainty silver princess tiara: a band with five points (the middle one tallest) and a pink center gem.
    const points = [
      [-0.55, 0.32],
      [-0.28, 0.46],
      [0, 0.62],
      [0.28, 0.46],
      [0.55, 0.32],
    ] as const
    ctx.beginPath()
    ctx.moveTo(-s * 0.68, s * 0.02)
    for (const [px, h] of points) {
      ctx.lineTo(s * (px - 0.1), -s * 0.06)
      ctx.lineTo(s * px, -s * h)
      ctx.lineTo(s * (px + 0.1), -s * 0.06)
    }
    ctx.lineTo(s * 0.68, s * 0.02)
    ctx.quadraticCurveTo(0, s * 0.12, -s * 0.68, s * 0.02)
    fill(ctx, '#dfe6ee')
    ctx.strokeStyle = '#a9b6c4'
    ctx.lineWidth = Math.max(1, s * 0.03)
    ctx.stroke()
    for (const [px, h] of points) {
      ctx.beginPath()
      ctx.arc(s * px, -s * h, s * 0.05, 0, Math.PI * 2)
      fill(ctx, px === 0 ? '#ff6fa8' : '#8fd3ff')
    }
    ctx.beginPath()
    ctx.ellipse(0, -s * 0.2, s * 0.09, s * 0.12, 0, 0, Math.PI * 2)
    fill(ctx, '#ff4f93')
  },
  ledCatEars(ctx, s, { time }) {
    // A headband with glowing cat ears that slowly cycle through neon colors.
    const color = neon(time)
    ctx.strokeStyle = '#26262e'
    ctx.lineWidth = Math.max(2, s * 0.1)
    ctx.beginPath()
    ctx.arc(0, s * 0.55, s * 0.78, Math.PI * 1.15, Math.PI * 1.85)
    ctx.stroke()
    for (const side of [-1, 1]) {
      glowing(ctx, color, s * 0.5, () => {
        ctx.beginPath()
        ctx.moveTo(side * s * 0.22, -s * 0.12)
        ctx.lineTo(side * s * 0.5, -s * 0.78)
        ctx.lineTo(side * s * 0.72, -s * 0.02)
        ctx.closePath()
        ctx.strokeStyle = color
        ctx.lineWidth = Math.max(2, s * 0.09)
        ctx.stroke()
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
        ctx.fill()
      })
    }
  },
  clownWig(ctx, s) {
    // A big curly rainbow afro: one fluffy mass of hair with a curly, scalloped edge, covering the top of the head
    // and framing the face — with an opening so the eyes and face show through.
    const cx = 0
    const cy = s * 0.6 // the afro's center
    const rx = s * 1.5
    const ry = s * 1.32
    const hair = new Path2D()
    // Outer edge: a ring of overlapping curls around an ellipse.
    const bumps = 26
    for (let i = 0; i < bumps; i++) {
      const a = (i / bumps) * Math.PI * 2
      const bx = cx + Math.cos(a) * rx
      const by = cy + Math.sin(a) * ry
      hair.moveTo(bx + s * 0.24, by)
      hair.arc(bx, by, s * 0.24, 0, Math.PI * 2)
    }
    hair.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    // The face opening (cut out with the even-odd rule).
    const face = new Path2D()
    face.ellipse(0, s * 1.2, s * 0.86, s * 0.98, 0, 0, Math.PI * 2)

    ctx.save()
    // Clip to the hair, then to "everything but the face" (a big rectangle with the face cut out, even-odd).
    const clip = new Path2D()
    clip.rect(-s * 3, -s * 3, s * 6, s * 6)
    clip.addPath(face)
    ctx.clip(hair)
    ctx.clip(clip, 'evenodd')
    // Rainbow bands, flowing from the outside (red) to the inside (purple).
    const rainbow = ['#e8242f', '#ff8a1f', '#ffd21f', '#3cc84a', '#2f8cff', '#9b4dff']
    rainbow.forEach((color, i) => {
      const k = 1.2 - i * 0.12
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx * k, ry * k, 0, 0, Math.PI * 2)
      fill(ctx, color)
    })
    // Curly texture all over: little spiral curls.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
    ctx.lineWidth = Math.max(1, s * 0.035)
    for (let i = 0; i < 40; i++) {
      const a = i * 2.399963 // golden angle: an even scatter
      const r = Math.sqrt((i + 0.5) / 40)
      const x = cx + Math.cos(a) * rx * r
      const y = cy + Math.sin(a) * ry * r
      ctx.beginPath()
      ctx.arc(x, y, s * 0.09, a, a + Math.PI * 1.5)
      ctx.stroke()
    }
    ctx.restore()
  },
  mouseEars(ctx, s) {
    // A headband with two big round black mouse ears.
    ctx.strokeStyle = '#1c1c22'
    ctx.lineWidth = Math.max(2, s * 0.12)
    ctx.beginPath()
    ctx.arc(0, s * 0.55, s * 0.8, Math.PI * 1.13, Math.PI * 1.87)
    ctx.stroke()
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(side * s * 0.62, -s * 0.5, s * 0.42, 0, Math.PI * 2)
      fill(ctx, '#1c1c22')
      ctx.beginPath() // a soft sheen
      ctx.arc(side * s * 0.62 - s * 0.12, -s * 0.62, s * 0.12, 0, Math.PI * 2)
      fill(ctx, 'rgba(255, 255, 255, 0.12)')
    }
  },
  heartGlasses(ctx, s) {
    // Two red heart frames with pink lenses.
    for (const side of [-1, 1]) {
      heart(ctx, side * s * EYE_GAP, s * 0.02, s * 0.36)
      fill(ctx, '#e02c4b')
      heart(ctx, side * s * EYE_GAP, s * 0.02, s * 0.24)
      fill(ctx, 'rgba(255, 140, 180, 0.6)')
    }
    ctx.strokeStyle = '#e02c4b'
    ctx.lineWidth = Math.max(1.5, s * 0.07)
    ctx.beginPath()
    ctx.moveTo(-s * 0.12, -s * 0.06)
    ctx.lineTo(s * 0.12, -s * 0.06)
    ctx.stroke()
  },
  shutterShades(ctx, s, { time }) {
    // Slatted party glasses in glowing neon.
    const color = neon(time, 120)
    glowing(ctx, color, s * 0.45, () => {
      ctx.strokeStyle = color
      ctx.lineWidth = Math.max(1.5, s * 0.07)
      for (const side of [-1, 1]) {
        ctx.beginPath()
        ctx.roundRect(side * s * EYE_GAP - s * 0.3, -s * 0.22, s * 0.6, s * 0.42, s * 0.1)
        ctx.stroke()
        for (let i = 1; i <= 3; i++) {
          const y = -s * 0.22 + (s * 0.42 * i) / 4
          ctx.beginPath()
          ctx.moveTo(side * s * EYE_GAP - s * 0.28, y)
          ctx.lineTo(side * s * EYE_GAP + s * 0.28, y)
          ctx.stroke()
        }
      }
      ctx.beginPath()
      ctx.moveTo(-s * 0.06, -s * 0.08)
      ctx.lineTo(s * 0.06, -s * 0.08)
      ctx.stroke()
    })
  },
  clownNose(ctx, s) {
    // Soft blue eyeshadow above both eyes, and a big shiny red nose.
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.ellipse(side * s * EYE_GAP, -s * 0.24, s * 0.26, s * 0.13, 0, Math.PI, 0)
      ctx.closePath()
      fill(ctx, 'rgba(70, 140, 255, 0.55)')
    }
    ctx.beginPath()
    ctx.arc(0, s * 0.3, s * 0.2, 0, Math.PI * 2)
    fill(ctx, '#e8242f')
    ctx.beginPath()
    ctx.arc(-s * 0.06, s * 0.23, s * 0.06, 0, Math.PI * 2)
    fill(ctx, 'rgba(255, 255, 255, 0.75)')
  },
  starGlasses(ctx, s) {
    // Two big gold star frames with pink lenses, joined by a bridge.
    for (const side of [-1, 1]) {
      star(ctx, side * s * EYE_GAP, 0, s * 0.42)
      fill(ctx, '#ffc93c')
      star(ctx, side * s * EYE_GAP, 0, s * 0.28)
      fill(ctx, 'rgba(255, 120, 190, 0.55)')
    }
    ctx.strokeStyle = '#ffc93c'
    ctx.lineWidth = Math.max(1.5, s * 0.07)
    ctx.beginPath()
    ctx.moveTo(-s * 0.12, -s * 0.05)
    ctx.lineTo(s * 0.12, -s * 0.05)
    ctx.stroke()
  },
  monocle(ctx, s) {
    // A gold ring over the right eye with a chain hanging down.
    ctx.strokeStyle = '#d9b44a'
    ctx.lineWidth = Math.max(1.5, s * 0.07)
    ctx.beginPath()
    ctx.arc(s * EYE_GAP, 0, s * 0.3, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = 'rgba(200, 230, 255, 0.25)'
    ctx.fill()
    ctx.lineWidth = Math.max(1, s * 0.03)
    ctx.beginPath()
    ctx.moveTo(s * (EYE_GAP + 0.22), s * 0.2)
    ctx.quadraticCurveTo(s * 0.75, s * 0.75, s * 0.55, s * 1.05)
    ctx.stroke()
  },
  snorkelMask(ctx, s) {
    // A see-through diving mask over both eyes (a frame and a clear, slightly tinted lens), and a snorkel tube.
    ctx.beginPath()
    ctx.roundRect(-s * 0.66, -s * 0.3, s * 1.32, s * 0.58, s * 0.24)
    fill(ctx, 'rgba(170, 235, 255, 0.18)')
    ctx.strokeStyle = '#2bb3a8'
    ctx.lineWidth = Math.max(2, s * 0.1)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)' // a glint on the glass
    ctx.lineWidth = Math.max(1, s * 0.04)
    ctx.beginPath()
    ctx.moveTo(-s * 0.48, -s * 0.16)
    ctx.lineTo(-s * 0.3, -s * 0.16)
    ctx.stroke()
    ctx.strokeStyle = '#2bb3a8'
    ctx.lineWidth = Math.max(2, s * 0.1)
    ctx.beginPath()
    ctx.moveTo(s * 0.7, s * 0.05)
    ctx.quadraticCurveTo(s * 0.95, s * 0.1, s * 0.92, -s * 0.4)
    ctx.lineTo(s * 0.92, -s * 1.05)
    ctx.stroke()
    ctx.beginPath()
    ctx.roundRect(s * 0.8, -s * 1.15, s * 0.24, s * 0.16, s * 0.06)
    fill(ctx, '#ff8a2a')
  },
  beard(ctx, s) {
    // A big fluffy white beard: a scalloped, curly outline and wavy strands.
    const tufts: [number, number, number][] = [
      [-0.62, 0.05, 0.22],
      [0.62, 0.05, 0.22],
      [-0.66, 0.35, 0.24],
      [0.66, 0.35, 0.24],
      [-0.52, 0.65, 0.24],
      [0.52, 0.65, 0.24],
      [-0.28, 0.88, 0.24],
      [0.28, 0.88, 0.24],
      [0, 1.02, 0.25],
      [-0.25, 0.35, 0.36],
      [0.25, 0.35, 0.36],
      [0, 0.62, 0.38],
    ]
    for (const [cx, cy, r] of tufts) {
      ctx.beginPath()
      ctx.arc(s * cx, s * cy, s * r, 0, Math.PI * 2)
      fill(ctx, '#eef1f3')
    }
    ctx.strokeStyle = 'rgba(140, 155, 165, 0.6)'
    ctx.lineWidth = Math.max(1, s * 0.035)
    for (const bx of [-0.45, -0.22, 0, 0.22, 0.45]) {
      ctx.beginPath()
      ctx.moveTo(s * bx, s * 0.2)
      ctx.bezierCurveTo(s * (bx + 0.1), s * 0.45, s * (bx - 0.1), s * 0.65, s * bx * 0.8, s * 0.95)
      ctx.stroke()
    }
    // Little curls at the edge.
    for (const [cx, cy] of [
      [-0.62, 0.42],
      [0.62, 0.42],
      [-0.3, 0.92],
      [0.3, 0.92],
    ] as const) {
      ctx.beginPath()
      ctx.arc(s * cx, s * cy, s * 0.08, 0.5, 4.5)
      ctx.stroke()
    }
  },
  noseGlasses(ctx, s) {
    // The classic disguise: black frames, bushy eyebrows, a big pink nose, and a mustache.
    ctx.strokeStyle = '#111'
    ctx.lineWidth = Math.max(1.5, s * 0.08)
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(side * s * EYE_GAP, 0, s * 0.28, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.ellipse(side * s * EYE_GAP, -s * 0.4, s * 0.26, s * 0.08, side * -0.2, 0, Math.PI * 2)
      fill(ctx, '#111')
    }
    ctx.beginPath()
    ctx.moveTo(-s * 0.08, -s * 0.03)
    ctx.lineTo(s * 0.08, -s * 0.03)
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(0, s * 0.3, s * 0.17, s * 0.24, 0, 0, Math.PI * 2)
    fill(ctx, '#f2a0a0')
    ctx.save()
    ctx.translate(0, s * 0.5)
    ctx.scale(0.75, 0.75)
    drawMustache(ctx, s)
    ctx.restore()
  },
}
