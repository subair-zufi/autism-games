import { describe, expect, it } from 'vitest'
import { DEFAULT_MIN_OFFSET_Y, MAX_EYE_Y, MIN_EYE_Y, hudEyeOffset } from './hudAnchor'

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

  it('with a floor, never drops the HUD below it — however short the wearer', () => {
    // Emotion Room 360: designed for a 1.5 m eye, prompt panel bottom at
    // design 2.79 m, face-board frame top at 2.41 m. minOffsetY=-0.25 is the
    // floor EmotionRecognition360Scene passes in.
    const promptBottomAtDesign = 2.79
    const boardFrameTop = 2.41
    const minOffsetY = -0.25

    for (const eye of [1.5, 1.2, 1.1, MIN_EYE_Y, 0.5, MAX_EYE_Y]) {
      const offset = hudEyeOffset(eye, 1.5, minOffsetY)
      expect(promptBottomAtDesign + offset).toBeGreaterThanOrEqual(boardFrameTop)
    }
  })

  /**
   * `VRInputSwitch` (panel centre 0.62 m, panel height 0.38 m) is the lowest
   * element every 360 game hangs from its `VRHudAnchor`. Its own bottom edge
   * sits at 0.62 − 0.19 = 0.43 m at design height — `DEFAULT_MIN_OFFSET_Y`
   * must never let that edge reach the floor (0 m), for any game's
   * `designEyeY` and any wearer in the plausible range, so the buttons never
   * sink into the floor and go dark (review V4).
   */
  it('the default floor keeps every game\'s input switch above the floor', () => {
    const switchBottomAtDesign = 0.62 - 0.38 / 2
    for (const designEyeY of [1.5, 1.6, 1.7]) {
      for (const eye of [designEyeY, 1.1, MIN_EYE_Y, MAX_EYE_Y]) {
        const offset = hudEyeOffset(eye, designEyeY, DEFAULT_MIN_OFFSET_Y)
        expect(switchBottomAtDesign + offset).toBeGreaterThan(0)
      }
    }
  })
})
