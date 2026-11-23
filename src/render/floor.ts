/**
 * The "Moonlit reef" sea floor: cool blue-grey sand, dark mossy rocks, softly glowing shells and
 * gently swaying seaweed. Reads `world.scenery` (relative positions) and maps it to the current size.
 *
 * Pure function of (scenery, size, time): grain and shapes come from the stateless `hash2`, the
 * seaweed sway from time — so nothing flickers and nothing is stored. Reduced motion: seaweed holds still.
 * During the party (task #32c) the seaweed sways to the beat instead; the neon layer (party.ts) traces the same
 * strands (`seaweedStrand`) on top, after the room dims.
 */
import { floorHeight, type SceneryItem } from '../simulation/scenery'
import { beatsAt } from '../simulation/party'
import { chestCovers } from '../simulation/props'
import type { World } from '../simulation/world'
import type { MotionSettings } from './motion'
import { hash2 } from './noise'

const LOOK = {
  sandTop: '#5d7584',
  sandBottom: '#3b5160',
  grain: '#a5bfcc',
  rockDark: '#2a3a44',
  rockLight: '#4f6b78',
  moss: ['rgba(96, 160, 118, 0.55)', 'rgba(70, 132, 100, 0.5)', 'rgba(120, 176, 128, 0.45)'],
  shellGlow: 'rgba(200, 240, 255, 0.7)',
  seaweed: ['#3f8f6f', '#4f9c7a', '#3a8466'],
} as const

/** Sand-line wobble: a gentle, static wave along the top of the sand (px). */
export function sandLine(x: number, top: number): number {
  return top + Math.sin(x * 0.012) * 5 + Math.sin(x * 0.031 + 1.3) * 3
}

export function drawFloor(
  ctx: CanvasRenderingContext2D,
  world: World,
  width: number,
  height: number,
  motion: MotionSettings,
): void {
  const floor = floorHeight(height)
  const top = height - floor
  const time = world.time * motion.background

  drawSand(ctx, width, height, top)

  // Back to front: items deeper in the sand band (closer to the viewer) are drawn last.
  const items = [...world.scenery].sort((a, b) => a.depth - b.depth)
  const dance = seaweedDance(world, motion)
  for (const item of items) {
    const { x, y } = sceneryAt(item, width, height)
    if (underChest(item, x)) continue
    if (item.kind === 'seaweed') drawSeaweed(ctx, item, x, sandLine(x, top) + 6, time, dance)
    else if (item.kind === 'rock') drawRock(ctx, item, x, y)
    else drawShell(ctx, item, x, y)
  }
}

/** How far (px) a seaweed clump spreads sideways from its root: the outer strands plus their sway. */
const SEAWEED_REACH = 24

/**
 * Is this scenery item (at `x` on screen) in the chest's corner (task #42)? Then it isn't drawn: a rock or shell would
 * poke out from under the chest, and seaweed (and its party neon) would grow in front of it. Decided at draw time,
 * since scenery positions are fractions of the width — on a narrow phone, more of it falls in the chest's corner.
 */
export function underChest(item: SceneryItem, x: number): boolean {
  const reach =
    item.kind === 'rock' ? item.size * 1.5 : item.kind === 'shell' ? item.size : SEAWEED_REACH
  return chestCovers(x, reach)
}

/** Where a scenery item sits on screen (px). */
export function sceneryAt(
  item: SceneryItem,
  width: number,
  height: number,
): { x: number; y: number } {
  const floor = floorHeight(height)
  const top = height - floor
  return { x: item.u * width, y: top + 10 + item.depth * Math.max(0, floor - 22) }
}

/** How the seaweed dances: the beat clock, and how much it sways to the beat (0 = its usual drift). */
export interface SeaweedDance {
  beats: number
  mix: number
}

export function seaweedDance(world: World, motion: MotionSettings): SeaweedDance {
  return { beats: beatsAt(world), mix: world.party.level * motion.partyLights }
}

/** The points of seaweed strand `k` (0..2) of a clump rooted at (x, rootY): its usual drift, blended into a
 *  side-to-side sway on the beat (one swing per two beats) as the party fades in. */
export function seaweedStrand(
  item: { id: number; size: number },
  k: number,
  x: number,
  rootY: number,
  time: number,
  dance: SeaweedDance,
): [number, number][] {
  const len = item.size * (0.75 + k * 0.15)
  const phase = time * (0.6 + hash2(item.id, k) * 0.4) + item.id + k
  const baseX = x + (k - 1) * 7
  const points: [number, number][] = [[baseX, rootY]]
  for (let t = 0.1; t <= 1.0001; t += 0.1) {
    // Sway grows toward the tip; a phase lag along the strand makes it ripple upward.
    const drift = Math.sin(phase - t * 2.2) * 9 * t + Math.sin(t * 5 + k) * 3 * t
    const onBeat =
      Math.sin(Math.PI * dance.beats + item.id * 0.7 + k * 0.4 - t * 1.6) * 13 * t +
      Math.sin(t * 5 + k) * 3 * t
    points.push([baseX + drift * (1 - dance.mix) + onBeat * dance.mix, rootY - len * t])
  }
  return points
}

function drawSand(ctx: CanvasRenderingContext2D, width: number, height: number, top: number): void {
  ctx.beginPath()
  ctx.moveTo(0, height)
  for (let x = 0; x <= width + 20; x += 20) ctx.lineTo(x, sandLine(x, top))
  ctx.lineTo(width, height)
  ctx.closePath()
  const sand = ctx.createLinearGradient(0, top - 8, 0, height)
  sand.addColorStop(0, LOOK.sandTop)
  sand.addColorStop(1, LOOK.sandBottom)
  ctx.fillStyle = sand
  ctx.fill()

  // Grain: faint specks, deterministic per index, scaled with the sand area (capped).
  const count = Math.min(420, Math.round((width * (height - top)) / 450))
  ctx.fillStyle = LOOK.grain
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = 0.18 + hash2(i, 31) * 0.3
    const gx = hash2(i, 32) * width
    const gy = sandLine(gx, top) + 6 + hash2(i, 33) * (height - top - 8)
    ctx.fillRect(gx, gy, 1.5, 1.5)
  }
  ctx.globalAlpha = 1
}

const ROCK_STEPS = 14

/** Point on the rock's irregular top outline at step `i` (0..ROCK_STEPS), left to right. */
function rockOutline(item: SceneryItem, x: number, y: number, i: number): [number, number] {
  const a = Math.PI + (i / ROCK_STEPS) * Math.PI
  const rr = item.size * (0.85 + hash2(item.id, i) * 0.3)
  return [x + Math.cos(a) * rr * 1.3, y + Math.sin(a) * rr * 0.75]
}

/** A rounded, slightly irregular dome with top-left light and patchy moss growing on its crown. */
function drawRock(ctx: CanvasRenderingContext2D, item: SceneryItem, x: number, y: number): void {
  const r = item.size
  const outline = new Path2D()
  for (let i = 0; i <= ROCK_STEPS; i++) outline.lineTo(...rockOutline(item, x, y, i))
  outline.closePath()

  const shade = ctx.createRadialGradient(x - r * 0.45, y - r * 0.55, 2, x, y - r * 0.15, r * 1.5)
  shade.addColorStop(0, LOOK.rockLight)
  shade.addColorStop(1, LOOK.rockDark)
  ctx.fillStyle = shade
  ctx.fill(outline)

  // Moss: a few small, irregular patches sitting on the actual top edge, clipped to the rock — so it
  // follows the rock's contour and can never stick out past it (no floating oval).
  ctx.save()
  ctx.clip(outline)
  const patches = 3 + Math.floor(hash2(item.id, 40) * 4) // 3–6
  for (let k = 0; k < patches; k++) {
    // Pick spots along the upper middle of the outline (not the low sides).
    const step = 3 + Math.floor(hash2(item.id, 50 + k) * (ROCK_STEPS - 6))
    const [px, py] = rockOutline(item, x, y, step)
    const pr = r * (0.12 + hash2(item.id, 60 + k) * 0.12)
    ctx.fillStyle = LOOK.moss[k % LOOK.moss.length]!
    ctx.beginPath()
    ctx.ellipse(
      px,
      py + pr * 0.35,
      pr * 1.3,
      pr,
      hash2(item.id, 70 + k) * 0.6 - 0.3,
      0,
      Math.PI * 2,
    )
    ctx.fill()
  }
  ctx.restore()
}

/** Scallop (variant < 0.5) or spiral shell, with a soft moonlit glow. */
function drawShell(ctx: CanvasRenderingContext2D, item: SceneryItem, x: number, y: number): void {
  const s = item.size
  ctx.save()
  ctx.shadowColor = LOOK.shellGlow
  ctx.shadowBlur = 12
  if (item.variant < 0.5) {
    ctx.translate(x, y)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, s, Math.PI * 1.1, Math.PI * 1.9)
    ctx.closePath()
    const fill = ctx.createRadialGradient(0, 0, 1, 0, 0, s)
    fill.addColorStop(0, '#f4fbff')
    fill.addColorStop(1, '#bfe3f0')
    ctx.fillStyle = fill
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.strokeStyle = 'rgba(40, 70, 90, 0.25)'
    ctx.lineWidth = 1
    for (let k = 1; k < 6; k++) {
      const a = Math.PI * (1.1 + (0.8 * k) / 6)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s)
      ctx.stroke()
    }
  } else {
    ctx.translate(x, y - s * 0.4)
    ctx.fillStyle = '#e8f6fb'
    ctx.beginPath()
    ctx.ellipse(0, 0, s * 0.8, s * 0.55, -0.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.strokeStyle = '#8fb7c8'
    ctx.lineWidth = 1.6
    ctx.beginPath()
    for (let t = 0; t < 14; t += 0.25) {
      const rr = s * 0.055 * t
      ctx.lineTo(Math.cos(t) * rr * 0.9, Math.sin(t) * rr * 0.6)
    }
    ctx.stroke()
  }
  ctx.restore()
}

/** Three strands rooted at the sand line, swaying with a traveling wave (still under reduced motion). */
function drawSeaweed(
  ctx: CanvasRenderingContext2D,
  item: SceneryItem,
  x: number,
  rootY: number,
  time: number,
  dance: SeaweedDance,
): void {
  ctx.lineCap = 'round'
  for (let k = 0; k < 3; k++) {
    ctx.strokeStyle = LOOK.seaweed[k % LOOK.seaweed.length]!
    ctx.lineWidth = 5 - k
    ctx.beginPath()
    for (const [px, py] of seaweedStrand(item, k, x, rootY, time, dance)) ctx.lineTo(px, py)
    ctx.stroke()
  }
}
