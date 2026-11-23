/**
 * Party lights (tasks #32a, #32c): while the disco ball is out, the pool dims; soft colored spotlight beams sweep down
 * from the surface; mirror-ball spots of light swirl across everything; the disco ball throws rays; the seaweed turns
 * neon and sways to the beat (and more grows); the shells sparkle. The ball itself hangs on top.
 *
 * Everything follows the music via `partyMoment` (one beat clock, one song map): calm in the intro, rising smoothly
 * in the builds (no flashing with the snare roll), pulsing on the beat in the drops, soft in the breakdown.
 *
 * Light safety (WCAG 2.3.1): at most one pulse per beat (~2.1/s at 126 BPM) — under 3 flashes a second, tested;
 * twinkles are slower still; the room's dimming never flickers. Reduced motion: no pulses, sweeps or beat-sway —
 * a calm colored glow.
 */
import { partyMoment, type PartyMoment } from '../simulation/party'
import { chestSceneryEdge, DISCO, discoRadius } from '../simulation/props'
import { floorHeight } from '../simulation/scenery'
import type { World } from '../simulation/world'
import {
  sandLine,
  sceneryAt,
  seaweedDance,
  seaweedStrand,
  underChest,
  type SeaweedDance,
} from './floor'
import type { MotionSettings } from './motion'
import { hash2 } from './noise'

export const LIGHTS = {
  /** How dark the pool gets (0..1 opacity of the dimming layer). */
  dim: 0.5,
  /** Beam colors and how many mirror-ball spots. */
  colors: ['#ff4fd8', '#3de8ff', '#9b6bff', '#ffd24a'],
  spots: 34,
  /** The fastest any light may twinkle (cycles per second) — slower than the beat pulse. */
  maxFlashHz: 0.9,
  /** Disco ball rays: how many, and how far they reach at low / full energy (px). */
  rays: 16,
  rayReach: [180, 620],
  /** Neon seaweed colors; extra clumps that grow during the party — at most `extraSeaweed`, one per `seaweedSpacing`
   *  px of open sand, so a phone gets a few instead of a bunch (task #42) — and how long they take to grow (s). */
  neon: ['#ff4fd8', '#3de8ff', '#7dff5a', '#b06bff'],
  extraSeaweed: 12,
  seaweedSpacing: 95,
  growSeconds: 8,
} as const

/** 0..1 brightness of a twinkling light: a smooth wave no faster than `LIGHTS.maxFlashHz`. */
export function twinkle(time: number, seed: number): number {
  const hz = LIGHTS.maxFlashHz * (0.5 + 0.5 * frac(seed * 0.618)) // each light its own (slow) pace
  return 0.5 + 0.5 * Math.sin((time * hz + frac(seed * 0.371)) * Math.PI * 2)
}

/**
 * How bright the beat makes the lights (≈0.55..1): brighter with the music's energy, plus a swell on each beat where
 * the song pulses (the drops). At most one swell per beat. `motionScale` 0 (reduced motion): no swell.
 */
export function beatGlow(m: PartyMoment, motionScale: number): number {
  return 0.55 + 0.2 * m.energy + 0.25 * m.pulse * m.pulseAmount * motionScale
}

/** A mirror-ball spot's brightness: its slow twinkle, giving way to the beat as the music builds. */
export function spotGlow(time: number, seed: number, m: PartyMoment, motionScale: number): number {
  const beatShare = m.pulseAmount * motionScale
  return (
    (0.35 + 0.65 * twinkle(time, seed)) * (1 - beatShare) + beatGlow(m, motionScale) * beatShare
  )
}

function frac(x: number): number {
  return x - Math.floor(x)
}

/** Behind the creatures (task #32d): dim the pool, then the neon reef glowing on the dimmed floor. */
export function drawPartyBackdrop(
  ctx: CanvasRenderingContext2D,
  world: World,
  width: number,
  height: number,
  motion: MotionSettings,
): void {
  const k = world.party.level
  if (k <= 0.005) return
  ctx.save()
  ctx.fillStyle = `rgba(6, 4, 24, ${LIGHTS.dim * k})`
  ctx.fillRect(0, 0, width, height)
  ctx.globalCompositeOperation = 'lighter'
  drawNeonReef(ctx, world, width, height, motion, partyMoment(world), k)
  ctx.restore()
}

/** In front of the creatures: the beams, the light spots, the rays and the disco ball. */
export function drawPartyLights(
  ctx: CanvasRenderingContext2D,
  world: World,
  width: number,
  height: number,
  motion: MotionSettings,
): void {
  const k = world.party.level
  const ball = world.props.items.find((p) => p.kind === 'discoBall')
  const from = ball ? ball.position : { x: width / 2, y: DISCO.hangY }
  if (k > 0.005) {
    const m = partyMoment(world)
    const moves = motion.partyLights // 0 under reduced motion
    const t = world.time * moves
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    drawBeams(ctx, width, height, t, k, m, moves)
    drawSpots(ctx, from, width, height, t, k, m, moves)
    drawRays(ctx, from, ball ? ball.angle * moves : 0, k, m, moves)
    ctx.restore()
  }
  if (ball) drawDiscoBall(ctx, ball.position.x, ball.position.y, discoRadius(world), ball.angle, 1)
}

/** Soft spotlight beams from the surface: wider, faster sweeps with the energy; a swing on the beat in the drops. */
function drawBeams(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  k: number,
  m: PartyMoment,
  moves: number,
): void {
  const n = LIGHTS.colors.length
  const glow = beatGlow(m, moves)
  for (let i = 0; i < n; i++) {
    const x = ((i + 0.5) / n) * width
    const swing = 0.3 + 0.25 * m.energy
    const onBeat = 0.12 * m.pulseAmount * moves * Math.sin(Math.PI * m.beats * 0.5 + i * 1.3)
    const angle = Math.sin(t * 0.3 + i * 1.9) * swing + onBeat // radians from straight down
    const reach = height * 1.15
    const spread = 0.1 + 0.05 * m.energy
    const tipX = x + Math.sin(angle) * reach
    const tipY = Math.cos(angle) * reach
    const g = ctx.createLinearGradient(x, 0, tipX, tipY)
    const color = LIGHTS.colors[i]!
    g.addColorStop(0, withAlpha(color, 0.42 * k * glow))
    g.addColorStop(1, withAlpha(color, 0))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(x - 6, 0)
    ctx.lineTo(x + Math.sin(angle - spread) * reach, Math.cos(angle - spread) * reach)
    ctx.lineTo(x + Math.sin(angle + spread) * reach, Math.cos(angle + spread) * reach)
    ctx.lineTo(x + 6, 0)
    ctx.closePath()
    ctx.fill()
  }
}

/** Mirror-ball spots: soft lights circling the ball (faster with the energy), twinkling — pulsing in the drops. */
function drawSpots(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  width: number,
  height: number,
  t: number,
  k: number,
  m: PartyMoment,
  moves: number,
): void {
  const far = Math.hypot(width, height)
  const swirl = 0.12 * t + 0.35 * m.energy * moves * Math.sin(m.beats * 0.25)
  for (let i = 0; i < LIGHTS.spots; i++) {
    const a = i * 2.399 + swirl // golden-angle spread, turning with the ball
    const r = far * (0.15 + 0.8 * frac(i * 0.618))
    const x = from.x + Math.cos(a) * r
    const y = from.y + Math.abs(Math.sin(a)) * r * 0.75 // spots land below the ball
    if (x < -20 || x > width + 20 || y > height + 20) continue
    const size = (11 + 11 * frac(i * 0.29)) * (0.9 + 0.3 * m.energy)
    const b = spotGlow(t, i + 1, m, moves) * k
    const g = ctx.createRadialGradient(x, y, 0, x, y, size)
    const color = LIGHTS.colors[i % LIGHTS.colors.length]!
    g.addColorStop(0, withAlpha('#ffffff', 0.75 * b))
    g.addColorStop(0.45, withAlpha(color, 0.55 * b))
    g.addColorStop(1, withAlpha(color, 0))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, size, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Rays of light shooting out of the disco ball, turning as it spins: faint in the intro, long and bright in drops. */
function drawRays(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  spin: number,
  k: number,
  m: PartyMoment,
  moves: number,
): void {
  const [near, farReach] = LIGHTS.rayReach
  const reach = near + (farReach - near) * m.energy
  const glow = beatGlow(m, moves)
  for (let i = 0; i < LIGHTS.rays; i++) {
    const a = spin * 0.8 + (i / LIGHTS.rays) * Math.PI * 2 + hash2(i, 700) * 0.2
    const len = reach * (0.6 + 0.4 * hash2(i, 701))
    const half = 0.012 + 0.01 * hash2(i, 702) // a thin wedge
    const color = LIGHTS.colors[i % LIGHTS.colors.length]!
    const g = ctx.createLinearGradient(
      from.x,
      from.y,
      from.x + Math.cos(a) * len,
      from.y + Math.sin(a) * len,
    )
    g.addColorStop(0, withAlpha('#ffffff', (0.1 + 0.25 * m.energy) * k * glow))
    g.addColorStop(0.25, withAlpha(color, (0.08 + 0.2 * m.energy) * k * glow))
    g.addColorStop(1, withAlpha(color, 0))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(from.x + Math.cos(a - half) * len, from.y + Math.sin(a - half) * len)
    ctx.lineTo(from.x + Math.cos(a + half) * len, from.y + Math.sin(a + half) * len)
    ctx.closePath()
    ctx.fill()
  }
}

/** The neon reef: the seaweed glows in party colors (and extra clumps grow), the shells get colored halos and glints. */
function drawNeonReef(
  ctx: CanvasRenderingContext2D,
  world: World,
  width: number,
  height: number,
  motion: MotionSettings,
  m: PartyMoment,
  k: number,
): void {
  const moves = motion.partyLights
  const time = world.time * motion.background
  const dance = seaweedDance(world, motion)
  const top = height - floorHeight(height)
  const glow = beatGlow(m, moves)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const item of world.scenery) {
    const { x, y } = sceneryAt(item, width, height)
    if (underChest(item, x)) continue // not drawn on the floor either (floor.ts)
    if (item.kind === 'seaweed') {
      neonClump(ctx, item, x, sandLine(x, top) + 6, time, dance, k * glow)
    } else if (item.kind === 'shell') {
      drawShellSparkle(ctx, item.id, x, y, item.size, world.time * moves, k, glow)
    }
  }
  // Extra clumps sprout along the sand during the party (fixed spots; they grow in, and shrink as it ends).
  const grow = Math.min(1, Math.max(0, (world.time - world.party.since) / LIGHTS.growSeconds)) * k
  if (grow > 0.01) {
    // Spread over the sand between the chest and the right edge (task #42) — right up to the chest, never over it.
    const { left, right } = neonSpan(width)
    const count = neonClumpCount(width)
    const step = count > 1 ? (right - left) / (count - 1) : 0
    for (let i = 0; i < count; i++) {
      const jitter = (hash2(i, 901) - 0.5) * 0.4 * step
      const x = Math.max(left, Math.min(right, left + i * step + jitter))
      const size = (45 + 70 * hash2(i, 902)) * easeOut(grow)
      neonClump(ctx, { id: 1000 + i, size }, x, sandLine(x, top) + 6, time, dance, k * glow)
    }
  }
}

/** How far (px) an extra neon clump spreads sideways from its root (its strands and their sway). */
const NEON_REACH = 24

/** Where the extra neon clumps may root (px): from just right of the chest to near the right edge. */
function neonSpan(width: number): { left: number; right: number } {
  const left = chestSceneryEdge() + NEON_REACH
  return { left, right: Math.max(left, width - NEON_REACH) }
}

/** How many extra neon clumps grow during the party: one per `LIGHTS.seaweedSpacing` px of open sand (at least one),
 *  at most `extraSeaweed`. */
export function neonClumpCount(width: number): number {
  const { left, right } = neonSpan(width)
  return Math.min(LIGHTS.extraSeaweed, Math.floor((right - left) / LIGHTS.seaweedSpacing) + 1)
}

function easeOut(x: number): number {
  return 1 - (1 - x) * (1 - x)
}

/** One clump of three neon strands: a wide soft glow under a bright core. */
function neonClump(
  ctx: CanvasRenderingContext2D,
  item: { id: number; size: number },
  x: number,
  rootY: number,
  time: number,
  dance: SeaweedDance,
  b: number,
): void {
  for (let s = 0; s < 3; s++) {
    const points = seaweedStrand(item, s, x, rootY, time, dance)
    const color = LIGHTS.neon[(item.id + s) % LIGHTS.neon.length]!
    for (const [width, alpha] of [
      [11 - s * 2, 0.16],
      [4 - s, 0.85],
    ] as const) {
      ctx.strokeStyle = withAlpha(color, alpha * b)
      ctx.lineWidth = width
      ctx.beginPath()
      for (const [px, py] of points) ctx.lineTo(px, py)
      ctx.stroke()
    }
  }
}

/** A shell's party glow: a colored halo (brighter on the beat in the drops) and two little twinkling glints. */
function drawShellSparkle(
  ctx: CanvasRenderingContext2D,
  id: number,
  x: number,
  y: number,
  size: number,
  t: number,
  k: number,
  glow: number,
): void {
  const color = LIGHTS.neon[id % LIGHTS.neon.length]!
  const r = size * 2.4
  const halo = ctx.createRadialGradient(x, y - size * 0.3, 0, x, y - size * 0.3, r)
  halo.addColorStop(0, withAlpha(color, 0.45 * k * glow))
  halo.addColorStop(1, withAlpha(color, 0))
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(x, y - size * 0.3, r, 0, Math.PI * 2)
  ctx.fill()
  for (let j = 0; j < 2; j++) {
    const b = twinkle(t, id * 3 + j) * k
    const gx = x + (hash2(id, 800 + j) - 0.5) * size * 1.4
    const gy = y - size * (0.2 + 0.6 * hash2(id, 810 + j))
    const s = 2 + 4 * b
    ctx.fillStyle = withAlpha('#ffffff', 0.9 * b)
    ctx.beginPath()
    ctx.moveTo(gx, gy - s)
    ctx.lineTo(gx + s * 0.22, gy)
    ctx.lineTo(gx, gy + s)
    ctx.lineTo(gx - s * 0.22, gy)
    ctx.closePath()
    ctx.moveTo(gx - s, gy)
    ctx.lineTo(gx, gy - s * 0.22)
    ctx.lineTo(gx + s, gy)
    ctx.lineTo(gx, gy + s * 0.22)
    ctx.closePath()
    ctx.fill()
  }
}

/** A disco ball at (x, y), radius r: mirrored tiles in rows that slide round as it spins, a few glints, a hook. */
export function drawDiscoBall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  spin: number,
  alpha: number,
): void {
  ctx.save()
  ctx.globalAlpha = alpha
  // The hook on top.
  ctx.strokeStyle = '#b9c2cc'
  ctx.lineWidth = Math.max(1.5, r * 0.08)
  ctx.beginPath()
  ctx.arc(x, y - r - r * 0.18, r * 0.16, 0, Math.PI * 2)
  ctx.stroke()
  // The sphere: a grey gradient, then the tiles.
  const body = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r)
  body.addColorStop(0, '#f4f7fa')
  body.addColorStop(1, '#6f7d8c')
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = body
  ctx.fill()
  ctx.save()
  ctx.clip()
  const rows = 7
  for (let row = 0; row < rows; row++) {
    const lat = -Math.PI / 2 + ((row + 0.5) / rows) * Math.PI // −90°..90°
    const ty = y + Math.sin(lat) * r
    const ring = Math.cos(lat) * r // this row's radius
    const cols = 10
    for (let c = 0; c < cols; c++) {
      const lon = spin + (c / cols) * Math.PI * 2 + row * 0.3
      const front = Math.cos(lon)
      if (front <= 0) continue // round the back
      const tx = x + Math.sin(lon) * ring
      const w = Math.max(0.8, (ring * Math.PI * 2 * front) / cols - 1)
      const h = (Math.PI * r) / rows - 1
      const shade = 0.45 + 0.55 * frac(Math.sin((row * 13 + c) * 12.9898) * 43758.5)
      ctx.fillStyle = `rgba(${Math.round(150 + 105 * shade)}, ${Math.round(160 + 95 * shade)}, ${Math.round(175 + 80 * shade)}, 0.9)`
      ctx.fillRect(tx - w / 2, ty - h / 2, w, h)
    }
  }
  ctx.restore()
  // Glints: two soft little stars that come and go slowly (no flashing).
  ctx.globalCompositeOperation = 'lighter'
  for (const [gx, gy, seed] of [
    [-0.4, -0.45, 1],
    [0.35, 0.1, 2],
  ] as const) {
    const b = twinkle(spin * 1.7, seed)
    const s = r * 0.28 * (0.5 + 0.5 * b)
    ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * b})`
    ctx.beginPath()
    ctx.moveTo(x + gx * r, y + gy * r - s)
    ctx.lineTo(x + gx * r + s * 0.2, y + gy * r)
    ctx.lineTo(x + gx * r, y + gy * r + s)
    ctx.lineTo(x + gx * r - s * 0.2, y + gy * r)
    ctx.closePath()
    ctx.moveTo(x + gx * r - s, y + gy * r)
    ctx.lineTo(x + gx * r, y + gy * r - s * 0.2)
    ctx.lineTo(x + gx * r + s, y + gy * r)
    ctx.lineTo(x + gx * r, y + gy * r + s * 0.2)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

/** '#rrggbb' + alpha → 'rgba(…)'. */
function withAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, a))})`
}
