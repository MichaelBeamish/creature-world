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

export interface MindState {
  emotion: EmotionState
  intent: IntentKind
  /** Peeking alternates creeping in and darting back out. */
  peekPhase: 'in' | 'out'
  /** Where a hiding creature is heading (chosen when it starts hiding). */
  hideTarget: Vec2
  /** The food it's going for (task #28): which prop, and a timer (a Scaredy's wait / a Grumpy's guard). */
  meal: { propId: number; timer: number } | null
}

export function createMindState(): MindState {
  return {
    emotion: createEmotionState(),
    intent: 'wander',
    peekPhase: 'in',
    hideTarget: vec2(),
    meal: null,
  }
}
