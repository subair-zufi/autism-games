import { describe, expect, it } from 'vitest'
import {
  PRACTICE_BEARINGS_DEG,
  isDragTail,
  isPracticeComplete,
  lookDrag,
  practicePromptKey,
} from './logic'

describe('practice sequence', () => {
  it('starts straight ahead (tap alone, no turn needed)', () => {
    expect(PRACTICE_BEARINGS_DEG[0]).toBe(0)
  })

  it('includes a turn to each side, never behind the child', () => {
    for (const deg of PRACTICE_BEARINGS_DEG) expect(Math.abs(deg)).toBeLessThanOrEqual(90)
    expect(PRACTICE_BEARINGS_DEG.some((d) => d < 0)).toBe(true)
    expect(PRACTICE_BEARINGS_DEG.some((d) => d > 0)).toBe(true)
  })

  it('is complete once every target has been tapped', () => {
    expect(isPracticeComplete(PRACTICE_BEARINGS_DEG.length - 1)).toBe(false)
    expect(isPracticeComplete(PRACTICE_BEARINGS_DEG.length)).toBe(true)
  })
})

describe('practicePromptKey', () => {
  const base = { ready: false, celebrating: false, inVR: true, inputMethod: 'dwell' } as const

  it('teaches the dwell ring when that is the child\'s method', () => {
    expect(practicePromptKey(base)).toBe('practiceIntroDwell')
  })

  it('teaches the trigger when the child is on the controller', () => {
    expect(practicePromptKey({ ...base, inputMethod: 'controller' })).toBe('practiceIntroController')
  })

  it('keeps the generic tap wording outside a session, where the mouse selects', () => {
    expect(practicePromptKey({ ...base, inVR: false })).toBe('practiceIntro')
    expect(practicePromptKey({ ...base, inVR: false, inputMethod: 'controller' })).toBe('practiceIntro')
  })

  it('confirms a landed selection before repeating the instruction', () => {
    expect(practicePromptKey({ ...base, celebrating: true })).toBe('practiceGreat')
    expect(practicePromptKey({ ...base, celebrating: true, inVR: false })).toBe('practiceGreat')
  })

  it('shows the finish line above everything else', () => {
    expect(practicePromptKey({ ...base, ready: true, celebrating: true })).toBe('practiceReady')
  })
})

describe('drag guard', () => {
  it('ignores a tap that is the tail of a look-around drag', () => {
    lookDrag.px = 20
    lookDrag.endedAt = 1000
    expect(isDragTail(1100)).toBe(true)
    expect(isDragTail(2000)).toBe(false)
    lookDrag.px = 2
    expect(isDragTail(1050)).toBe(false)
  })
})
