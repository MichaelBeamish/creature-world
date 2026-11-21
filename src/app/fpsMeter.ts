/**
 * Rolling frame statistics over a time window (default 1 s).
 *
 * - FPS: frames per second, from frame timestamps (capped by the display's refresh rate).
 * - Frame work time: how long our own step + render took per frame. This shows the *headroom*
 *   against the 16.7 ms budget of a 60 Hz display, which FPS alone hides.
 * Pure: you feed it timestamps; no clock or DOM inside.
 */
export interface FrameStats {
  fps: number
  avgFrameMs: number
  worstFrameMs: number
}

export interface FpsMeter {
  /** Record one frame: its timestamp (ms) and how long our work took (ms). */
  record(timestamp: number, workMs: number): void
  stats(): FrameStats
  reset(): void
}

export function createFpsMeter(windowMs = 1000): FpsMeter {
  let frames: { t: number; work: number }[] = []

  return {
    record(timestamp, workMs) {
      frames.push({ t: timestamp, work: workMs })
      // Drop frames that fell out of the window (at ~60–144 entries, a plain array is plenty fast).
      while (frames.length > 0 && frames[0]!.t < timestamp - windowMs) frames.shift()
    },
    stats() {
      if (frames.length < 2) return { fps: 0, avgFrameMs: 0, worstFrameMs: 0 }
      const span = frames.at(-1)!.t - frames[0]!.t
      let total = 0
      let worst = 0
      for (const f of frames) {
        total += f.work
        worst = Math.max(worst, f.work)
      }
      return {
        fps: span > 0 ? ((frames.length - 1) * 1000) / span : 0,
        avgFrameMs: total / frames.length,
        worstFrameMs: worst,
      }
    },
    reset() {
      frames = []
    },
  }
}
