import { advanceFixedStep, DEFAULT_FIXED_STEP, type FixedStepConfig } from './fixedStep'

export interface GameLoopCallbacks {
  /** Advance the simulation by exactly `dt` seconds. Called 0..n times per frame. */
  step(dt: number): void
  /** Draw the current state; `alpha` in [0, 1) interpolates between the last two steps. */
  render(alpha: number): void
  /** Optional: called once per frame with the rAF timestamp and how long step + render took (ms). */
  frame?(now: number, workMs: number): void
}

export interface GameLoop {
  start(): void
  stop(): void
  readonly running: boolean
}

/** Drives a fixed-timestep simulation from requestAnimationFrame. */
export function createGameLoop(
  callbacks: GameLoopCallbacks,
  config: FixedStepConfig = DEFAULT_FIXED_STEP,
): GameLoop {
  let frameId: number | null = null
  let lastTime: number | null = null
  let accumulator = 0

  function frame(now: number) {
    const frameSeconds = lastTime === null ? 0 : (now - lastTime) / 1000
    lastTime = now

    const workStart = callbacks.frame ? performance.now() : 0
    const result = advanceFixedStep(accumulator, frameSeconds, config)
    accumulator = result.accumulator
    for (let i = 0; i < result.steps; i++) callbacks.step(config.stepSeconds)
    callbacks.render(result.alpha)
    callbacks.frame?.(now, performance.now() - workStart)

    frameId = requestAnimationFrame(frame)
  }

  return {
    start() {
      if (frameId !== null) return // already running — never start a second loop
      lastTime = null
      accumulator = 0
      frameId = requestAnimationFrame(frame)
    },
    stop() {
      if (frameId !== null) cancelAnimationFrame(frameId)
      frameId = null
    },
    get running() {
      return frameId !== null
    },
  }
}
