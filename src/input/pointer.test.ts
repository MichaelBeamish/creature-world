import { describe, expect, it } from 'vitest'
import { createPointerInput, TOUCH_LINGER_MS, type PointerTarget } from './pointer'

/** A fake element: an EventTarget with a fixed bounding rect (Node has EventTarget built in). */
function fakeTarget(left = 10, top = 20) {
  const target = new EventTarget() as EventTarget & PointerTarget
  target.getBoundingClientRect = () => ({ left, top })
  const fire = (type: string, props: { clientX?: number; clientY?: number; pointerType: string }) =>
    target.dispatchEvent(Object.assign(new Event(type), { clientX: 0, clientY: 0, ...props }))
  return { target, fire }
}

describe('pointer input', () => {
  it('reports mouse position relative to the element, active while inside', () => {
    const { target, fire } = fakeTarget(10, 20)
    const input = createPointerInput(target, () => 0)
    expect(input.sample(0).active).toBe(false)
    fire('pointermove', { clientX: 110, clientY: 220, pointerType: 'mouse' })
    expect(input.sample(0)).toEqual({ x: 100, y: 200, active: true })
    fire('pointerleave', { pointerType: 'mouse' })
    expect(input.sample(0).active).toBe(false)
  })

  it('a touch is active while down and lingers briefly after lifting', () => {
    const { target, fire } = fakeTarget()
    let now = 0
    const input = createPointerInput(target, () => now)
    fire('pointerdown', { clientX: 60, clientY: 70, pointerType: 'touch' })
    expect(input.sample(now).active).toBe(true)
    now = 500
    fire('pointerup', { pointerType: 'touch' })
    expect(input.sample(now + TOUCH_LINGER_MS - 1).active).toBe(true)
    expect(input.sample(now + TOUCH_LINGER_MS + 1).active).toBe(false)
  })

  it('stops listening after destroy()', () => {
    const { target, fire } = fakeTarget()
    const input = createPointerInput(target, () => 0)
    input.destroy()
    fire('pointermove', { clientX: 300, clientY: 300, pointerType: 'mouse' })
    expect(input.sample(0).active).toBe(false)
  })
})
