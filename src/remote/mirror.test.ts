import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_MIRROR_INTERVAL_MS,
  flipRowsInPlace,
  isMirrorWanted,
  mirrorIntervalMs,
  mirrorState,
  publishMirrorFrame,
  reportMirrorFailure,
  resetMirror,
  setMirrorWanted,
  shouldCapture,
  takeMirrorFrame,
} from './mirror'

beforeEach(() => resetMirror())

describe('flipRowsInPlace', () => {
  it('turns a WebGL readback (bottom-up) into canvas order (top-down)', () => {
    // 1x3, one pixel per row, distinguishable by red channel
    const pixels = new Uint8Array([1, 0, 0, 255, 2, 0, 0, 255, 3, 0, 0, 255])
    flipRowsInPlace(pixels, 1, 3)
    expect([pixels[0], pixels[4], pixels[8]]).toEqual([3, 2, 1])
  })

  it('leaves an even-height image consistent when flipped twice', () => {
    const original = new Uint8Array(2 * 4 * 4).map((_, i) => i % 251)
    const round = flipRowsInPlace(flipRowsInPlace(original.slice(), 4, 2), 4, 2)
    expect([...round]).toEqual([...original])
  })
})

describe('capture pacing', () => {
  it('spends a capture only once the gap has passed', () => {
    expect(shouldCapture(1000, 900, 700)).toBe(false)
    expect(shouldCapture(1700, 1000, 700)).toBe(true)
  })

  it('clamps a console-requested interval into a sane range', () => {
    setMirrorWanted(true, 50)
    expect(mirrorIntervalMs()).toBe(200)
    setMirrorWanted(true, 999_999)
    expect(mirrorIntervalMs()).toBe(5000)
    setMirrorWanted(true, 800)
    expect(mirrorIntervalMs()).toBe(800)
  })
})

describe('the frame nobody is watching', () => {
  it('is off until a console asks, so the headset pays nothing', () => {
    expect(isMirrorWanted()).toBe(false)
    expect(mirrorState()).toBe('off')
    setMirrorWanted(true)
    expect(isMirrorWanted()).toBe(true)
    expect(mirrorIntervalMs()).toBe(DEFAULT_MIRROR_INTERVAL_MS)
  })

  it('drops the pending frame when the mirror is turned off', () => {
    setMirrorWanted(true)
    publishMirrorFrame('data:image/jpeg;base64,AAA')
    setMirrorWanted(false)
    expect(takeMirrorFrame()).toBeNull()
  })
})

describe('what the console is told about the mirror', () => {
  it('reports live only while frames keep arriving', () => {
    setMirrorWanted(true)
    const t0 = 1_000_000
    publishMirrorFrame('data:image/jpeg;base64,AAA', t0)
    expect(mirrorState(t0 + 1000)).toBe('live')
    expect(mirrorState(t0 + 9000)).toBe('unavailable')
  })

  it('reports unavailable when the capture gave up', () => {
    setMirrorWanted(true)
    publishMirrorFrame('data:image/jpeg;base64,AAA')
    reportMirrorFailure('context lost')
    expect(mirrorState()).toBe('unavailable')
    expect(takeMirrorFrame()).toBeNull()
  })

  it('hands each frame over exactly once, so an unchanged view is not re-sent', () => {
    setMirrorWanted(true)
    publishMirrorFrame('data:image/jpeg;base64,AAA')
    expect(takeMirrorFrame()).toBe('data:image/jpeg;base64,AAA')
    expect(takeMirrorFrame()).toBeNull()
  })
})
