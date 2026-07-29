import { describe, expect, it } from 'vitest'
import { Object3D } from 'three'
import {
  ARM_MS,
  DWELL_MS,
  advanceAim,
  clearCandidate,
  createAimState,
  findSelectTarget,
  isConfirmChip,
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

  it('abandons a half-finished confirm if the gaze leaves the chip', () => {
    const s = createAimState()
    const { root } = target()
    advanceAim(s, { ...LOOK, target: root }, ARM_MS)

    advanceAim(s, CONFIRM, DWELL_MS * 0.9)
    advanceAim(s, { ...LOOK, target: root }, 100) // glanced back up at the face
    const r = advanceAim(s, CONFIRM, DWELL_MS * 0.2)
    expect(r.fire).toBe(false)
    expect(r.progress).toBeCloseTo(0.2)
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
