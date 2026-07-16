import { describe, expect, it } from 'vitest'
import {
  angDiffDeg,
  beginHeadWindow,
  headMetrics,
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
