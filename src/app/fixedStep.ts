/**
 * Fixed-timestep accumulator ("Fix Your Timestep").
 *
 * Real frame time is added to an accumulator; the simulation then advances in equal steps
 * of `stepSeconds` for as long as whole steps fit. The leftover fraction (`alpha`) tells the
 * renderer how far to interpolate between the previous and current simulation state.
 *
 * Pure function — no DOM, no clock — so it is fully unit-testable.
 */

export interface FixedStepConfig {
  /** Duration of one simulation step, in seconds (1/60 = 60 Hz). */
  stepSeconds: number
  /** Frame deltas longer than this are clamped (e.g. after a tab was hidden or a debugger pause). */
  maxFrameSeconds: number
  /** Hard cap on steps per frame; excess time is dropped to avoid a "spiral of death". */
  maxStepsPerFrame: number
}

export interface FixedStepResult {
  /** How many simulation steps to run this frame. */
  steps: number
  /** Time carried over to the next frame (always < one step). */
  accumulator: number
  /** Interpolation factor in [0, 1): accumulator / stepSeconds. */
  alpha: number
}

export const DEFAULT_FIXED_STEP: FixedStepConfig = {
  stepSeconds: 1 / 60,
  maxFrameSeconds: 0.25,
  maxStepsPerFrame: 10,
}

// Guards against float error, e.g. 0.05 - 3 * (1/60) landing a hair below zero.
const EPSILON = 1e-9

export function advanceFixedStep(
  accumulator: number,
  frameSeconds: number,
  config: FixedStepConfig = DEFAULT_FIXED_STEP,
): FixedStepResult {
  const { stepSeconds, maxFrameSeconds, maxStepsPerFrame } = config
  const delta = Math.min(Math.max(frameSeconds, 0), maxFrameSeconds)

  let acc = accumulator + delta
  let steps = 0
  while (acc + EPSILON >= stepSeconds && steps < maxStepsPerFrame) {
    acc -= stepSeconds
    steps++
  }

  // Hit the step cap: drop whole steps we couldn't afford, keep only the sub-step remainder.
  if (acc + EPSILON >= stepSeconds) acc %= stepSeconds
  acc = Math.max(acc, 0)

  return { steps, accumulator: acc, alpha: Math.min(acc / stepSeconds, 1 - EPSILON) }
}
