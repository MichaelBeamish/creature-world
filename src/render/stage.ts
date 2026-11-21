/**
 * A full-size, high-DPI-aware 2D canvas.
 *
 * The canvas *backing store* is sized to CSS size × devicePixelRatio so drawings stay sharp on
 * Retina/4K screens, and the context is scaled so all drawing code works in CSS pixels.
 */
export interface Stage {
  readonly ctx: CanvasRenderingContext2D
  /** Drawable width in CSS pixels. */
  readonly width: number
  /** Drawable height in CSS pixels. */
  readonly height: number
  destroy(): void
}

export function createStage(canvas: HTMLCanvasElement): Stage {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context is not available')

  let width = 0
  let height = 0

  function resize(cssWidth: number, cssHeight: number) {
    const dpr = window.devicePixelRatio || 1
    width = cssWidth
    height = cssHeight
    canvas.width = Math.round(cssWidth * dpr)
    canvas.height = Math.round(cssHeight * dpr)
    // Resizing resets the context, so re-apply the scale every time.
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  const initial = canvas.getBoundingClientRect()
  resize(initial.width, initial.height)

  // Fires on window resize, layout changes, and (usually) moving between monitors with different DPR.
  const observer = new ResizeObserver(([entry]) => {
    if (entry) resize(entry.contentRect.width, entry.contentRect.height)
  })
  observer.observe(canvas)

  return {
    ctx,
    get width() {
      return width
    },
    get height() {
      return height
    },
    destroy() {
      observer.disconnect()
    },
  }
}
