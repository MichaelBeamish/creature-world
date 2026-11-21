/**
 * Pointer input → the latest sample, nothing more.
 *
 * Uses the Pointer Events API (one API for mouse, pen and touch). Events arrive at irregular
 * times; we only remember the most recent state. The app samples it once per fixed step and
 * copies it into the world (`setPresenceInput`), so the simulation never sees DOM events.
 */

export interface PointerSample {
  /** Position relative to the target element, in CSS pixels (= world units). */
  x: number
  y: number
  active: boolean
}

export interface PointerInput {
  /** The latest state; `now` is a millisecond clock (e.g. `performance.now()`). */
  sample(now: number): PointerSample
  destroy(): void
}

/** After a finger lifts, its presence lingers this long (MVP mobile fallback: a tap is a brief presence). */
export const TOUCH_LINGER_MS = 1000

/** The subset of DOM we need — lets tests pass a fake element. */
export interface PointerTarget {
  addEventListener(type: string, listener: (event: PointerEvent) => void): void
  removeEventListener(type: string, listener: (event: PointerEvent) => void): void
  getBoundingClientRect(): { left: number; top: number }
}

export function createPointerInput(target: PointerTarget, clock: () => number): PointerInput {
  let x = 0
  let y = 0
  let mouseInside = false
  let touchDown = false
  let touchUntil = -Infinity

  const moveTo = (event: PointerEvent) => {
    const rect = target.getBoundingClientRect()
    x = event.clientX - rect.left
    y = event.clientY - rect.top
  }

  const handlers: Record<string, (event: PointerEvent) => void> = {
    pointermove(event) {
      moveTo(event)
      if (event.pointerType !== 'touch') mouseInside = true
    },
    pointerdown(event) {
      moveTo(event)
      if (event.pointerType === 'touch') touchDown = true
      else mouseInside = true
    },
    pointerup(event) {
      if (event.pointerType === 'touch') {
        touchDown = false
        touchUntil = clock() + TOUCH_LINGER_MS
      }
    },
    pointercancel(event) {
      if (event.pointerType === 'touch') {
        touchDown = false
        touchUntil = clock() + TOUCH_LINGER_MS
      }
    },
    pointerleave(event) {
      if (event.pointerType !== 'touch') mouseInside = false
    },
  }

  for (const [type, handler] of Object.entries(handlers)) target.addEventListener(type, handler)

  return {
    sample(now) {
      const active = mouseInside || touchDown || now < touchUntil
      return { x, y, active }
    },
    destroy() {
      for (const [type, handler] of Object.entries(handlers)) {
        target.removeEventListener(type, handler)
      }
    },
  }
}
