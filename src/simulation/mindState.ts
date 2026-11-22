/**
 * The mind's state as plain data (kept apart from mind.ts so creature.ts can create it without an import cycle).
 */
import { createEmotionState, type EmotionState } from './emotion'
import { vec2, type Vec2 } from './vec2'

/** What the creature is trying to do. Movement turns this into steering forces. */
export type IntentKind =
  | 'wander'
  | 'rest'
  | 'approach'
  | 'peek'
  | 'flee'
  | 'hide'
  | 'standoff'
  /** Overrides from the visitor's interaction (the mind's choice is set aside; emotions keep updating): */
  /** being held by the visitor */
  | 'held'
  /** a mad Grumpy chasing the hand after inking (task #27) */
  | 'chase'
  /** a Friendly dizzy after being shaken (task #27) */
  | 'dizzy'
  /** Feeding (task #28): going for a shrimp / a Grumpy guarding one */
  | 'eat'
  | 'guard'
  /** Playing with a toy (task #29): fetch / nudge / keeping away from it */
  | 'play'
  /** Going to pick up a dropped wearable to put it on (task #33) */
  | 'collect'

export interface MindState {
  emotion: EmotionState
  intent: IntentKind
  /** Peeking alternates creeping in and darting back out. */
  peekPhase: 'in' | 'out'
  /** Where a hiding creature is heading (chosen when it starts hiding). */
  hideTarget: Vec2
  /** The food it's going for (task #28): which prop, and a timer (a Scaredy's wait / a Grumpy's guard). */
  meal: { propId: number; timer: number } | null
  /** The toy it's playing with (task #29): which, since when, and whether it's going for it or backing off. */
  play: { propId: number; since: number; phase: 'go' | 'back'; phaseSince: number } | null
  /** A dropped wearable it's going to pick up and put on (task #33). */
  collect: { propId: number } | null
  /** Bored of toys until this world time; when a Grumpy last swatted a toy. */
  playBoredUntil: number
  swattedAt: number
}

export function createMindState(): MindState {
  return {
    emotion: createEmotionState(),
    intent: 'wander',
    peekPhase: 'in',
    hideTarget: vec2(),
    meal: null,
    play: null,
    collect: null,
    playBoredUntil: -Infinity,
    swattedAt: -Infinity,
  }
}
