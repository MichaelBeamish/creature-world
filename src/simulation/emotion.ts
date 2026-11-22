/**
 * Emotions: how a creature *feels* about what it perceives, given its personality.
 *
 * 1. Utility scoring — each emotion gets a 0..1 target score from perception × traits.
 * 2. Smoothing     — levels follow their targets with a fast attack / slow release envelope.
 * 3. Hysteresis    — a new dominant emotion must beat the current one by a margin and the current
 *                    one must have been held a minimum time (no flicker). Fear is a reflex: it
 *                    takes over immediately whenever it is the strongest.
 */
import type { Perception } from './perception'
import type { Traits } from './traits'

export type EmotionKind = 'content' | 'curious' | 'scared' | 'grumpy'

export const EMOTION_KINDS: readonly EmotionKind[] = ['content', 'curious', 'scared', 'grumpy']

export type EmotionLevels = Record<EmotionKind, number>

export interface EmotionState {
  /** The dominant emotion right now. */
  kind: EmotionKind
  /** Smoothed 0..1 level of every emotion. */
  levels: EmotionLevels
  /** Seconds the current dominant emotion has been held. */
  heldFor: number
}

export const EMOTION = {
  /** Content is the calm default every other emotion has to beat. */
  contentBaseline: 0.3,
  /** Everyone flinches a little at a sudden movement, however bold. */
  flinch: 0.25,
  /** Being watched by a not-yet-trusted visitor feeds wariness. */
  wariness: 0.5,
  /** A rattled creature (it inked, task #21) loses this much of its curiosity — it comes back as that fades. */
  rattledDamp: 0.8,
  /** …and a bold, incurious one (the Grumpy) holds a grudge: being rattled keeps it this grumpy (× its dials). */
  grudge: 0.6,
  /** Envelope time constants (s). */
  attack: 0.1,
  release: 0.6,
  /** Hysteresis: a challenger must win by this much, after the current emotion was held this long (s). */
  switchMargin: 0.08,
  minHold: 0.6,
} as const

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

export function createEmotionState(): EmotionState {
  return {
    kind: 'content',
    levels: { content: EMOTION.contentBaseline, curious: 0, scared: 0, grumpy: 0 },
    // A new creature has been calm "forever": it may change mood right away (hysteresis only
    // delays switching *after* a recent change).
    heldFor: EMOTION.minHold,
  }
}

/** Target scores (utility) for each emotion. Pure: same perception + traits → same scores. */
export function scoreEmotions(perception: Perception, traits: Traits): EmotionLevels {
  const { attention, trust, pressure, startle, rattled } = perception
  const { curiosity, boldness } = traits
  const disturbance = clamp01(startle + pressure)
  const wary = attention * (1 - trust) * EMOTION.wariness

  return {
    content: EMOTION.contentBaseline,
    curious: clamp01(
      attention *
        curiosity *
        (0.6 + 0.4 * trust) *
        (1 - startle) *
        (1 - EMOTION.rattledDamp * rattled),
    ),
    // Total threat is capped at 1 before timidity scales it, so stacked threats can't overflow.
    scared: clamp01(clamp01(disturbance + wary) * (1 - boldness) + startle * EMOTION.flinch),
    grumpy: clamp01((disturbance + rattled * EMOTION.grudge) * boldness * (1 - curiosity)),
  }
}

/** The strongest emotion in a set of levels. */
export function strongest(levels: EmotionLevels): EmotionKind {
  let best: EmotionKind = 'content'
  for (const kind of EMOTION_KINDS) if (levels[kind] > levels[best]) best = kind
  return best
}

/** Advance one fixed step. Mutates `state` in place. */
export function stepEmotion(
  state: EmotionState,
  perception: Perception,
  traits: Traits,
  dt: number,
): void {
  const targets = scoreEmotions(perception, traits)
  for (const kind of EMOTION_KINDS) {
    const level = state.levels[kind]
    const tau = targets[kind] > level ? EMOTION.attack : EMOTION.release
    state.levels[kind] = level + (targets[kind] - level) * (1 - Math.exp(-dt / tau))
  }

  state.heldFor += dt

  // Fear reflex: judged on the *targets* (what it should feel right now), so it doesn't wait for the
  // smoothed level to catch up. A bold creature whose strongest target is grumpy doesn't flinch-flee.
  if (state.kind !== 'scared' && strongest(targets) === 'scared') {
    state.kind = 'scared'
    state.heldFor = 0
    return
  }

  const challenger = strongest(state.levels)
  if (challenger === state.kind) return
  const winsClearly =
    state.heldFor >= EMOTION.minHold &&
    state.levels[challenger] > state.levels[state.kind] + EMOTION.switchMargin
  if (winsClearly) {
    state.kind = challenger
    state.heldFor = 0
  }
}
