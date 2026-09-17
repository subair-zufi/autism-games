import { describe, expect, it } from 'vitest'
import { Object3D } from 'three'
import type { DwellProfile } from '../types'
import {
  ARM_MS,
  CONFIRM_DECAY,
  CONFIRM_GRACE_MS,
  CONFIRM_TOL_DEG,
  DWELL_MS,
  DWELL_PROFILES,
  advanceAim,
  angleBetweenDeg,
  clearCandidate,
  createAimState,
  findSelectTarget,
  isConfirmChip,
  withinConfirmCone,
} from './headAim'

/** a marked target with a plain child, like the scenes' hit volumes */
function target(): { root: Object3D; hit: Object3D } {
  const root = new Object3D()
  root.userData.headSelect = true
  const hit = new Object3D()
  root.add(hit)
  return { root, hit }
}

const LOOK = { onConfirm: false }
const CONFIRM = { target: null, onConfirm: true }

describe('findSelectTarget', () => {
  it('finds the marked ancestor of the object the ray actually hit', () => {
    const { root, hit } = target()
    const deeper = new Object3D()
    hit.add(deeper)
    expect(findSelectTarget(deeper)).toBe(root)
  })

  it('returns null for unmarked scenery, so a wandering gaze selects nothing', () => {
    const sky = new Object3D()
    sky.add(new Object3D())
    expect(findSelectTarget(sky.children[0])).toBeNull()
    expect(findSelectTarget(null)).toBeNull()
  })
})

describe('isConfirmChip', () => {
  it('recognises the chip and its children', () => {
    const chip = new Object3D()
    chip.userData.headConfirm = true
    const face = new Object3D()
    chip.add(face)
    expect(isConfirmChip(face)).toBe(true)
    expect(isConfirmChip(new Object3D())).toBe(false)
  })
})

describe('two-stage selection', () => {
  it('never answers from looking alone, however long the gaze rests', () => {
    const s = createAimState()
    const { root } = target()

    // the Emotion Room case: studying one face for far longer than any dwell
    for (let i = 0; i < 20; i++) {
      const r = advanceAim(s, { ...LOOK, target: root }, DWELL_MS)
      expect(r.fire).toBe(false)
    }
  })

  it('claims a candidate once the gaze is steady', () => {
    const s = createAimState()
    const { root } = target()

    expect(advanceAim(s, { ...LOOK, target: root }, ARM_MS / 2).candidate).toBeNull()
    expect(advanceAim(s, { ...LOOK, target: root }, ARM_MS / 2).candidate).toBe(root)
  })

  it('does not claim a candidate from a gaze sweeping past', () => {
    const s = createAimState()
    const a = target().root
    const b = target().root
    const c = target().root

    // each one crossed briefly on the way to the next
    advanceAim(s, { ...LOOK, target: a }, ARM_MS * 0.4)
    advanceAim(s, { ...LOOK, target: b }, ARM_MS * 0.4)
    const r = advanceAim(s, { ...LOOK, target: c }, ARM_MS * 0.4)
    expect(r.candidate).toBeNull()
  })

  it('answers only after dwelling on the confirm chip', () => {
    const s = createAimState()
    const { root } = target()
    advanceAim(s, { ...LOOK, target: root }, ARM_MS)

    const half = advanceAim(s, CONFIRM, DWELL_MS / 2)
    expect(half.fire).toBe(false)
    expect(half.progress).toBeCloseTo(0.5)

    const done = advanceAim(s, CONFIRM, DWELL_MS / 2)
    expect(done.fire).toBe(true)
    expect(done.candidate).toBe(root)
  })

  it('keeps the candidate while the gaze crosses empty scenery to reach the chip', () => {
    const s = createAimState()
    const { root } = target()
    advanceAim(s, { ...LOOK, target: root }, ARM_MS)

    // looking at nothing on the way down must not drop the choice
    advanceAim(s, { ...LOOK, target: null }, 400)
    expect(s.candidate).toBe(root)
    expect(advanceAim(s, CONFIRM, DWELL_MS).fire).toBe(true)
  })

  it('switches the candidate when the gaze settles on a different face', () => {
    const s = createAimState()
    const a = target().root
    const b = target().root

    advanceAim(s, { ...LOOK, target: a }, ARM_MS)
    expect(s.candidate).toBe(a)
    advanceAim(s, { ...LOOK, target: b }, ARM_MS)
    expect(s.candidate).toBe(b)

    expect(advanceAim(s, CONFIRM, DWELL_MS).candidate).toBe(b)
  })

  it('does nothing on the chip when no candidate has been chosen', () => {
    const s = createAimState()
    const r = advanceAim(s, CONFIRM, DWELL_MS * 3)
    expect(r.fire).toBe(false)
    expect(r.candidate).toBeNull()
  })

  it('cannot fire twice from one confirm — the caller clears the candidate', () => {
    const s = createAimState()
    const { root } = target()
    advanceAim(s, { ...LOOK, target: root }, ARM_MS)
    expect(advanceAim(s, CONFIRM, DWELL_MS).fire).toBe(true)

    clearCandidate(s)
    const after = advanceAim(s, CONFIRM, DWELL_MS)
    expect(after.fire).toBe(false)
    expect(after.candidate).toBeNull()
  })
})

/**
 * Both rules exist for the same finding: children who located the right exhibit
 * and looked straight at the tick, yet never answered. See `headAim.ts`.
 */
describe('forgiving an unsteady head', () => {
  /** arm `root` and get the confirm dwell most of the way there */
  function nearlyConfirmed() {
    const s = createAimState()
    const { root } = target()
    advanceAim(s, { ...LOOK, target: root }, ARM_MS)
    advanceAim(s, CONFIRM, DWELL_MS * 0.9)
    return { s, root }
  }

  it('charges nothing for a wobble shorter than the grace window', () => {
    const { s } = nearlyConfirmed()
    // the tremor case: off the chip, but only for a moment
    advanceAim(s, { ...LOOK, target: null }, CONFIRM_GRACE_MS / 2)
    expect(advanceAim(s, CONFIRM, DWELL_MS * 0.2).fire).toBe(true)
  })

  it('reaches an answer through a steady tremor, which a reset never could', () => {
    const s = createAimState()
    const { root } = target()
    advanceAim(s, { ...LOOK, target: root }, ARM_MS)

    // ~4Hz wobble: on the chip most of the time, off it briefly, over and over.
    // Under the old rule each slip emptied the ring and this never terminated.
    let fired = false
    for (let i = 0; i < 12 && !fired; i++) {
      fired = advanceAim(s, CONFIRM, 200).fire
      if (!fired) advanceAim(s, { ...LOOK, target: root }, 50)
    }
    expect(fired).toBe(true)
  })

  it('drains a real look away rather than erasing it', () => {
    const { s, root } = nearlyConfirmed()

    const away = 1000
    const drained = advanceAim(s, { ...LOOK, target: root }, away)
    const charged = (away - CONFIRM_GRACE_MS) * CONFIRM_DECAY
    expect(drained.progress).toBeCloseTo((DWELL_MS * 0.9 - charged) / DWELL_MS)
    expect(drained.progress).toBeGreaterThan(0)

    // still short of an answer — the slip cost real progress, just not all of it
    expect(advanceAim(s, CONFIRM, DWELL_MS * 0.2).fire).toBe(false)
  })

  it('empties the ring if the gaze stays away long enough', () => {
    const { s, root } = nearlyConfirmed()
    const r = advanceAim(s, { ...LOOK, target: root }, DWELL_MS * 4)
    expect(r.progress).toBe(0)
  })

  it('never answers for an option the gaze has moved on from', () => {
    const { s } = nearlyConfirmed()
    const other = target().root

    // settling on a neighbour re-arms it; the dwell earned for the first
    // exhibit must not carry across and fire for this one
    advanceAim(s, { ...LOOK, target: other }, ARM_MS)
    expect(s.candidate).toBe(other)
    const r = advanceAim(s, CONFIRM, DWELL_MS * 0.5)
    expect(r.fire).toBe(false)
    expect(r.progress).toBeCloseTo(0.5)
  })
})

describe('confirm tolerance cone', () => {
  /** a direction `deg` to the right of straight ahead */
  const off = (deg: number) =>
    [Math.sin((deg * Math.PI) / 180), 0, -Math.cos((deg * Math.PI) / 180)] as const

  it('measures the angle between two directions', () => {
    expect(angleBetweenDeg([0, 0, -1], [0, 0, -1])).toBeCloseTo(0)
    expect(angleBetweenDeg([0, 0, -1], [1, 0, 0])).toBeCloseTo(90)
    expect(angleBetweenDeg([0, 0, -1], off(30))).toBeCloseTo(30)
  })

  it('treats a zero-length direction as nowhere near, never as a hit', () => {
    expect(angleBetweenDeg([0, 0, -1], [0, 0, 0])).toBe(180)
    expect(withinConfirmCone([0, 0, -1], [0, 0, 0])).toBe(false)
  })

  it('catches a gaze pointing near the chip, not one pointing away', () => {
    expect(withinConfirmCone([0, 0, -1], off(CONFIRM_TOL_DEG - 2))).toBe(true)
    expect(withinConfirmCone([0, 0, -1], off(CONFIRM_TOL_DEG + 2))).toBe(false)
  })

  it('is wider than the ray-on-chip test it forgives, in every direction', () => {
    for (const deg of [0, 3, 6]) {
      expect(withinConfirmCone([0, 0, -1], off(deg))).toBe(true)
      expect(withinConfirmCone([0, 0, -1], off(-deg))).toBe(true)
    }
  })
})

/**
 * `confirmTracking` totals these up per trial; the rules stay here so the whole
 * thing is replayable without a clock or a headset.
 */
describe('what the selection loop reports for telemetry', () => {
  it('announces a new choice once, not on every frame it stays chosen', () => {
    const s = createAimState()
    const { root } = target()

    expect(advanceAim(s, { ...LOOK, target: root }, ARM_MS / 2).armedNew).toBe(false)
    expect(advanceAim(s, { ...LOOK, target: root }, ARM_MS / 2).armedNew).toBe(true)
    expect(advanceAim(s, { ...LOOK, target: root }, ARM_MS).armedNew).toBe(false)
  })

  it('counts one break per slip, however many frames it spans', () => {
    const s = createAimState()
    const { root } = target()
    advanceAim(s, { ...LOOK, target: root }, ARM_MS)
    advanceAim(s, CONFIRM, DWELL_MS * 0.8)

    // a slip long enough to cost, spread over several frames
    const frames = [CONFIRM_GRACE_MS + 50, 16, 16, 16]
    const broke = frames.map((dt) => advanceAim(s, { ...LOOK, target: root }, dt).brokeOff)
    expect(broke).toEqual([true, false, false, false])

    // back on the chip, then off again: that is a second break
    advanceAim(s, CONFIRM, 100)
    expect(advanceAim(s, { ...LOOK, target: root }, CONFIRM_GRACE_MS + 50).brokeOff).toBe(true)
  })

  it('charges nothing for a wobble inside the grace window', () => {
    const s = createAimState()
    const { root } = target()
    advanceAim(s, { ...LOOK, target: root }, ARM_MS)
    advanceAim(s, CONFIRM, DWELL_MS * 0.5)

    const r = advanceAim(s, { ...LOOK, target: root }, CONFIRM_GRACE_MS / 2)
    expect(r.drainedMs).toBe(0)
    expect(r.brokeOff).toBe(false)
  })

  it('reports the dwell actually lost, never more than was there', () => {
    const s = createAimState()
    const { root } = target()
    advanceAim(s, { ...LOOK, target: root }, ARM_MS)
    advanceAim(s, CONFIRM, 100)

    // a slip that would drain far past empty: only the 100ms held can be lost,
    // or the totals would report dwell the child never earned
    const r = advanceAim(s, { ...LOOK, target: root }, DWELL_MS * 4)
    expect(r.drainedMs).toBe(100)
    expect(r.progress).toBe(0)

    // and an already-empty ring costs nothing more
    expect(advanceAim(s, { ...LOOK, target: root }, DWELL_MS).drainedMs).toBe(0)
  })

  it('reports the drain in dwell lost, which is slower than time spent away', () => {
    const s = createAimState()
    const { root } = target()
    advanceAim(s, { ...LOOK, target: root }, ARM_MS)
    advanceAim(s, CONFIRM, DWELL_MS * 0.9)

    const away = CONFIRM_GRACE_MS + 400
    const r = advanceAim(s, { ...LOOK, target: root }, away)
    expect(r.drainedMs).toBeCloseTo(400 * CONFIRM_DECAY)
  })
})

describe('steadiness profiles', () => {
  const ORDER: DwellProfile[] = ['standard', 'extended', 'high-support']

  it('gets more forgiving in every direction as support goes up', () => {
    const tunings = ORDER.map((id) => DWELL_PROFILES[id])
    for (let i = 1; i < tunings.length; i++) {
      // a shorter hold to sustain, a wider chip to stay inside, and a longer
      // wobble that costs nothing — all three, or a child is only helped on
      // one of the three ways an unsteady head fails
      expect(tunings[i].dwellMs).toBeLessThan(tunings[i - 1].dwellMs)
      expect(tunings[i].tolDeg).toBeGreaterThan(tunings[i - 1].tolDeg)
      expect(tunings[i].graceMs).toBeGreaterThan(tunings[i - 1].graceMs)
      // and the shake is taken out of the ray harder before any of that
      expect(tunings[i].ray.minCutoffHz).toBeLessThan(tunings[i - 1].ray.minCutoffHz)
    }
  })

  it('leaves the standard profile exactly as the constants define it', () => {
    // an unchanged setup has to behave identically to before the dial existed
    expect(DWELL_PROFILES.standard).toMatchObject({
      dwellMs: DWELL_MS,
      tolDeg: CONFIRM_TOL_DEG,
      graceMs: CONFIRM_GRACE_MS,
    })
  })

  it('keeps every profile long enough that a glance cannot answer', () => {
    // the arm/confirm split is what stops an accidental answer, but a dwell
    // shorter than the arming time would let one gesture do both
    for (const id of ORDER) expect(DWELL_PROFILES[id].dwellMs).toBeGreaterThan(ARM_MS * 2)
  })

  it('answers sooner on a loosened profile, from the same unsteady gaze', () => {
    const play = (t: { dwellMs: number; graceMs: number }) => {
      const s = createAimState()
      const { root } = target()
      advanceAim(s, { ...LOOK, target: root }, ARM_MS, t.dwellMs, ARM_MS, t.graceMs)
      // a child whose gaze keeps slipping off for 250ms at a time
      let ms = 0
      for (let i = 0; i < 400; i++) {
        ms += 100
        if (advanceAim(s, CONFIRM, 100, t.dwellMs, ARM_MS, t.graceMs).fire) return ms
        ms += 250
        advanceAim(s, { ...LOOK, target: root }, 250, t.dwellMs, ARM_MS, t.graceMs)
      }
      return null
    }

    const standard = play(DWELL_PROFILES.standard)
    const support = play(DWELL_PROFILES['high-support'])
    expect(support).not.toBeNull()
    expect(standard).not.toBeNull()
    expect(support!).toBeLessThan(standard!)
  })
})
