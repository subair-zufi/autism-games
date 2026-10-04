import { describe, expect, it } from 'vitest'
import { initMastery, stepMastery, type MasteryConfig } from './mastery'

// a 3-rung ladder starting at the bottom (like Museum on easy)
const cfg: MasteryConfig = { rungCount: 3, floor: 0 }

function run(cfg: MasteryConfig, outcomes: boolean[]) {
  let s = initMastery(cfg)
  for (const firstTryCorrect of outcomes) s = stepMastery(s, cfg, { firstTryCorrect })
  return s
}

describe('mastery controller (R14)', () => {
  it('starts on the floor with no streak or errors', () => {
    expect(initMastery(cfg)).toEqual({ rung: 0, streak: 0, errors: 0 })
    expect(initMastery({ rungCount: 3, floor: 2 }).rung).toBe(2)
  })

  it('clamps the floor into range', () => {
    expect(initMastery({ rungCount: 3, floor: 9 }).rung).toBe(2)
    expect(initMastery({ rungCount: 3, floor: -1 }).rung).toBe(0)
  })

  it('steps up after 3 consecutive first-try-correct, then resets the streak', () => {
    expect(run(cfg, [true, true]).rung).toBe(0) // not yet
    const s = run(cfg, [true, true, true])
    expect(s.rung).toBe(1)
    expect(s.streak).toBe(0)
  })

  it('needs a fresh run of 3 for each further step up', () => {
    expect(run(cfg, [true, true, true, true, true, true]).rung).toBe(2)
  })

  it('never steps above the top rung', () => {
    expect(run(cfg, Array(20).fill(true)).rung).toBe(2)
  })

  it('an error breaks the success streak', () => {
    // two correct, an error, then two correct → only two in the new run, no step
    expect(run(cfg, [true, true, false, true, true]).rung).toBe(0)
  })

  it('steps down after 2 erred trials in the window', () => {
    const start = { rung: 2, streak: 0, errors: 0 }
    const after1 = stepMastery(start, cfg, { firstTryCorrect: false })
    expect(after1.rung).toBe(2) // one error: not yet
    const after2 = stepMastery(after1, cfg, { firstTryCorrect: false })
    expect(after2.rung).toBe(1) // second error: step down, window resets
    expect(after2.errors).toBe(0)
  })

  it('a clean success closes the error window (a lone error does not accumulate forever)', () => {
    let s: ReturnType<typeof initMastery> = { rung: 2, streak: 0, errors: 0 }
    s = stepMastery(s, cfg, { firstTryCorrect: false }) // 1 error
    s = stepMastery(s, cfg, { firstTryCorrect: true }) // clean success resets errors
    expect(s.errors).toBe(0)
    s = stepMastery(s, cfg, { firstTryCorrect: false }) // 1 error again, not 2
    expect(s.rung).toBe(2)
  })

  it('never steps below the mentor-set floor', () => {
    const floored: MasteryConfig = { rungCount: 3, floor: 1 }
    const s = run(floored, [false, false, false, false, false, false])
    expect(s.rung).toBe(1)
  })

  it('honours custom advance/retreat thresholds', () => {
    const fast: MasteryConfig = { rungCount: 4, floor: 0, advanceStreak: 2, retreatErrors: 1 }
    expect(run(fast, [true, true]).rung).toBe(1)
    expect(stepMastery({ rung: 1, streak: 0, errors: 0 }, fast, { firstTryCorrect: false }).rung).toBe(0)
  })
})
