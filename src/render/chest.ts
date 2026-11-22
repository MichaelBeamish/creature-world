/**
 * Draws the treasure chest on the sand (task #28): weathered wood with brass bands, a bit of moss and barnacles. Open,
 * its lid swings back, a warm golden glow spills out, and its items float up into slots above it (greyed out when none
 * can be taken). The item being carried follows the hand. Pure function of the world: reads state, never mutates it.
 */
import {
  CHEST,
  CHEST_PAGES,
  canTake,
  chestBox,
  isWearable,
  pageItems,
  SLOT_COUNT,
  slotPosition,
  type PropKind,
} from '../simulation/props'
import { drawWearableIcon } from './wearables'
import type { World } from '../simulation/world'
import type { MotionSettings } from './motion'
import { drawBall, drawDuck, drawShrimp } from './props'

const LOOK = {
  wood: '#5b3f2c',
  woodDark: '#3e2a1d',
  plank: 'rgba(30, 18, 10, 0.45)',
  brass: '#b8913f',
  brassDark: '#7d6226',
  moss: 'rgba(96, 160, 118, 0.75)',
  barnacle: '#c9d6d2',
  glow: 'rgba(255, 210, 120, ',
  slotFill: 'rgba(52, 86, 104, 0.6)',
  slotRim: 'rgba(255, 214, 140, 0.8)',
} as const

/** Seconds for the lid to open and the items to float up. */
const OPEN_SECONDS = 0.35

/** 0 (closed) .. 1 (open), eased, from the chest's state and when it last changed. */
function openness(world: World): number {
  const { open, changedAt } = world.props.chest
  const t = Math.min(1, (world.time - changedAt) / OPEN_SECONDS)
  const eased = t * t * (3 - 2 * t) // smoothstep
  return open ? eased : 1 - eased
}

/** The chest itself (drawn behind the creatures). */
export function drawChest(ctx: CanvasRenderingContext2D, world: World): void {
  const b = chestBox(world)
  const k = openness(world)
  const bodyTop = b.y + b.height * 0.38
  ctx.save()

  // Shadow on the sand.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
  ctx.beginPath()
  ctx.ellipse(b.x + b.width / 2, b.y + b.height + 2, b.width * 0.55, 6, 0, 0, Math.PI * 2)
  ctx.fill()

  // Golden glow from inside when open.
  if (k > 0.01) {
    const g = ctx.createRadialGradient(
      b.x + b.width / 2,
      bodyTop,
      2,
      b.x + b.width / 2,
      bodyTop,
      b.width,
    )
    g.addColorStop(0, `${LOOK.glow}${0.55 * k})`)
    g.addColorStop(1, `${LOOK.glow}0)`)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(b.x + b.width / 2, bodyTop, b.width, 0, Math.PI * 2)
    ctx.fill()
  }

  // Body: wood with plank lines and two brass bands.
  roundRect(ctx, b.x, bodyTop, b.width, b.y + b.height - bodyTop, 5)
  ctx.fillStyle = LOOK.wood
  ctx.fill()
  ctx.strokeStyle = LOOK.plank
  ctx.lineWidth = 1
  for (let i = 1; i < 3; i++) {
    const py = bodyTop + ((b.y + b.height - bodyTop) * i) / 3
    ctx.beginPath()
    ctx.moveTo(b.x + 3, py)
    ctx.lineTo(b.x + b.width - 3, py)
    ctx.stroke()
  }
  ctx.fillStyle = LOOK.brass
  for (const bx of [b.x + b.width * 0.2, b.x + b.width * 0.8 - 6]) {
    ctx.fillRect(bx, bodyTop, 6, b.y + b.height - bodyTop)
  }
  // Lock plate.
  ctx.fillStyle = LOOK.brassDark
  roundRect(ctx, b.x + b.width / 2 - 6, bodyTop - 2, 12, 12, 2)
  ctx.fill()

  // Lid. Closed: a rounded, mossy top. Open: it has swung back — we see its inside standing up behind the glow.
  const lidHeight = b.height * 0.42
  const cx = b.x + b.width / 2
  if (k > 0.01) {
    // The open lid's inside: a tall dark panel rising behind the chest, with its brass bands.
    const rise = lidHeight * 1.5 * k
    ctx.save()
    ctx.globalAlpha = k
    roundRect(ctx, b.x + 2, bodyTop - rise, b.width - 4, rise, 6)
    ctx.fillStyle = LOOK.woodDark
    ctx.fill()
    ctx.fillStyle = LOOK.brassDark
    ctx.fillRect(b.x + b.width * 0.2, bodyTop - rise, 6, rise)
    ctx.fillRect(b.x + b.width * 0.8 - 6, bodyTop - rise, 6, rise)
    ctx.restore()
  }
  if (k < 0.99) {
    // The closed lid (fades out as it swings away).
    ctx.save()
    ctx.globalAlpha = 1 - k
    ctx.translate(cx, bodyTop)
    ctx.beginPath()
    ctx.moveTo(-b.width / 2, 0)
    ctx.lineTo(-b.width / 2, -lidHeight * 0.45)
    ctx.quadraticCurveTo(0, -lidHeight * 1.3, b.width / 2, -lidHeight * 0.45)
    ctx.lineTo(b.width / 2, 0)
    ctx.closePath()
    ctx.fillStyle = LOOK.wood
    ctx.fill()
    ctx.fillStyle = LOOK.brass
    ctx.fillRect(-b.width * 0.3, -lidHeight * 0.95, 6, lidHeight * 0.95)
    ctx.fillRect(b.width * 0.3 - 6, -lidHeight * 0.95, 6, lidHeight * 0.95)
    // Moss on top.
    ctx.fillStyle = LOOK.moss
    ctx.beginPath()
    ctx.ellipse(
      -b.width * 0.12,
      -lidHeight * 0.72,
      b.width * 0.22,
      lidHeight * 0.16,
      -0.15,
      0,
      Math.PI * 2,
    )
    ctx.fill()
    ctx.restore()
  }
  // Gold glinting inside the open chest.
  if (k > 0.01) {
    ctx.save()
    ctx.globalAlpha = k
    ctx.fillStyle = '#f2c766'
    for (const [gx, gr] of [
      [0.32, 4],
      [0.5, 5],
      [0.66, 4],
    ] as const) {
      ctx.beginPath()
      ctx.arc(b.x + b.width * gx, bodyTop + 1, gr, Math.PI, 0)
      ctx.fill()
    }
    ctx.restore()
  }
  ctx.fillStyle = LOOK.barnacle
  for (const [bx, by, r] of [
    [0.1, 0.78, 2.2],
    [0.16, 0.9, 1.6],
    [0.9, 0.7, 1.8],
  ] as const) {
    ctx.beginPath()
    ctx.arc(b.x + b.width * bx, b.y + b.height * by, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/** The open chest's items floating in their slots, and the item being carried (drawn above the creatures). */
export function drawChestItems(
  ctx: CanvasRenderingContext2D,
  world: World,
  motion: MotionSettings,
): void {
  const k = openness(world)
  const b = chestBox(world)
  const from = { x: b.x + b.width / 2, y: b.y + b.height * 0.4 }
  if (k > 0.01) {
    const items = pageItems(world)
    // A new page's items pop in (a quick swell) when the page turns.
    const pop = Math.min(1, (world.time - world.props.chest.pageChangedAt) / 0.25)
    for (let i = 0; i < SLOT_COUNT; i++) {
      const isNext = i === SLOT_COUNT - 1
      const kind = isNext ? null : items[i]
      if (!isNext && !kind) continue // the last page may have fewer items
      const slot = slotPosition(world, i)
      // Float up out of the chest, then bob gently (no bob under reduced motion).
      const bob = Math.sin(world.time * 2 + i) * 2.5 * motion.sway
      const x = from.x + (slot.x - from.x) * k
      const y = from.y + (slot.y - from.y) * k + bob
      ctx.save()
      ctx.globalAlpha = k
      ctx.fillStyle = LOOK.slotFill
      ctx.strokeStyle = LOOK.slotRim
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(x, y, CHEST.slotRadius, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      if (isNext) drawNextArrows(ctx, x, y)
      else if (kind) drawItem(ctx, kind, x, y, canTake(world, kind) ? 1 : 0.3, 0.6 + 0.4 * pop)
      ctx.restore()
    }
    // Page dots under the ↻ circle.
    const next = slotPosition(world, SLOT_COUNT - 1)
    drawPageDots(
      ctx,
      world,
      from.x + (next.x - from.x) * k,
      from.y + (next.y - from.y) * k + CHEST.slotRadius + 10,
      k,
    )
  }
  const carry = world.interaction.carry
  if (carry) {
    const hand = world.presence.position
    drawItem(ctx, carry.kind, hand.x, hand.y, 1, 1.25)
  }
}

function drawItem(
  ctx: CanvasRenderingContext2D,
  kind: PropKind,
  x: number,
  y: number,
  alpha: number,
  scale = 1,
): void {
  if (kind === 'shrimp') drawShrimp(ctx, x + 2, y, scale, 0.15, alpha)
  else if (kind === 'duck') drawDuck(ctx, x, y + 2, scale * 0.95, 1, 0, alpha)
  else if (kind === 'ball') drawBall(ctx, x, y, scale * 1.1, 0.4, alpha)
  else if (isWearable(kind)) drawWearableIcon(ctx, kind, x, y, 18 * scale, 0, alpha)
}

/** The ↻ "next page" circle: two curved arrows chasing each other. */
function drawNextArrows(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.strokeStyle = LOOK.slotRim
  ctx.fillStyle = LOOK.slotRim
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  const r = CHEST.slotRadius * 0.5
  for (const start of [0.2, Math.PI + 0.2]) {
    ctx.beginPath()
    ctx.arc(x, y, r, start, start + 2.3)
    ctx.stroke()
    // Arrowhead at the end of the arc.
    const a = start + 2.3
    const hx = x + Math.cos(a) * r
    const hy = y + Math.sin(a) * r
    const tx = -Math.sin(a)
    const ty = Math.cos(a)
    ctx.beginPath()
    ctx.moveTo(hx + tx * 5, hy + ty * 5)
    ctx.lineTo(hx + Math.cos(a) * 4, hy + Math.sin(a) * 4)
    ctx.lineTo(hx - Math.cos(a) * 4, hy - Math.sin(a) * 4)
    ctx.closePath()
    ctx.fill()
  }
}

/** Page dots: ● for the current page, ○ for the others. */
function drawPageDots(
  ctx: CanvasRenderingContext2D,
  world: World,
  cx: number,
  y: number,
  k: number,
): void {
  const n = CHEST_PAGES.length
  const gap = 10
  ctx.save()
  ctx.globalAlpha = k
  for (let i = 0; i < n; i++) {
    const x = cx + (i - (n - 1) / 2) * gap
    ctx.beginPath()
    ctx.arc(x, y, 3, 0, Math.PI * 2)
    if (i === world.props.chest.page) {
      ctx.fillStyle = LOOK.slotRim
      ctx.fill()
    } else {
      ctx.strokeStyle = LOOK.slotRim
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }
  ctx.restore()
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
