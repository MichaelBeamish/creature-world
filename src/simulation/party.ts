/**
 * The party (task #32): while the disco ball is out (in the water or in the visitor's hand), the party is on.
 *
 * One beat clock for everything — lights (32a), music (32b), the neon reef (32c) and dancing (32d) all read
 * `beatsAt`, so they stay in sync. `level` fades 0 → 1 as the party starts (the lights dim) and back as it ends.
 */
import type { World } from './world'

export const PARTY = {
  /** Tempo (beats per minute) — deep house / tech house. */
  bpm: 126,
  /** Seconds for the party to fade fully in (lights dim) and out (lights come back up). */
  fadeIn: 2.5,
  fadeOut: 2,
} as const

export interface Party {
  on: boolean
  /** World time the party (and its beat clock) started. */
  since: number
  /** 0..1 — how far the party has faded in. */
  level: number
}

export function createParty(): Party {
  return { on: false, since: -Infinity, level: 0 }
}

/** Is the disco ball out — in the water or being carried? */
export function discoBallOut(world: World): boolean {
  return (
    world.interaction.carry?.kind === 'discoBall' ||
    world.props.items.some((p) => p.kind === 'discoBall')
  )
}

/** Beats since the party started (fractional: 3.5 = halfway between the 4th and 5th beat); 0 when off. */
export function beatsAt(world: World): number {
  const party = world.party
  if (!party.on) return 0
  return ((world.time - party.since) * PARTY.bpm) / 60
}

/** Advance one fixed step: switch on/off with the disco ball, and fade the level. */
export function stepParty(world: World, dt: number): void {
  const party = world.party
  const out = discoBallOut(world)
  if (out && !party.on) party.since = world.time
  party.on = out
  const rate = out ? 1 / PARTY.fadeIn : -1 / PARTY.fadeOut
  party.level = Math.max(0, Math.min(1, party.level + rate * dt))
}
