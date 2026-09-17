import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { GazeRayFilter, lowPassAlpha, type RayFilterConfig } from './oneEuro'
import { DWELL_PROFILES } from './headAim'

const HZ = 72
const DT = 1 / HZ

const yawQuat = (deg: number) =>
  new THREE.Quaternion().setFromEuler(new THREE.Euler(0, THREE.MathUtils.degToRad(deg), 0))

const yawOf = (q: THREE.Quaternion) =>
  THREE.MathUtils.radToDeg(new THREE.Euler().setFromQuaternion(q, 'YXZ').y)

/** Run a head-yaw trace (deg, one per frame) through the filter. */
function run(trace: number[], cfg: RayFilterConfig): number[] {
  const f = new GazeRayFilter()
  return trace.map((deg) => yawOf(f.filter(yawQuat(deg), DT, cfg)))
}

/** A tremor: `amp` degrees at `freq` Hz, for `seconds`. */
function tremor(amp: number, freq: number, seconds: number): number[] {
  const n = Math.round(seconds * HZ)
  return Array.from({ length: n }, (_, i) => amp * Math.sin(2 * Math.PI * freq * (i * DT)))
}

/** Peak excursion over the last second, once the filter has settled. */
const settledAmplitude = (out: number[]) => Math.max(...out.slice(-HZ).map(Math.abs))

describe('lowPassAlpha', () => {
  it('passes everything through when no time has passed', () => {
    // a dropped frame or a resumed session must snap, not slide in from a
    // pose that is now stale
    expect(lowPassAlpha(1, 0)).toBe(1)
    expect(lowPassAlpha(1, -1)).toBe(1)
    expect(lowPassAlpha(1, 10)).toBeGreaterThan(0.98)
  })

  it('stays a fraction, and smooths harder the lower the cutoff', () => {
    const heavy = lowPassAlpha(0.5, DT)
    const light = lowPassAlpha(5, DT)
    expect(heavy).toBeGreaterThan(0)
    expect(heavy).toBeLessThan(light)
    expect(light).toBeLessThan(1)
  })

  it('cannot freeze the ray on a mis-set cutoff', () => {
    expect(lowPassAlpha(0, DT)).toBeGreaterThan(0)
    expect(lowPassAlpha(-3, DT)).toBeGreaterThan(0)
  })
})

describe('GazeRayFilter', () => {
  const STANDARD = DWELL_PROFILES.standard.ray
  const SUPPORT = DWELL_PROFILES['high-support'].ray

  it('starts exactly where the head is', () => {
    const f = new GazeRayFilter()
    expect(yawOf(f.filter(yawQuat(35), DT, STANDARD))).toBeCloseTo(35, 5)
  })

  it('leaves a still head still', () => {
    const out = run(Array(HZ).fill(12), STANDARD)
    for (const y of out) expect(y).toBeCloseTo(12, 5)
  })

  it('shrinks a tremor', () => {
    // ±1.5° at 3Hz — the shake that was knocking the ray off the chip
    const trace = tremor(1.5, 3, 2)
    expect(settledAmplitude(run(trace, STANDARD))).toBeLessThan(1.5)
  })

  it('shrinks it further on the profile meant for an unsteady child', () => {
    const trace = tremor(1.5, 3, 2)
    const standard = settledAmplitude(run(trace, STANDARD))
    const support = settledAmplitude(run(trace, SUPPORT))
    expect(support).toBeLessThan(standard)
  })

  it('still lands exactly where a deliberate turn ends', () => {
    // smoothing that left a standing offset would point the ray at the wrong
    // exhibit for as long as the child held still — worse than the tremor
    const turn = [...Array(HZ).fill(0), ...Array(HZ * 2).fill(40)]
    const out = run(turn, SUPPORT)
    expect(out[out.length - 1]).toBeCloseTo(40, 3)
  })

  it('gets out of the way of a fast turn, which a fixed cutoff would not', () => {
    // 60° swept over 0.4s, as when a child follows a cue across the room
    const sweep = Array.from({ length: Math.round(0.4 * HZ) }, (_, i) =>
      (60 * (i + 1)) / Math.round(0.4 * HZ),
    )
    const trace = [...Array(HZ).fill(0), ...sweep]
    const adaptive = run(trace, SUPPORT)
    const fixed = run(trace, { minCutoffHz: SUPPORT.minCutoffHz, beta: 0 })

    const lag = (out: number[]) => Math.abs(60 - out[out.length - 1])
    expect(lag(adaptive)).toBeLessThan(lag(fixed))
  })

  it('snaps after a long gap rather than sliding in from a stale pose', () => {
    // the child took the headset off mid-trial and put it back on facing
    // somewhere else; rAF stopped, so one frame spans the whole break
    const f = new GazeRayFilter()
    f.filter(yawQuat(0), DT, SUPPORT)
    f.filter(yawQuat(0), DT, SUPPORT)
    // essentially all of the 90° gap is closed in that one frame
    expect(Math.abs(90 - yawOf(f.filter(yawQuat(90), 30, SUPPORT)))).toBeLessThan(2)
  })

  it('ignores a frame where no time passed', () => {
    const f = new GazeRayFilter()
    f.filter(yawQuat(10), DT, STANDARD)
    expect(yawOf(f.filter(yawQuat(50), 0, STANDARD))).toBeCloseTo(10, 5)
  })

  it('takes out proportionally more of a small shake than a large movement', () => {
    // The defining trade, and the reason this is a first line of defence
    // rather than the whole answer: a large fast excursion cannot be told
    // apart from a deliberate turn, so smoothing it would drag the reticle
    // along behind the child's head. It clears most of a fine tremor and
    // deliberately lets big movement through — what it lets through is what
    // the tolerance cone and the dwell drain in `headAim.ts` are for.
    const removed = (amp: number) => 1 - settledAmplitude(run(tremor(amp, 3, 3), SUPPORT)) / amp

    expect(removed(1)).toBeGreaterThan(0.5)
    expect(removed(1)).toBeGreaterThan(removed(5))
  })

  it('re-seeds after a reset instead of easing over from the last session', () => {
    const f = new GazeRayFilter()
    for (const y of tremor(2, 3, 1)) f.filter(yawQuat(y), DT, STANDARD)
    f.reset()
    expect(yawOf(f.filter(yawQuat(-70), DT, STANDARD))).toBeCloseTo(-70, 5)
    expect(f.speed).toBe(0)
  })
})
