import { describe, expect, it } from 'vitest'
import { ANIMATION, createAnimation, stepAnimation, type CreatureAnimation } from './animation'
import { createRng } from './rng'
import { createWorld, stepWorld } from './world'

const DT = 1 / 60
const TAU = Math.PI * 2
const CONFIG = { seed: 1234, width: 1280, height: 720, creatureCount: 5 }

interface BlinkRecord {
  start: number
  duration: number
}

/** Run a world and record every blink (a contiguous span with eyes not fully open) per creature. */
function recordBlinks(seed: number, seconds: number) {
  const world = createWorld({ ...CONFIG, seed })
  const blinks = world.creatures.map(() => [] as BlinkRecord[])
  const startedAt = world.creatures.map(() => -1)
  let minOpenness = 1
  let maxOpenness = 0
  const steps = Math.round(seconds / DT)
  for (let i = 0; i < steps; i++) {
    stepWorld(world, DT)
    world.creatures.forEach((c, k) => {
      const open = c.anim.eyeOpenness
      minOpenness = Math.min(minOpenness, open)
      maxOpenness = Math.max(maxOpenness, open)
      const blinking = c.anim.blinkElapsed >= 0
      if (blinking && startedAt[k] === -1) startedAt[k] = world.time - DT
      if (!blinking && startedAt[k] !== -1) {
        blinks[k]!.push({ start: startedAt[k]!, duration: world.time - startedAt[k]! })
        startedAt[k] = -1
      }
    })
  }
  return { world, blinks, minOpenness, maxOpenness }
}

describe('createAnimation', () => {
  it('starts with phases, rates and first blink within their ranges', () => {
    const rng = createRng(5)
    for (let i = 0; i < 500; i++) {
      const a = createAnimation(rng)
      expect(a.breathPhase).toBeGreaterThanOrEqual(0)
      expect(a.breathPhase).toBeLessThan(TAU)
      expect(a.breathRate / TAU).toBeGreaterThanOrEqual(ANIMATION.breathHz[0])
      expect(a.breathRate / TAU).toBeLessThan(ANIMATION.breathHz[1])
      expect(a.swayRate / TAU).toBeGreaterThanOrEqual(ANIMATION.swayHz[0])
      expect(a.swayRate / TAU).toBeLessThan(ANIMATION.swayHz[1])
      expect(a.blinkTimer).toBeLessThanOrEqual(ANIMATION.firstBlinkWait[1])
      expect(a.eyeOpenness).toBe(1)
    }
  })
})

describe('phase accumulation', () => {
  it('advances by exactly rate × dt per step, staying wrapped to [0, 2π)', () => {
    const rng = createRng(1)
    const a: CreatureAnimation = { ...createAnimation(rng), breathPhase: 1, breathRate: 2 }
    stepAnimation(a, DT, rng)
    expect(a.breathPhase).toBeCloseTo(1 + 2 * DT, 12)

    a.breathPhase = TAU - 0.01
    stepAnimation(a, DT, rng)
    expect(a.breathPhase).toBeCloseTo((TAU - 0.01 + 2 * DT) % TAU, 12)
    expect(a.breathPhase).toBeLessThan(TAU)
  })

  it('stays continuous when the rate changes (no jump)', () => {
    const rng = createRng(2)
    const a: CreatureAnimation = { ...createAnimation(rng), swayPhase: 0.5, swayRate: 1 }
    for (let i = 0; i < 30; i++) stepAnimation(a, DT, rng)
    const before = a.swayPhase
    a.swayRate = 4 // e.g. the creature gets excited
    stepAnimation(a, DT, rng)
    expect(a.swayPhase - before).toBeCloseTo(4 * DT, 12)
  })
})

describe('blinking', () => {
  it('every creature blinks within 10 seconds, at different times', () => {
    for (const seed of [1, 42, 1234]) {
      const { blinks } = recordBlinks(seed, 10)
      for (const list of blinks) expect(list.length).toBeGreaterThan(0)
      const firstStarts = blinks.map((list) => list[0]!.start.toFixed(3))
      expect(new Set(firstStarts).size).toBe(blinks.length)
    }
  })

  it('each blink lasts about 120–200 ms and openness stays in [0, 1]', () => {
    const { blinks, minOpenness, maxOpenness } = recordBlinks(7, 60)
    for (const b of blinks.flat()) {
      expect(b.duration).toBeGreaterThanOrEqual(0.12)
      expect(b.duration).toBeLessThanOrEqual(0.2)
    }
    expect(minOpenness).toBeGreaterThanOrEqual(0)
    expect(minOpenness).toBeLessThan(0.1) // eyes really close
    expect(maxOpenness).toBeLessThanOrEqual(1)
  })

  it('sometimes double-blinks (roughly 15% of blinks)', () => {
    const { blinks } = recordBlinks(99, 600)
    let doubles = 0
    let total = 0
    for (const list of blinks) {
      for (let i = 1; i < list.length; i++) {
        total++
        const gap = list[i]!.start - (list[i - 1]!.start + list[i - 1]!.duration)
        if (gap < 0.3) doubles++
      }
    }
    expect(total).toBeGreaterThan(500)
    expect(doubles / total).toBeGreaterThan(0.05)
    expect(doubles / total).toBeLessThan(0.3)
  })
})

describe('desynchronization', () => {
  it('creatures breathe and sway with different phases and rates', () => {
    for (const seed of [1, 2, 3]) {
      const { creatures } = createWorld({ ...CONFIG, seed })
      for (let i = 0; i < creatures.length; i++) {
        for (let j = i + 1; j < creatures.length; j++) {
          const a = creatures[i]!.anim
          const b = creatures[j]!.anim
          expect(a.breathRate).not.toBe(b.breathRate)
          expect(a.swayRate).not.toBe(b.swayRate)
          const d = Math.abs(a.breathPhase - b.breathPhase)
          expect(Math.min(d, TAU - d)).toBeGreaterThan(0.01)
        }
      }
    }
  })
})
