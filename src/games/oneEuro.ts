import * as THREE from 'three'

/**
 * One Euro filter (Casiez, Roussel & Vogel, CHI 2012) for the gaze ray.
 *
 * The dwell forgiveness and the tolerance cone in `headAim.ts` both make a
 * tremor cheaper to have. This attacks it one step earlier: it takes the shake
 * out of the ray before anything is asked of it, so fewer slips happen at all
 * and the reticle stops jittering on the spot, which children watch while they
 * are trying to hold still.
 *
 * A plain low-pass would do the first job and ruin the second: enough smoothing
 * to settle a tremor also drags the reticle along behind a real head turn,
 * which feels broken and is worse for a child scanning a room. The One Euro
 * filter is the standard answer — it varies its own cutoff with how fast the
 * input is actually moving, so it is heavy when the head is trying to hold
 * still and nearly transparent when the head is deliberately turning. Two
 * knobs: `minCutoffHz` sets how much shake is removed at rest, `beta` how
 * quickly the filter gets out of the way once real movement starts.
 *
 * It follows from that trade that this is a first line of defence and not the
 * whole answer. How much it removes falls off with how far the head is moving,
 * because a big fast excursion cannot be told from a deliberate turn —
 * measured over a 3Hz tremor on the high-support profile, about two thirds of
 * a ±1° shake, but only a seventh of a ±9° one. Fine tremor is what it is for;
 * everything it lets through is what the tolerance cone and the dwell drain in
 * `headAim.ts` catch. Cost on the other side: roughly 20-40ms of lag at the end
 * of a fast turn, which is the price of all three.
 *
 * ONLY THE RAY IS FILTERED, never the rendered camera. Decoupling what a child
 * sees from where their head actually is invites simulator sickness, and this
 * is a headset a child wears for a study. It is also why `HeadSampler` and
 * `headTracking` keep reading the raw camera: head yaw is a recorded outcome,
 * and a smoothed version of it would be a measurement of this file rather than
 * of the child.
 *
 * Kept apart from `HeadSelect` so the maths is unit-testable — there is no way
 * to drive a real head pose from a test.
 */

/** Cutoff (Hz) the speed estimate itself is smoothed at, per the paper. */
export const SPEED_CUTOFF_HZ = 1

/** A cutoff this low would freeze the ray; guards a mis-set config. */
const MIN_CUTOFF_HZ = 0.01

/**
 * Smoothing factor of a first-order low pass at `cutoffHz` over `dtSec`.
 *
 * 1 passes the input straight through, 0 holds the previous value. A dropped
 * frame or a resumed session therefore snaps rather than sliding in from a
 * stale pose, which is what we want: `dtSec` large means the old value is old.
 */
export function lowPassAlpha(cutoffHz: number, dtSec: number): number {
  if (!(dtSec > 0)) return 1
  const tau = 1 / (2 * Math.PI * Math.max(cutoffHz, MIN_CUTOFF_HZ))
  return Math.min(1, Math.max(0, 1 / (1 + tau / dtSec)))
}

export interface RayFilterConfig {
  /** cutoff (Hz) while the head is still — lower removes more tremor */
  minCutoffHz: number
  /** how fast the cutoff opens with head speed (Hz per deg/s) — higher means
   *  less lag on a real turn, and less smoothing during a fast tremor */
  beta: number
}

/**
 * Stateful filter over head rotations. One per mounted `HeadSelect`; it holds
 * the previous pose and the smoothed speed estimate between frames.
 */
export class GazeRayFilter {
  private readonly out = new THREE.Quaternion()
  private readonly prev = new THREE.Quaternion()
  private speedDegPerSec = 0
  private started = false

  /** Forget everything — the next pose is passed through untouched. */
  reset(): void {
    this.started = false
    this.speedDegPerSec = 0
  }

  /** The smoothed speed the cutoff is currently being set from (deg/s). */
  get speed(): number {
    return this.speedDegPerSec
  }

  /**
   * Smooth one head pose. Returns the filter's own quaternion — copy it rather
   * than holding the reference, since the next call overwrites it.
   */
  filter(raw: THREE.Quaternion, dtSec: number, cfg: RayFilterConfig): THREE.Quaternion {
    if (!this.started) {
      // start exactly where the head is, so a session never opens with the ray
      // sliding in from wherever the last one left it
      this.started = true
      this.speedDegPerSec = 0
      this.out.copy(raw)
      this.prev.copy(raw)
      return this.out
    }
    if (!(dtSec > 0)) return this.out

    const stepDeg = THREE.MathUtils.radToDeg(this.prev.angleTo(raw))
    this.prev.copy(raw)

    const speed = stepDeg / dtSec
    this.speedDegPerSec += lowPassAlpha(SPEED_CUTOFF_HZ, dtSec) * (speed - this.speedDegPerSec)

    const cutoff = cfg.minCutoffHz + cfg.beta * this.speedDegPerSec
    this.out.slerp(raw, lowPassAlpha(cutoff, dtSec))
    return this.out
  }
}
