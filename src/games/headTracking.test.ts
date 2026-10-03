import { describe, expect, it } from 'vitest'
import {
  angDiffDeg,
  beginHeadWindow,
  headMetrics,
  headWatchProportion,
  sampleHeadPose,
} from './headTracking'

describe('angDiffDeg', () => {
  it('is the shortest signed difference, wrapped to (−180, 180]', () => {
    expect(angDiffDeg(10, 0)).toBe(10)
    expect(angDiffDeg(0, 10)).toBe(-10)
    expect(angDiffDeg(170, -170)).toBe(-20) // across the ±180 seam
    expect(angDiffDeg(-170, 170)).toBe(20)
  })
})

describe('headWatchProportion (attention during a peer turn, R9)', () => {
  it('is 0 for an empty window', () => {
    beginHeadWindow(1000)
    expect(headWatchProportion(40)).toBe(0)
  })

  it('is the fraction of samples spent looking within tolerance of the bearing', () => {
    beginHeadWindow(1000)
    sampleHeadPose(40, 0, 1000) // on the peer (±20 of 40)
    sampleHeadPose(35, 0, 1100) // on the peer
    sampleHeadPose(0, 0, 1200) // looking away
    sampleHeadPose(5, 0, 1300) // looking away
    expect(headWatchProportion(40, 20)).toBeCloseTo(0.5)
  })

  it('is 1 when the child watched the peer the whole turn, 0 when never', () => {
    beginHeadWindow(1000)
    sampleHeadPose(40, 0, 1000)
    sampleHeadPose(42, 0, 1100)
    expect(headWatchProportion(40, 20)).toBe(1)
    beginHeadWindow(2000)
    sampleHeadPose(-50, 0, 2000)
    sampleHeadPose(-48, 0, 2100)
    expect(headWatchProportion(40, 20)).toBe(0)
  })
})

describe('headMetrics', () => {
  it('returns empty metrics when no poses were captured', () => {
    beginHeadWindow(1000)
    const m = headMetrics(30)
    expect(m.headSamples).toBe(0)
    expect(m.headStartYawDeg).toBeNull()
    expect(m.headToTargetMs).toBeNull()
    expect(m.headYawTravelDeg).toBe(0)
  })

  it('summarises a clean scan toward the target', () => {
    beginHeadWindow(1000)
    sampleHeadPose(0, 0, 1000) // start looking straight ahead
    sampleHeadPose(10, 1, 1100)
    sampleHeadPose(20, 2, 1200) // within 12° of the 30° target
    sampleHeadPose(30, 0, 1300) // landed on target
    const m = headMetrics(30)
    expect(m.headSamples).toBe(4)
    expect(m.headStartYawDeg).toBe(0)
    expect(m.headEndYawDeg).toBe(30)
    expect(m.headYawTravelDeg).toBe(30) // 10 + 10 + 10
    expect(m.headYawRangeDeg).toBe(30)
    expect(m.headReversals).toBe(0)
    expect(m.headMaxPitchDeg).toBe(2)
    expect(m.headMinPitchDeg).toBe(0)
    expect(m.headToTargetMs).toBe(200) // reached within-tol at t=1200, window opened at 1000
  })

  it('counts left↔right direction changes as reversals', () => {
    beginHeadWindow(0)
    sampleHeadPose(0, 0, 0)
    sampleHeadPose(10, 0, 100) // →
    sampleHeadPose(5, 0, 200) // ←
    sampleHeadPose(15, 0, 300) // →
    const m = headMetrics()
    expect(m.headReversals).toBe(2)
    expect(m.headToTargetMs).toBeNull() // no target given
  })

  it('ignores sub-noise jitter in travel and reversals', () => {
    beginHeadWindow(0)
    sampleHeadPose(0, 0, 0)
    sampleHeadPose(0.3, 0, 100) // below the 0.75° noise floor
    sampleHeadPose(-0.2, 0, 200)
    const m = headMetrics()
    expect(m.headYawTravelDeg).toBe(0)
    expect(m.headReversals).toBe(0)
  })

  it('excludes poses captured before the window opened', () => {
    beginHeadWindow(1000)
    sampleHeadPose(90, 0, 900) // stale, before window start
    sampleHeadPose(0, 0, 1000)
    sampleHeadPose(5, 0, 1100)
    const m = headMetrics()
    expect(m.headSamples).toBe(2)
    expect(m.headStartYawDeg).toBe(0)
  })

  it('reports headToTargetMs null when the target is never reached', () => {
    beginHeadWindow(0)
    sampleHeadPose(0, 0, 0)
    sampleHeadPose(-10, 0, 100)
    const m = headMetrics(80) // never looked near 80°
    expect(m.headToTargetMs).toBeNull()
  })
})
