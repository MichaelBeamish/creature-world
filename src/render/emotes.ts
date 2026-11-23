/**
 * Emote bubbles above creatures' heads, drawn as vector shapes (not emoji glyphs) so they look
 * the same on every platform and match the creatures' style.
 * Pop in with a slight overshoot, float upward, fade out. Reads the world; never mutates it.
 */
import { CHEER_UP } from '../simulation/cheerUp'
import { EXPRESSION, type EmoteKind } from '../simulation/expression'
import { lerp } from '../simulation/math'
import type { World } from '../simulation/world'
import { FULL_MOTION, type MotionSettings } from './motion'

/** Ease-out with overshoot ("back"): grows a little past full size, then settles. */
function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

const POP_SECONDS = 0.25
const FADE_FROM = 0.7 // fraction of life after which it fades out
const FLOAT_PX = 14

export function drawEmotes(
  ctx: CanvasRenderingContext2D,
  world: World,
  alpha: number,
  motion: MotionSettings = FULL_MOTION,
): void {
  for (const c of world.creatures) {
    const emote = c.expression.emote
    if (!emote) continue
    const life = emote.age / EXPRESSION.emoteLife
    const appear = Math.min(1, emote.age / POP_SECONDS)
    // Reduced motion: no overshoot "pop" — the emote simply fades in at full size.
    const scale = motion.emotePop ? easeOutBack(appear) : 1
    const fadeOut = life < FADE_FROM ? 1 : Math.max(0, 1 - (life - FADE_FROM) / (1 - FADE_FROM))
    const fade = motion.emotePop ? fadeOut : Math.min(appear, fadeOut)
    const x = lerp(c.prevPosition.x, c.position.x, alpha) + c.size * 0.9
    const y =
      lerp(c.prevPosition.y, c.position.y, alpha) -
      c.size * 1.7 -
      FLOAT_PX * motion.emoteFloat * life

    ctx.save()
    ctx.globalAlpha = fade
    ctx.translate(x, y)
    ctx.scale(scale, scale)
    drawEmote(ctx, emote.kind)
    ctx.restore()
  }
}

function drawEmote(ctx: CanvasRenderingContext2D, kind: EmoteKind): void {
  if (kind === 'anger') {
    drawAngerMark(ctx)
    return
  }
  // Speech bubble with a little tail pointing down-left toward the creature.
  ctx.fillStyle = '#fffdf8'
  ctx.beginPath()
  ctx.arc(0, 0, 13, 0, Math.PI * 2)
  ctx.moveTo(-8, 9)
  ctx.lineTo(-14, 17)
  ctx.lineTo(-2, 12)
  ctx.closePath()
  ctx.fill()

  if (kind === 'heart') {
    ctx.fillStyle = '#ff5c8a'
    ctx.beginPath()
    ctx.moveTo(0, 7)
    ctx.bezierCurveTo(-11, -1, -6, -10, 0, -4)
    ctx.bezierCurveTo(6, -10, 11, -1, 0, 7)
    ctx.fill()
    return
  }
  ctx.fillStyle = kind === 'exclaim' ? '#e0457b' : '#2f6f9f'
  ctx.font = 'bold 18px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(kind === 'exclaim' ? '!' : '?', 0, 1)
}

/** The Grumpy cheered up (task #38): when the hearts phase starts, one soft pink glow and a burst of hearts floating
 *  up and out around him. Reduced motion: the hearts fade in and out in place. One glow, no flashing. */
export function drawCheerUps(
  ctx: CanvasRenderingContext2D,
  world: World,
  alpha: number,
  motion: MotionSettings = FULL_MOTION,
): void {
  for (const c of world.creatures) {
    if (!c.cheerUp) continue
    const u = world.time - c.cheerUp.since - CHEER_UP.doubt - CHEER_UP.perk
    if (u < 0 || u > CHEER_UP.hearts) continue
    const p = u / CHEER_UP.hearts // 0..1
    const x = lerp(c.prevPosition.x, c.position.x, alpha)
    const y = lerp(c.prevPosition.y, c.position.y, alpha)
    ctx.save()
    // One soft glow swelling and fading (a single slow pulse — light-safe).
    const glow = Math.sin(Math.PI * Math.min(1, u / 1.2))
    const g = ctx.createRadialGradient(x, y, 0, x, y, c.size * 3)
    g.addColorStop(0, `rgba(255, 120, 170, ${0.35 * glow})`)
    g.addColorStop(1, 'rgba(255, 120, 170, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, c.size * 3, 0, Math.PI * 2)
    ctx.fill()
    const count = 8
    for (let i = 0; i < count; i++) {
      const a = -Math.PI * (0.12 + (0.76 * i) / (count - 1)) // a fan, up and out
      const delay = (i % 3) * 0.08
      const q = Math.max(0, Math.min(1, (p - delay) / (1 - delay)))
      const travel = motion.emotePop ? c.size * (0.9 + 2.2 * q) : c.size * 1.6
      const hx = x + Math.cos(a) * travel
      const hy = y - c.size * 0.4 + Math.sin(a) * travel - (motion.emotePop ? q * c.size * 0.8 : 0)
      const fade = q < 0.15 ? q / 0.15 : 1 - Math.max(0, (q - 0.6) / 0.4)
      const s =
        (0.7 + 0.3 * Math.sin(i * 1.7)) * (motion.emotePop ? 0.6 + 0.6 * Math.min(1, q * 3) : 1)
      ctx.globalAlpha = Math.max(0, fade)
      ctx.save()
      ctx.translate(hx, hy)
      ctx.scale(s, s)
      ctx.fillStyle = i % 2 === 0 ? '#ff5c8a' : '#ff8fb3'
      ctx.beginPath()
      ctx.moveTo(0, 7)
      ctx.bezierCurveTo(-11, -1, -6, -10, 0, -4)
      ctx.bezierCurveTo(6, -10, 11, -1, 0, 7)
      ctx.fill()
      ctx.restore()
    }
    ctx.restore()
  }
}

/** The classic "anger vein" mark: four curved strokes bulging outward around a center. */
function drawAngerMark(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = '#ff3b3b'
  ctx.lineWidth = 3.5
  ctx.lineCap = 'round'
  for (let k = 0; k < 4; k++) {
    ctx.save()
    ctx.rotate((k * Math.PI) / 2)
    ctx.beginPath()
    ctx.arc(9, -9, 7, Math.PI * 0.55, Math.PI * 0.95)
    ctx.stroke()
    ctx.restore()
  }
}
