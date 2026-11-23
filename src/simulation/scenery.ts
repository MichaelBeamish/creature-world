/**
 * The sea floor: how tall the sand is, where creatures can swim, and the rocks / shells / seaweed on it.
 *
 * Scenery is plain data — not pixels — so a future mind can find "the nearest rock" (roadmap #10).
 * Positions are relative (`u` across the width, `depth` into the sand band), so resizing the window
 * keeps the layout instead of reshuffling it.
 *
 * Scenery gets its OWN seeded random stream (derived from the world seed), so adding or tuning scenery
 * never changes the creatures' random draws (traits, hues, spawn attempts).
 */
import type { Bounds } from './creature'
import { createRng, int, range, type Rng } from './rng'

export type SceneryKind = 'rock' | 'shell' | 'seaweed'

export interface SceneryItem {
  id: number
  kind: SceneryKind
  /** Horizontal position, 0 (left edge) .. 1 (right edge). */
  u: number
  /** How far into the sand band, 0 (back, at the sand line) .. 1 (front, bottom of the screen). */
  depth: number
  /** Size in px (rock/shell radius, seaweed height). */
  size: number
  /** 0..1 — per-item look variation (shape, shell type, color). */
  variant: number
}

export const FLOOR = {
  /** Sand height as a fraction of the window height, clamped to [min, max] px. */
  fraction: 0.15,
  min: 70,
  max: 130,
  /** Never more than this fraction of a (tiny) window. */
  maxFraction: 0.3,
  /** How far below the sand line a creature's footprint may reach, so tentacles rest on the sand (px). */
  tentacleAllowance: 18,
} as const

/**
 * Small screens (task #42): phones and small windows, judged by the window's *shorter* side, so a phone counts as
 * small in portrait and landscape alike. Below `small` px, things shrink smoothly, down to their minimum scale at
 * `smallest` px.
 */
export const SCREEN = {
  small: 600,
  smallest: 390,
  /** Creatures at the smallest screen (× their usual size). */
  minCreatureScale: 0.65,
  /** Toys and the disco ball at the smallest screen (× their usual size). */
  minPropScale: 0.8,
} as const

/** True when the window's shorter side is under `SCREEN.small` px. */
export function isSmallScreen(width: number, height: number): boolean {
  return Math.min(width, height) < SCREEN.small
}

/** 1 on large screens, easing down to `min` as the shorter side shrinks from `SCREEN.small` to `SCREEN.smallest`. */
function screenScale(width: number, height: number, min: number): number {
  const t = (Math.min(width, height) - SCREEN.smallest) / (SCREEN.small - SCREEN.smallest)
  return min + (1 - min) * Math.min(1, Math.max(0, t))
}

/** How big creatures are drawn for this window (× their usual size): 1 on large screens, down to 0.65. */
export function creatureScale(width: number, height: number): number {
  return screenScale(width, height, SCREEN.minCreatureScale)
}

/** How big toys and the disco ball are for this window (× their usual size): 1 on large screens, down to 0.8. */
export function propScale(width: number, height: number): number {
  return screenScale(width, height, SCREEN.minPropScale)
}

export const SCENERY = {
  /** How many of each kind (inclusive ranges). */
  rocks: [2, 4],
  shells: [2, 4],
  seaweed: [2, 4],
  /** Sizes in px. */
  rockSize: [18, 34],
  shellSize: [12, 20],
  seaweedHeight: [50, 100],
  /** Items of the same kind keep at least this far apart (fraction of the width). */
  minGap: 0.06,
  /** Nothing is placed left of this (fraction of the width): the treasure chest's corner (task #28). */
  chestClear: 0.16,
  /** Shells keep at least this far from any rock, so none ends up half-hidden behind one. */
  shellRockGap: 0.09,
  /** XOR'd into the world seed to get the independent scenery stream. */
  streamSalt: 0x5eaf1004,
} as const

/** Height of the sand band for a window of the given height (px). */
export function floorHeight(height: number): number {
  const wanted = Math.min(FLOOR.max, Math.max(FLOOR.min, Math.round(height * FLOOR.fraction)))
  return Math.min(wanted, Math.floor(height * FLOOR.maxFraction))
}

/** The swimmable area: the window minus the sand, plus a little allowance so tentacles rest on the sand. */
export function swimBounds(bounds: Bounds): Bounds {
  const floor = floorHeight(bounds.height)
  return {
    width: bounds.width,
    height: bounds.height - floor + Math.min(FLOOR.tentacleAllowance, floor),
  }
}

/** Seeded, deterministic scenery for a world seed (independent of window size). */
export function createScenery(seed: number): SceneryItem[] {
  const rng = createRng(seed ^ SCENERY.streamSalt)
  const items: SceneryItem[] = []
  const add = (
    kind: SceneryKind,
    count: readonly [number, number],
    size: readonly [number, number],
    depth: [number, number],
    /** Positions of other kinds to keep clear of, and how far. If no clear spot exists, the item is skipped. */
    avoid: { at: readonly number[]; gap: number } = { at: [], gap: 0 },
  ) => {
    const placed: number[] = []
    for (let i = int(rng, count[0], count[1]); i > 0; i--) {
      const u = spacedPosition(rng, placed, avoid)
      // A hard rule (e.g. shells never under rocks): skip rather than place it badly.
      if (avoid.at.some((t) => Math.abs(t - u) < avoid.gap)) continue
      placed.push(u)
      items.push({
        id: items.length + 1,
        kind,
        u,
        depth: range(rng, depth[0], depth[1]),
        size: range(rng, size[0], size[1]),
        variant: range(rng, 0, 1),
      })
    }
  }
  add('seaweed', SCENERY.seaweed, SCENERY.seaweedHeight, [0, 0.15]) // rooted near the back
  add('rock', SCENERY.rocks, SCENERY.rockSize, [0.05, 0.4])
  const rocks = items.filter((i) => i.kind === 'rock').map((i) => i.u)
  add('shell', SCENERY.shells, SCENERY.shellSize, [0.25, 0.75], {
    at: rocks,
    gap: SCENERY.shellRockGap,
  })
  return items
}

/**
 * A position across the width (kept off the very edges), at least `minGap` from same-kind items and
 * `avoid.gap` from the positions in `avoid.at`. Rejection sampling; if the floor is too crowded to satisfy
 * every rule, keeps the candidate with the most clearance (never loops forever).
 */
function spacedPosition(
  rng: Rng,
  taken: readonly number[],
  avoid: { at: readonly number[]; gap: number },
): number {
  const clearance = (u: number) =>
    Math.min(
      ...taken.map((t) => Math.abs(t - u) - SCENERY.minGap),
      ...avoid.at.map((t) => Math.abs(t - u) - avoid.gap),
      Infinity,
    )
  let best = range(rng, SCENERY.chestClear, 0.96)
  for (let attempt = 0; attempt < 40 && clearance(best) < 0; attempt++) {
    const candidate = range(rng, SCENERY.chestClear, 0.96)
    if (clearance(candidate) > clearance(best)) best = candidate
  }
  return best
}
