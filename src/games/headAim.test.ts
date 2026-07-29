import { describe, expect, it } from 'vitest'
import { Object3D } from 'three'
import { DWELL_MS, advanceAim, createAimState, findSelectTarget } from './headAim'

/** a marked target with a plain child, like the scenes' hit volumes */
function target(): { root: Object3D; hit: Object3D } {
  const root = new Object3D()
  root.userData.headSelect = true
  const hit = new Object3D()
  root.add(hit)
  return { root, hit }
}

describe('findSelectTarget', () => {
  it('finds the marked ancestor of the object the ray actually hit', () => {
    const { root, hit } = target()
    const deeper = new Object3D()
    hit.add(deeper)
    expect(findSelectTarget(deeper)).toBe(root)
  })

  it('returns the object itself when it carries the mark', () => {
    const { root } = target()
    expect(findSelectTarget(root)).toBe(root)
  })

  it('returns null for unmarked scenery, so a wandering gaze selects nothing', () => {
    const sky = new Object3D()
    sky.add(new Object3D())
    expect(findSelectTarget(sky.children[0])).toBeNull()
    expect(findSelectTarget(null)).toBeNull()
    expect(findSelectTarget(undefined)).toBeNull()
  })
})

describe('advanceAim · dwell', () => {
  it('fills over DWELL_MS and fires once', () => {
    const s = createAimState()
    const { root } = target()

    let r = advanceAim(s, root, DWELL_MS / 2)
    expect(r.armed).toBe(true)
    expect(r.progress).toBeCloseTo(0.5)
    expect(r.fire).toBe(false)

    r = advanceAim(s, root, DWELL_MS / 2)
    expect(r.progress).toBe(1)
    expect(r.fire).toBe(true)
  })

  it('does not re-fire while the child keeps staring at what they just chose', () => {
    const s = createAimState()
    const { root } = target()
    advanceAim(s, root, DWELL_MS)

    for (let i = 0; i < 10; i++) {
      const r = advanceAim(s, root, DWELL_MS)
      expect(r.fire).toBe(false)
      expect(r.armed).toBe(false)
      expect(r.progress).toBe(0)
    }
  })

  it('re-arms the same target once the gaze has moved away and back', () => {
    const s = createAimState()
    const { root } = target()
    advanceAim(s, root, DWELL_MS)

    advanceAim(s, null, 16) // look at the sky
    expect(advanceAim(s, root, DWELL_MS).fire).toBe(true)
  })

  it('restarts the timer when the gaze slides onto a different target', () => {
    const s = createAimState()
    const a = target().root
    const b = target().root

    advanceAim(s, a, DWELL_MS * 0.9)
    const r = advanceAim(s, b, DWELL_MS * 0.2)
    expect(r.fire).toBe(false)
    expect(r.progress).toBeCloseTo(0.2)
  })

  it('holds at zero over unmarked scenery', () => {
    const s = createAimState()
    const r = advanceAim(s, null, DWELL_MS * 5)
    expect(r).toEqual({ progress: 0, armed: false, fire: false })
  })
})
