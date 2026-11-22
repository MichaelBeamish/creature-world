/**
 * Draws the visitor's items in the water (task #28): for now, shrimp — a little pink curled body of segments, a fan
 * tail, a tiny eye and antennae. A sinking shrimp tumbles gently; a resting one lies on its side on the sand.
 * Pure function of the world: reads state, never mutates it.
 */
import type { Prop } from '../simulation/props'
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
  // Sinking: a slow tumble; resting: lying still, slightly tilted.
  const tumble = p.resting
    ? 0.25
    : Math.sin((time - p.droppedAt) * 1.7 + p.id) * 0.6 * motion.sway + 0.2
  drawShrimp(ctx, p.position.x, p.position.y, 1, tumble)
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
