/**
 * Shared per-trial head-pose telemetry for the 360° games (review item M1).
 *
 * A tiny <HeadSampler> inside each game's Canvas samples the camera's world
 * facing (~HEAD_SAMPLE_HZ) into this singleton — the same yaw the child steers
 * with a drag on screen, or with a real head turn in an immersive headset, so
 * the measure is identical in and out of VR. The game opens a fresh window at
 * cue/stimulus onset (`beginHeadWindow`) and reads a compact per-trial summary
 * at answer time (`headMetrics`), spreading it into the recorded answer step.
 *
 * Until now the games recorded only the *required* turn (`targetBearingDeg`) and
 * discarded what the child's head actually did; these metrics capture the scan
 * itself — how far they looked, how long to land on the target, and how much
 * back-and-forth (hesitation) there was.
 *
 * Yaw is a signed bearing in degrees, 0 = straight ahead, left(−)/right(+) — the
 * same convention as `slotHeadingDeg`/`targetBearingDeg`, so `headToTargetMs`
 * compares directly against the trial's `targetBearingDeg`. Pitch is degrees,
 * up(+)/down(−).
 *
 * A singleton (like `lookDrag`) so hot reload never duplicates it and the maths
 * is unit-testable without a WebGL context.
 */

import { beginVisibilityWindow } from '../services/visibility'

/** how often <HeadSampler> writes a pose (Hz) */
export const HEAD_SAMPLE_HZ = 10

/** yaw change below this (deg) between samples is jitter, not real turning */
const YAW_NOISE_DEG = 0.75
/** the head counts as "on target" once within this many degrees of the bearing */
const TARGET_TOL_DEG = 12
/** cap the buffer so a long idle stretch can't grow it without bound */
const MAX_SAMPLES = 1200

interface HeadSample {
  t: number
  yaw: number
  pitch: number
}

const buf: HeadSample[] = []
let windowStart = 0

/** Shortest signed difference a−b, wrapped to (−180, 180]. */
export function angDiffDeg(a: number, b: number): number {
  let d = (a - b) % 360
  if (d > 180) d -= 360
  if (d <= -180) d += 360
  return d
}

/**
 * Open a fresh telemetry window at stimulus/cue onset.
 *
 * Also opens the page-visibility window. Every game already calls this at the
 * exact moment a trial begins, so it is the one place that knows where a trial
 * starts — and `useGameAnalytics` reports how much of that window the child
 * spent with the page hidden, alongside these head metrics.
 */
export function beginHeadWindow(now: number = performance.now()): void {
  buf.length = 0
  windowStart = now
  beginVisibilityWindow(now)
}

/** The most recent sampled yaw (deg), or 0 before any sample has arrived —
 *  used to gate cues on the child's live facing rather than the trial window. */
export function latestYawDeg(): number {
  return buf.length ? buf[buf.length - 1].yaw : 0
}

/** Record one camera pose (called by <HeadSampler>; degrees). */
export function sampleHeadPose(
  yawDeg: number,
  pitchDeg: number,
  now: number = performance.now(),
): void {
  buf.push({ t: now, yaw: yawDeg, pitch: pitchDeg })
  if (buf.length > MAX_SAMPLES) buf.splice(0, buf.length - MAX_SAMPLES)
}

export interface HeadMetrics {
  /** poses captured in this window */
  headSamples: number
  /** facing (deg) at window open and at answer — where the child looked first/last */
  headStartYawDeg: number | null
  headEndYawDeg: number | null
  /** total absolute yaw swept — the scan-path length (deg) */
  headYawTravelDeg: number
  /** widest yaw span visited (deg) */
  headYawRangeDeg: number
  /** left↔right direction changes — hesitation / back-and-forth */
  headReversals: number
  /** pitch extremes (deg) — comfort + looking up/down at content */
  headMaxPitchDeg: number | null
  headMinPitchDeg: number | null
  /** ms from window open until the head first pointed within TARGET_TOL of the
   *  target bearing; null if a target was given but never reached, or no target */
  headToTargetMs: number | null
}

const EMPTY: HeadMetrics = {
  headSamples: 0,
  headStartYawDeg: null,
  headEndYawDeg: null,
  headYawTravelDeg: 0,
  headYawRangeDeg: 0,
  headReversals: 0,
  headMaxPitchDeg: null,
  headMinPitchDeg: null,
  headToTargetMs: null,
}

/**
 * Summarise the poses captured since the last `beginHeadWindow`. Pass the
 * trial's target bearing (deg) to get `headToTargetMs`; omit it for
 * screen-facing games (Emotion Cinema) where there is no target to scan to.
 */
export function headMetrics(targetBearingDeg?: number): HeadMetrics {
  const s = buf.filter((p) => p.t >= windowStart)
  if (s.length === 0) return { ...EMPTY }

  let travel = 0
  let reversals = 0
  let lastDir = 0
  let min = s[0].yaw
  let max = s[0].yaw
  let minPitch = s[0].pitch
  let maxPitch = s[0].pitch
  let toTarget: number | null = null

  for (let i = 0; i < s.length; i++) {
    const p = s[i]
    if (p.yaw < min) min = p.yaw
    if (p.yaw > max) max = p.yaw
    if (p.pitch < minPitch) minPitch = p.pitch
    if (p.pitch > maxPitch) maxPitch = p.pitch
    if (
      toTarget === null &&
      targetBearingDeg !== undefined &&
      Math.abs(angDiffDeg(p.yaw, targetBearingDeg)) <= TARGET_TOL_DEG
    ) {
      toTarget = Math.max(0, Math.round(p.t - windowStart))
    }
    if (i > 0) {
      const d = angDiffDeg(p.yaw, s[i - 1].yaw)
      if (Math.abs(d) >= YAW_NOISE_DEG) {
        travel += Math.abs(d)
        const dir = Math.sign(d)
        if (lastDir !== 0 && dir !== lastDir) reversals++
        lastDir = dir
      }
    }
  }

  return {
    headSamples: s.length,
    headStartYawDeg: round1(s[0].yaw),
    headEndYawDeg: round1(s[s.length - 1].yaw),
    headYawTravelDeg: round1(travel),
    headYawRangeDeg: round1(max - min),
    headReversals: reversals,
    headMaxPitchDeg: round1(maxPitch),
    headMinPitchDeg: round1(minPitch),
    headToTargetMs: toTarget,
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
