/**
 * Live watcher for the OS/browser "reduce motion" accessibility setting
 * (CSS media query `prefers-reduced-motion: reduce`). Toggling the setting takes effect immediately.
 */

/** The bit of MediaQueryList we use — lets tests pass a fake. */
export interface MotionQuery {
  readonly matches: boolean
  addEventListener(type: 'change', listener: () => void): void
  removeEventListener(type: 'change', listener: () => void): void
}

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Calls `onChange(reduced)` now and whenever the setting changes. Returns an unsubscribe function.
 * `query` defaults to the real `matchMedia`; tests inject a fake.
 */
export function watchReducedMotion(
  onChange: (reduced: boolean) => void,
  query: MotionQuery = window.matchMedia(REDUCED_MOTION_QUERY),
): () => void {
  const listener = () => onChange(query.matches)
  listener()
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}
