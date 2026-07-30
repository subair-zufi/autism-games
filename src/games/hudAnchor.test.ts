import { describe, expect, it } from 'vitest'
import { MAX_EYE_Y, MIN_EYE_Y, hudEyeOffset } from './hudAnchor'

describe('hudEyeOffset', () => {
  it('drops the HUD by however much shorter the wearer is', () => {
    // Museum 360 lays its HUD out for a 1.7 m eye; a 10-year-old is ~1.27 m
    expect(hudEyeOffset(1.27, 1.7)).toBeCloseTo(-0.43, 5)
    // Emotion Room lays out for 1.5 m; a small 7-year-old is ~1.12 m
    expect(hudEyeOffset(1.12, 1.5)).toBeCloseTo(-0.38, 5)
  })

  it('raises it for a wearer taller than the layout assumed', () => {
    expect(hudEyeOffset(1.75, 1.5)).toBeCloseTo(0.25, 5)
  })

  it('does nothing when the wearer matches the layout', () => {
    expect(hudEyeOffset(1.6, 1.6)).toBe(0)
  })

  /**
   * The fallback is the whole safety story: an unusable reading must leave the
   * HUD exactly where it ships, never fling it somewhere the child cannot look.
   */
  it('falls back to the shipped layout on an implausible reading', () => {
    expect(hudEyeOffset(0, 1.5)).toBe(0) // uninitialised camera
    expect(hudEyeOffset(MIN_EYE_Y - 0.01, 1.5)).toBe(0)
    expect(hudEyeOffset(MAX_EYE_Y + 0.01, 1.5)).toBe(0)
    expect(hudEyeOffset(NaN, 1.5)).toBe(0)
    expect(hudEyeOffset(Infinity, 1.5)).toBe(0)
  })

  it('accepts the ends of the plausible range', () => {
    expect(hudEyeOffset(MIN_EYE_Y, 1.5)).toBeCloseTo(MIN_EYE_Y - 1.5, 5)
    expect(hudEyeOffset(MAX_EYE_Y, 1.5)).toBeCloseTo(MAX_EYE_Y - 1.5, 5)
  })

  /**
   * The point of the change: restoring the designed viewing angle. A panel
   * 2.0 m above a 1.5 m eye at 4.2 m reads 25.5° up; without the shift a
   * 1.2 m child reads 28.7°, with it they read 25.5° again.
   */
  it('restores the designed look-up angle for a shorter wearer', () => {
    const panelY = 3.5
    const dist = 4.2
    const angle = (eye: number, shift: number) =>
      (Math.atan2(panelY + shift - eye, dist) * 180) / Math.PI

    const designed = angle(1.5, 0)
    const childUnshifted = angle(1.2, 0)
    const childShifted = angle(1.2, hudEyeOffset(1.2, 1.5))

    expect(childUnshifted).toBeGreaterThan(designed)
    expect(childShifted).toBeCloseTo(designed, 6)
  })
})
