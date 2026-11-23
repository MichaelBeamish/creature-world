import { describe, expect, it } from 'vitest'
import { momentAt, PARTY, PARTY_SONG_MAP } from '../simulation/party'
import { beatGlow, LIGHTS, neonClumpCount, spotGlow, twinkle } from './party'

/** Count flashes (WCAG: a rise and a fall of at least 10%) in every 1-second window of a brightness signal. */
function maxFlashesPerSecond(brightness: (time: number) => number, seconds: number): number {
  const fps = 120
  const peaks: number[] = []
  let trough = brightness(0)
  let peak = trough
  let rising = true
  for (let i = 1; i <= seconds * fps; i++) {
    const t = i / fps
    const b = brightness(t)
    if (rising) {
      if (b > peak) peak = b
      else if (peak - b >= 0.1 && peak - trough >= 0.1) {
        peaks.push(t) // a full flash: up by ≥ 10%, then down by ≥ 10%
        rising = false
        trough = b
      }
    } else if (b < trough) trough = b
    else if (b - trough >= 0.1) {
      rising = true
      peak = b
    }
    if (!rising && b < trough) trough = b
  }
  let worst = 0
  for (let i = 0; i < peaks.length; i++) {
    let n = 0
    while (i + n < peaks.length && peaks[i + n]! - peaks[i]! < 1) n++
    worst = Math.max(worst, n)
  }
  return worst
}

const beatsAtTime = (t: number) => (t * PARTY.bpm) / 60
const songSeconds = ((PARTY_SONG_MAP.length + 8) * 4 * 60) / PARTY.bpm

describe('party lights are light-safe (tasks #32a, #32c)', () => {
  it('a twinkle never flashes more than 3 times a second (WCAG 2.3.1)', () => {
    expect(LIGHTS.maxFlashHz).toBeLessThan(3)
    for (let seed = 1; seed <= 20; seed++) {
      expect(maxFlashesPerSecond((t) => twinkle(t, seed), 10)).toBeLessThanOrEqual(3)
    }
  })

  it('the beat glow (beams, rays, neon) pulses at most 3 times a second — through the whole song', () => {
    const glow = (t: number) => beatGlow(momentAt(beatsAtTime(t)), 1)
    const worst = maxFlashesPerSecond(glow, songSeconds)
    expect(worst).toBeGreaterThan(0) // it does pulse in the drops
    expect(worst).toBeLessThanOrEqual(3)
  })

  it('the mirror-ball spots too — twinkle and beat together', () => {
    for (const seed of [1, 7, 13, 29]) {
      const glow = (t: number) => spotGlow(t, seed, momentAt(beatsAtTime(t)), 1)
      expect(maxFlashesPerSecond(glow, songSeconds)).toBeLessThanOrEqual(3)
    }
  })

  it('reduced motion: no beat pulses at all — the glow barely changes within any beat', () => {
    for (let beat = 0; beat < (PARTY_SONG_MAP.length + 8) * 4; beat++) {
      let lo = 1
      let hi = 0
      for (let f = 0; f < 1; f += 0.05) {
        const g = beatGlow(momentAt(beat + f), 0)
        lo = Math.min(lo, g)
        hi = Math.max(hi, g)
      }
      expect(hi - lo).toBeLessThan(0.05)
    }
  })

  it('brightness stays within 0..1', () => {
    for (let t = 0; t < 40; t += 0.05) {
      const m = momentAt(beatsAtTime(t))
      for (const b of [beatGlow(m, 1), spotGlow(t, 3, m, 1), twinkle(t, 7)]) {
        expect(b).toBeGreaterThanOrEqual(0)
        expect(b).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('the neon reef on small screens (task #42)', () => {
  it('grows clumps by the width: 12 on a desktop, a few on a phone', () => {
    expect(neonClumpCount(1280)).toBe(LIGHTS.extraSeaweed)
    expect(neonClumpCount(1920)).toBe(LIGHTS.extraSeaweed)
    expect(neonClumpCount(390)).toBe(3)
  })
})
