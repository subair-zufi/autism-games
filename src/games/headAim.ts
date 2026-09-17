import type { Object3D } from 'three'
import type { DwellProfile } from '../types'

/**
 * Gaze selection for the 360 games — the pure part.
 *
 * Selection is deliberately **two-stage**. Resting the gaze on something makes
 * it the *candidate* and hovers a confirm chip on its surface; only dwelling on
 * that chip answers. A single-stage dwell cannot work in
 * these games, because
 * looking at the options **is the task** — Emotion Room asks the child to scan
 * faces to find an emotion, so the first face they examined was being scored as
 * their answer. Separating "I am looking at this" from "I choose this" is the
 * standard fix for that (the Midas-touch problem), and it also makes the
 * in-world Quit and mode switch impossible to trip by accident.
 *
 * The r3f half lives in `HeadSelect.tsx`; everything here is plain data so the
 * rules are unit-testable without a headset (there is no way to drive a real
 * head pose from a test).
 */

/** How long a steady gaze makes something the candidate. Short — this is only
 *  meant to stop the chip flickering between targets as the gaze sweeps past. */
export const ARM_MS = 320

/** How long the gaze must rest on the confirm chip to actually answer. */
export const DWELL_MS = 1600

/**
 * Forgiveness for a child who cannot hold their head still.
 *
 * Quest testing turned up children who found the right exhibit, looked
 * straight at the tick, and still never answered. The cause was here: the
 * confirm dwell used to reset to zero the instant the ray left the chip, so at
 * 72Hz a single 14ms wobble threw away every millisecond earned. A postural
 * tremor crosses the chip's edge several times a second, so the dwell was
 * *accumulating* far past DWELL_MS while never once running CONTINUOUSLY that
 * long. From the outside it read as inattention; it was the software deleting
 * their work.
 *
 * So progress now drains instead of resetting — the standard dwell-tolerance
 * arrangement from gaze-typing and AAC systems. A slip shorter than the grace
 * window costs nothing at all (that is the tremor case: wobbles are brief).
 * Past it, progress falls at CONFIRM_DECAY times the rate it filled, so a
 * genuine look away still empties the ring — just over ~2x the time it took to
 * fill, not instantly.
 */
export const CONFIRM_GRACE_MS = 200
/** Drain rate past the grace window, as a fraction of the fill rate. */
export const CONFIRM_DECAY = 0.5

/**
 * How far off the chip the gaze may point and still count as resting on it.
 *
 * The other half of the same problem. The drawn chip is only a few degrees
 * across, while the exhibit the child already located is 11-18deg wide — so the
 * game congratulated them on an easy aim and then demanded one several times
 * harder, from a child whose head will not cooperate. Widening the *catchment*
 * rather than the chip keeps the tick small enough to hide none of the exhibit
 * while asking for roughly the precision they have already demonstrated.
 *
 * `HeadSelect` applies this only when the ray is over the candidate itself or
 * over nothing — never when it has moved to a different option. See the call
 * site for why that matters.
 */
export const CONFIRM_TOL_DEG = 7

/**
 * The three tunings, chosen per child (`settings.dwellProfile`).
 *
 * `standard` is the constants above — the setting every child played until
 * participant testing showed it excludes the ones who cannot hold their head
 * still. The looser two trade the free geometric margin the narrow cone enjoyed
 * for a child who can otherwise not answer at all; what stops a wide cone
 * answering for the wrong option is not that margin but `HeadSelect`'s rule
 * that the cone is never applied while the ray rests on a different option,
 * which holds at any width.
 *
 * Shorter dwells are safe here because what prevents an accidental answer is
 * the arm/confirm split, not the length of the dwell — see the two-stage note
 * at the top of this file. They are not free, though: response latency cannot
 * fall below the dwell time, so the profile has to travel with the data.
 */
export interface DwellTuning {
  /** how long the gaze must rest on the chip to answer */
  dwellMs: number
  /** how far off the chip the gaze may point and still count */
  tolDeg: number
  /** a slip shorter than this costs nothing */
  graceMs: number
}

export const DWELL_PROFILES: Record<DwellProfile, DwellTuning> = {
  standard: { dwellMs: DWELL_MS, tolDeg: CONFIRM_TOL_DEG, graceMs: CONFIRM_GRACE_MS },
  extended: { dwellMs: 1100, tolDeg: 10, graceMs: 300 },
  'high-support': { dwellMs: 700, tolDeg: 14, graceMs: 450 },
}

/**
 * Objects opt in to being selectable by carrying `userData.headSelect`. Marking
 * is explicit rather than "anything with an onClick" because the scenes are
 * full of clickable furniture we do *not* want a wandering gaze to trip — and
 * because the flag is visible when reading a scene file.
 */
export const HEAD_SELECT_FLAG = 'headSelect'

/** The confirm chip `HeadSelect` renders under the candidate. */
export const HEAD_CONFIRM_FLAG = 'headConfirm'

function hasFlag(object: Object3D | null | undefined, flag: string): Object3D | null {
  let node: Object3D | null | undefined = object
  while (node != null) {
    if (node.userData?.[flag] === true) return node
    node = node.parent
  }
  return null
}

/**
 * Walks up from the intersected object to the nearest ancestor marked
 * selectable. The scenes hang their click handlers on wrapper groups and hit
 * volumes rather than on the visible mesh, so the object the ray actually hits
 * is usually a child of the thing we care about.
 */
export function findSelectTarget(object: Object3D | null | undefined): Object3D | null {
  return hasFlag(object, HEAD_SELECT_FLAG)
}

/** Whether the ray is resting on the confirm chip. */
export function isConfirmChip(object: Object3D | null | undefined): boolean {
  return hasFlag(object, HEAD_CONFIRM_FLAG) != null
}

export interface AimState {
  /** the target the ray is currently resting on, for the arming timer */
  hover: Object3D | null
  hoverMs: number
  /** the chosen-but-unconfirmed target; the confirm chip sits under this */
  candidate: Object3D | null
  /** dwell accumulated on the confirm chip */
  confirmMs: number
  /** how long the gaze has been off the chip, for the grace window */
  offChipMs: number
}

export function createAimState(): AimState {
  return { hover: null, hoverMs: 0, candidate: null, confirmMs: 0, offChipMs: 0 }
}

/** A direction, as plain numbers so the cone rule is testable without a scene. */
export type Vec3 = readonly [number, number, number]

/** Angle between two directions, in degrees. Zero-length counts as "nowhere
 *  near", so a missing chip position can never confirm anything. */
export function angleBetweenDeg(a: Vec3, b: Vec3): number {
  const la = Math.hypot(a[0], a[1], a[2])
  const lb = Math.hypot(b[0], b[1], b[2])
  if (la === 0 || lb === 0) return 180
  const cos = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (la * lb)
  return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI
}

/** Whether the gaze points close enough to the chip to count as resting on it. */
export function withinConfirmCone(
  gaze: Vec3,
  towardChip: Vec3,
  tolDeg: number = CONFIRM_TOL_DEG,
): boolean {
  return angleBetweenDeg(gaze, towardChip) <= tolDeg
}

export interface AimInput {
  /** the selectable object under the ray, if any */
  target: Object3D | null
  /** the ray is resting on the confirm chip */
  onConfirm: boolean
}

export interface AimResult {
  /** what the confirm chip should currently sit under, if anything */
  candidate: Object3D | null
  /** 0–1 confirm fill, shown on the reticle while dwelling on the chip */
  progress: number
  /** 0–1 arming fill, while a steady gaze claims a new candidate */
  armProgress: number
  /** the reticle is resting on something that means anything */
  armed: boolean
  /** confirmed this frame — fire the click on `AimState.candidate` */
  fire: boolean
  /**
   * Per-frame events, for `confirmTracking` to total up. They are reported
   * rather than counted here because this module is deliberately pure: the
   * same rules have to be replayable in a test without a clock or a headset.
   */
  /** a new candidate was claimed this frame */
  armedNew: boolean
  /** dwell lost to a slip off the chip this frame (ms of progress, not of time) */
  drainedMs: number
  /** this frame is where a slip first started costing — one per slip, not per frame */
  brokeOff: boolean
}

/** Advances the aim state by one frame. */
export function advanceAim(
  state: AimState,
  input: AimInput,
  dtMs: number,
  dwellMs: number = DWELL_MS,
  armMs: number = ARM_MS,
  graceMs: number = CONFIRM_GRACE_MS,
): AimResult {
  if (input.onConfirm) {
    // looking at the chip is not looking at a target: drop the arming timer so
    // glancing back up starts it cleanly
    state.hover = null
    state.hoverMs = 0
    state.offChipMs = 0

    if (state.candidate == null) {
      state.confirmMs = 0
      return { ...QUIET }
    }

    state.confirmMs += dtMs
    const progress = Math.min(1, state.confirmMs / dwellMs)
    const fire = state.confirmMs >= dwellMs
    if (fire) {
      // the caller reads `state.candidate` to know what to click, then clears
      state.confirmMs = 0
      return { ...QUIET, candidate: state.candidate, progress: 1, armed: true, fire: true }
    }
    return { ...QUIET, candidate: state.candidate, progress, armed: true }
  }

  // Off the chip, progress drains rather than resetting (see CONFIRM_GRACE_MS).
  // The ring keeps showing what is left, so an unsteady child watches it ebb
  // back a little instead of snapping to empty — which is also far less
  // discouraging to sit through.
  const slip = drainConfirm(state, dtMs, graceMs)
  const progress = confirmProgress(state, dwellMs)

  if (input.target == null) {
    state.hover = null
    state.hoverMs = 0
    // the candidate deliberately survives looking at nothing — the child has to
    // cross empty scenery to get from the face down to the chip beneath it
    return {
      ...QUIET,
      candidate: state.candidate,
      progress,
      drainedMs: slip.ms,
      brokeOff: slip.broke,
    }
  }

  if (input.target !== state.hover) {
    state.hover = input.target
    state.hoverMs = 0
  }
  state.hoverMs += dtMs
  let armedNew = false
  if (state.hoverMs >= armMs && state.candidate !== input.target) {
    armedNew = true
    state.candidate = input.target
    // Dwell earned toward the previous choice must never answer for this one.
    // Without the grace window an off-chip frame already wiped it; with the
    // window, a gaze that slipped off the chip and settled on a neighbouring
    // option would otherwise carry that progress across and fire for it.
    state.confirmMs = 0
    state.offChipMs = 0
  }

  return {
    candidate: state.candidate,
    progress: confirmProgress(state, dwellMs),
    armProgress: Math.min(1, state.hoverMs / armMs),
    armed: true,
    fire: false,
    armedNew,
    drainedMs: slip.ms,
    brokeOff: slip.broke,
  }
}

/** A frame in which nothing worth counting happened. */
const QUIET: AimResult = {
  candidate: null,
  progress: 0,
  armProgress: 0,
  armed: false,
  fire: false,
  armedNew: false,
  drainedMs: 0,
  brokeOff: false,
}

function confirmProgress(state: AimState, dwellMs: number): number {
  if (state.candidate == null) return 0
  return Math.min(1, state.confirmMs / dwellMs)
}

/**
 * Bleeds off confirm progress for a frame spent away from the chip.
 *
 * Only the part of the slip beyond the grace window is charged, and it is
 * charged once — tracking the slip's total length rather than per-frame means
 * the cost of looking away is the same whatever the frame rate.
 */
function drainConfirm(
  state: AimState,
  dtMs: number,
  graceMs: number,
): { ms: number; broke: boolean } {
  if (state.candidate == null || state.confirmMs === 0) {
    state.confirmMs = 0
    state.offChipMs = 0
    return { ms: 0, broke: false }
  }
  const chargedBefore = Math.max(0, state.offChipMs - graceMs)
  state.offChipMs += dtMs
  const chargedNow = Math.max(0, state.offChipMs - graceMs)
  const lost = Math.min(state.confirmMs, (chargedNow - chargedBefore) * CONFIRM_DECAY)
  state.confirmMs -= lost
  // one break per slip, counted where the grace window is first exceeded —
  // not once per frame, which would only measure the frame rate
  return { ms: lost, broke: chargedBefore === 0 && chargedNow > 0 }
}

/** Called after a fired selection has been dispatched. */
export function clearCandidate(state: AimState): void {
  state.candidate = null
  state.hover = null
  state.hoverMs = 0
  state.confirmMs = 0
  state.offChipMs = 0
}
