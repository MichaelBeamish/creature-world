/**
 * How much *decorative* motion to draw. With the OS "reduce motion" setting on, purely decorative
 * movement is toned down, while wandering and reactions — the actual content — stay.
 */
export interface MotionSettings {
  /** Tentacle sway amplitude multiplier. */
  sway: number
  /** Breathing squash/stretch multiplier. */
  breath: number
  /** Body lean multiplier. */
  lean: number
  /** Tentacle trailing multiplier. */
  trail: number
  /** Emotes pop in with an overshoot (true) or simply fade in (false). */
  emotePop: boolean
  /** Emote float distance multiplier. */
  emoteFloat: number
  /** Background animation speed (0 = still). */
  background: number
  /** Bubble side-to-side wobble (0 = bubbles rise straight up). */
  bubbleWobble: number
  /** Boop squash-and-wobble multiplier. */
  squash: number
  /** Tremble before inking (0 = none; the darker flush still warns). */
  tremble: number
  /** Ink cloud drift and swirl multiplier. */
  inkDrift: number
  /** Dizzy wobble tilt and star-orbit speed multiplier (the loop swimming itself is behavior and stays). */
  dizzyWobble: number
}

export const FULL_MOTION: MotionSettings = {
  sway: 1,
  breath: 1,
  lean: 1,
  trail: 1,
  emotePop: true,
  emoteFloat: 1,
  background: 1,
  bubbleWobble: 1,
  squash: 1,
  tremble: 1,
  inkDrift: 1,
  dizzyWobble: 1,
}

export const REDUCED_MOTION: MotionSettings = {
  sway: 0.3,
  breath: 0.4,
  lean: 0.5,
  trail: 0.5,
  emotePop: false,
  emoteFloat: 0.3,
  background: 0,
  bubbleWobble: 0,
  squash: 0.4,
  tremble: 0,
  inkDrift: 0.3,
  dizzyWobble: 0.3,
}

export function motionSettings(reduced: boolean): MotionSettings {
  return reduced ? REDUCED_MOTION : FULL_MOTION
}
