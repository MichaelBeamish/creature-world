/**
 * Emote bubbles above creatures' heads, drawn as vector shapes (not emoji glyphs) so they look
 * the same on every platform and match the creatures' style.
 * Pop in with a slight overshoot, float upward, fade out. Reads the world; never mutates it.
 */
import { EXPRESSION, type EmoteKind } from '../simulation/expression'
import { lerp } from '../simulation/math'
import type { World } from '../simulation/world'

/** Ease-out with overshoot ("back"): grows a little past full size, then settles. */
function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

const POP_SECONDS = 0.25
const FADE_FROM = 0.7 // fraction of life after which it fades out
const FLOAT_PX = 14

export function drawEmotes(ctx: CanvasRenderingContext2D, world: World, alpha: number): void {
  for (const c of world.creatures) {
    const emote = c.expression.emote
    if (!emote) continue
    const life = emote.age / EXPRESSION.emoteLife
    const scale = easeOutBack(Math.min(1, emote.age / POP_SECONDS))
    const fade = life < FADE_FROM ? 1 : Math.max(0, 1 - (life - FADE_FROM) / (1 - FADE_FROM))
    const x = lerp(c.prevPosition.x, c.position.x, alpha) + c.size * 0.9
    const y = lerp(c.prevPosition.y, c.position.y, alpha) - c.size * 1.7 - FLOAT_PX * life

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
