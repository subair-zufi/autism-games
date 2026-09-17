import { beforeEach, describe, expect, it } from 'vitest'
import {
  beginConfirmWindow,
  confirmMetrics,
  noteAim,
  resetConfirmForTest,
  type AimEvents,
} from './confirmTracking'

const QUIET: AimEvents = { armedNew: false, drainedMs: 0, brokeOff: false, fire: false }
const armed = (): AimEvents => ({ ...QUIET, armedNew: true })
const slip = (ms: number): AimEvents => ({ ...QUIET, drainedMs: ms, brokeOff: true })
const fired = (): AimEvents => ({ ...QUIET, fire: true })

describe('confirmTracking', () => {
  beforeEach(resetConfirmForTest)

  it('reports nothing for a trial with no gaze activity', () => {
    expect(confirmMetrics()).toEqual({
      dwellArmCount: 0,
      dwellConfirmBreaks: 0,
      dwellDrainedMs: 0,
      dwellArmToConfirmMs: null,
      dwellArmedNoConfirm: false,
    })
  })

  it('times the confirm from arming the choice, not from the trial opening', () => {
    beginConfirmWindow()
    // the child spends 3s finding the exhibit, then 1.4s confirming it: the
    // confirmation cost is the 1.4s, and pooling it with the search is exactly
    // what makes a slow child and an unsteady one look alike
    noteAim(armed(), 3000)
    noteAim(fired(), 4400)

    const m = confirmMetrics()
    expect(m.dwellArmToConfirmMs).toBe(1400)
    expect(m.dwellArmCount).toBe(1)
    expect(m.dwellArmedNoConfirm).toBe(false)
  })

  it('counts what an unsteady head cost, not how many frames it took', () => {
    beginConfirmWindow()
    noteAim(armed(), 0)
    // one slip: several frames of draining, but a single break
    noteAim(slip(40), 100)
    noteAim({ ...QUIET, drainedMs: 40 }, 116)
    noteAim(slip(60), 400)
    noteAim(fired(), 900)

    const m = confirmMetrics()
    expect(m.dwellConfirmBreaks).toBe(2)
    expect(m.dwellDrainedMs).toBe(140)
  })

  it('flags the trial where the child chose but could never confirm', () => {
    beginConfirmWindow()
    noteAim(armed(), 0)
    noteAim(slip(300), 500)
    // trial ends — timeout, or the facilitator moves on

    const m = confirmMetrics()
    expect(m.dwellArmedNoConfirm).toBe(true)
    expect(m.dwellArmToConfirmMs).toBeNull()
    // this is the confound: attention succeeded, the motor confirmation did not
    expect(m.dwellArmCount).toBe(1)
  })

  it('times from the choice that was answered, not one considered first', () => {
    beginConfirmWindow()
    noteAim(armed(), 0)
    noteAim(armed(), 2000) // changed their mind
    noteAim(fired(), 3000)

    const m = confirmMetrics()
    expect(m.dwellArmToConfirmMs).toBe(1000)
    expect(m.dwellArmCount).toBe(2)
  })

  it('leaves the interval missing rather than invented when arming predates the trial', () => {
    beginConfirmWindow()
    noteAim(armed(), 0)
    noteAim(fired(), 500)
    // next trial opens while a stale candidate is still armed from the last one
    beginConfirmWindow()
    noteAim(fired(), 900)

    const m = confirmMetrics()
    expect(m.dwellArmToConfirmMs).toBeNull()
    expect(m.dwellArmedNoConfirm).toBe(false)
  })

  it('forgets the previous trial when a new window opens', () => {
    beginConfirmWindow()
    noteAim(armed(), 0)
    noteAim(slip(500), 100)
    beginConfirmWindow()

    expect(confirmMetrics()).toMatchObject({
      dwellArmCount: 0,
      dwellConfirmBreaks: 0,
      dwellDrainedMs: 0,
      dwellArmToConfirmMs: null,
    })
  })
})
