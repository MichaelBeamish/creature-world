/**
 * Draws the visitor's items in the water: the shrimp (task #28) — a little pink curled body of segments, a fan tail, a
 * tiny eye and antennae; it tumbles gently while sinking — and the toys (task #29): a yellow rubber duck that bobs at
 * the surface (its spin turns it to face left/right), and a soccer ball whose patches rotate as it rolls.
 * Pure function of the world: reads state, never mutates it.
 */
import { isWearable, PROPS, TOY, type Prop } from '../simulation/props'
import { drawFloatingBalloon, drawWearableIcon } from './wearables'
import type { World } from '../simulation/world'
import type { MotionSettings } from './motion'

const SHRIMP = {
  /** Body length (px) at scale 1. */
  length: 22,
  body: '#f4a08e',
  belly: '#ffd2c2',
  stripe: 'rgba(196, 92, 78, 0.55)',
  eye: '#1b1530',
} as const

export function drawProps(
  ctx: CanvasRenderingContext2D,
  world: World,
  motion: MotionSettings,
): void {
  for (const p of world.props.items) drawProp(ctx, p, world.time, motion)
}

function drawProp(
  ctx: CanvasRenderingContext2D,
  p: Prop,
  time: number,
  motion: MotionSettings,
): void {
  if (p.kind === 'balloon') {
    // Let go of: full size (as when held), floating up and away.
    drawFloatingBalloon(ctx, p.position.x, p.position.y, 40, time)
    return
  }
  if (isWearable(p.kind)) {
    // A fallen item: tumbles while it sinks; on the sand it blinks before going back to the chest
    // (a slow fade under reduced motion instead of flashing).
    const tumble = p.resting ? 0.3 : Math.sin((time - p.droppedAt) * 1.5 + p.id) * 0.7 * motion.sway
    const lying = p.resting ? time - p.restedAt : 0
    let alpha = 1
    if (lying > PROPS.blinkAfter) {
      const left = PROPS.returnAfter - lying
      alpha =
        motion.tremble > 0
          ? 0.3 + 0.7 * (Math.sin(lying * Math.PI * 5) > 0 ? 1 : 0) // blinking
          : Math.max(0, left / (PROPS.returnAfter - PROPS.blinkAfter)) // fading
    }
    drawWearableIcon(ctx, p.kind, p.position.x, p.position.y, 20, tumble, alpha)
    return
  }
  if (p.kind === 'duck') {
    // Bob at the surface (toned down under reduced motion); the spin turns it to face left / right.
    const bob = Math.sin(time * 2.2 + p.id) * 2 * motion.sway
    const tilt = Math.sin(time * 1.6 + p.id) * 0.12 * motion.sway + Math.sin(p.angle) * 0.15
    drawDuck(ctx, p.position.x, p.position.y + bob, 1, Math.cos(p.angle) >= 0 ? 1 : -1, tilt)
    return
  }
  if (p.kind === 'ball') {
    drawBall(ctx, p.position.x, p.position.y, 1, p.angle)
    return
  }
  // Sinking: a slow tumble; resting: lying still, slightly tilted.
  const tumble = p.resting
    ? 0.25
    : Math.sin((time - p.droppedAt) * 1.7 + p.id) * 0.6 * motion.sway + 0.2
  drawShrimp(ctx, p.position.x, p.position.y, 1, tumble)
}

/** A yellow rubber duck centered at (x, y), `scale` × normal, facing right (1) or left (−1), tilted by `tilt`. */
export function drawDuck(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  facing: 1 | -1,
  tilt: number,
  alpha = 1,
): void {
  const r = TOY.radius.duck * scale
  ctx.save()
  ctx.globalAlpha *= alpha
  ctx.translate(x, y)
  ctx.rotate(tilt)
  ctx.scale(facing, 1)
  // Body: a plump boat shape with a little tail flick.
  ctx.fillStyle = '#ffd84d'
  ctx.beginPath()
  ctx.ellipse(0, r * 0.25, r * 1.05, r * 0.62, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(-r * 0.85, r * 0.05)
  ctx.quadraticCurveTo(-r * 1.25, -r * 0.35, -r * 1.05, -r * 0.45)
  ctx.quadraticCurveTo(-r * 0.7, -r * 0.1, -r * 0.6, r * 0.1)
  ctx.fill()
  // Head.
  ctx.beginPath()
  ctx.arc(r * 0.45, -r * 0.45, r * 0.5, 0, Math.PI * 2)
  ctx.fill()
  // Beak.
  ctx.fillStyle = '#ff8a2a'
  ctx.beginPath()
  ctx.ellipse(r * 1.0, -r * 0.35, r * 0.32, r * 0.14, 0.1, 0, Math.PI * 2)
  ctx.fill()
  // Eye and a highlight.
  ctx.fillStyle = '#1b1530'
  ctx.beginPath()
  ctx.arc(r * 0.6, -r * 0.6, Math.max(1.2, r * 0.09), 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
  ctx.beginPath()
  ctx.ellipse(r * 0.3, -r * 0.72, r * 0.16, r * 0.08, -0.5, 0, Math.PI * 2)
  ctx.fill()
  // Wing.
  ctx.strokeStyle = '#e8b830'
  ctx.lineWidth = Math.max(1, r * 0.1)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-r * 0.35, r * 0.1)
  ctx.quadraticCurveTo(r * 0.05, r * 0.45, r * 0.35, r * 0.15)
  ctx.stroke()
  ctx.restore()
}

/** A soccer ball centered at (x, y), `scale` × normal, rotated by `angle` (its patches roll with it). */
export function drawBall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  angle: number,
  alpha = 1,
): void {
  const r = TOY.radius.ball * scale
  ctx.save()
  ctx.globalAlpha *= alpha
  ctx.translate(x, y)
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fillStyle = '#f4f6f6'
  ctx.fill()
  ctx.save()
  ctx.clip()
  ctx.rotate(angle)
  ctx.fillStyle = '#20262b'
  pentagon(ctx, 0, 0, r * 0.36, 0)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2
    pentagon(ctx, Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95, r * 0.3, a + Math.PI)
  }
  ctx.restore()
  // Shading and a soft outline.
  const shade = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r)
  shade.addColorStop(0, 'rgba(255, 255, 255, 0.35)')
  shade.addColorStop(1, 'rgba(40, 60, 70, 0.35)')
  ctx.fillStyle = shade
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(40, 50, 55, 0.6)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()
}

function pentagon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, rot: number) {
  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    const a = rot + (i / 5) * Math.PI * 2 - Math.PI / 2
    if (i === 0) ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
    else ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
  }
  ctx.closePath()
  ctx.fill()
}

/** A shrimp centered at (x, y), `scale` × the normal size, rotated by `angle` (rad). Also used for the chest icon. */
export function drawShrimp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  angle: number,
  alpha = 1,
): void {
  const L = SHRIMP.length * scale
  ctx.save()
  ctx.globalAlpha *= alpha
  ctx.translate(x, y)
  ctx.rotate(angle)
  // The body curls in a "C": segments along an arc, getting thinner toward the tail.
  const segments = 6
  const radius = L * 0.42
  const points: { x: number; y: number; r: number }[] = []
  for (let i = 0; i < segments; i++) {
    const t = i / (segments - 1)
    const a = -Math.PI * 0.95 + t * Math.PI * 1.15 // head (left) curling round to the tail (bottom)
    points.push({
      x: Math.cos(a) * radius,
      y: Math.sin(a) * radius * 0.85,
      r: L * (0.2 - 0.12 * t),
    })
  }
  // Tail fan at the end of the curl.
  const tail = points[points.length - 1]!
  ctx.fillStyle = SHRIMP.body
  ctx.beginPath()
  ctx.moveTo(tail.x, tail.y)
  ctx.lineTo(tail.x - L * 0.22, tail.y + L * 0.2)
  ctx.lineTo(tail.x + L * 0.05, tail.y + L * 0.26)
  ctx.lineTo(tail.x + L * 0.2, tail.y + L * 0.14)
  ctx.closePath()
  ctx.fill()
  // Segments, back to front so the head overlaps.
  for (let i = points.length - 1; i >= 0; i--) {
    const s = points[i]!
    ctx.fillStyle = SHRIMP.body
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
    ctx.fill()
    // A lighter belly on the inside of the curl, and a stripe between segments.
    ctx.fillStyle = SHRIMP.belly
    ctx.beginPath()
    ctx.arc(s.x * 0.86, s.y * 0.86, s.r * 0.45, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = SHRIMP.stripe
    ctx.lineWidth = Math.max(0.6, L * 0.03)
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.r * 0.95, -0.6, 0.6)
    ctx.stroke()
  }
  // Head: eye and two antennae.
  const head = points[0]!
  ctx.fillStyle = SHRIMP.eye
  ctx.beginPath()
  ctx.arc(head.x - head.r * 0.2, head.y - head.r * 0.35, Math.max(1, L * 0.045), 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = SHRIMP.body
  ctx.lineWidth = Math.max(0.6, L * 0.025)
  ctx.lineCap = 'round'
  for (const bend of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(head.x - head.r * 0.6, head.y - head.r * 0.2)
    ctx.quadraticCurveTo(
      head.x - L * 0.55,
      head.y - L * (0.35 + 0.12 * bend),
      head.x - L * 0.75,
      head.y - L * (0.1 + 0.2 * bend),
    )
    ctx.stroke()
  }
  ctx.restore()
}
