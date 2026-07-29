import type { Object3D } from 'three'

/**
 * Gaze selection for the 360 games — the pure part.
 *
 * Selection is deliberately **two-stage**. Resting the gaze on something makes
 * it the *candidate* and pops a confirm chip just beneath it; only dwelling on
 * that chip answers. A single-stage dwell cannot work in these games, because
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
}

export function createAimState(): AimState {
  return { hover: null, hoverMs: 0, candidate: null, confirmMs: 0 }
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
}

/** Advances the aim state by one frame. */
export function advanceAim(
  state: AimState,
  input: AimInput,
  dtMs: number,
  dwellMs: number = DWELL_MS,
  armMs: number = ARM_MS,
): AimResult {
  if (input.onConfirm) {
    // looking at the chip is not looking at a target: drop the arming timer so
    // glancing back up starts it cleanly
    state.hover = null
    state.hoverMs = 0

    if (state.candidate == null) {
      state.confirmMs = 0
      return { candidate: null, progress: 0, armProgress: 0, armed: false, fire: false }
    }

    state.confirmMs += dtMs
    const progress = Math.min(1, state.confirmMs / dwellMs)
    const fire = state.confirmMs >= dwellMs
    if (fire) {
      // the caller reads `state.candidate` to know what to click, then clears
      state.confirmMs = 0
      return { candidate: state.candidate, progress: 1, armProgress: 0, armed: true, fire: true }
    }
    return { candidate: state.candidate, progress, armProgress: 0, armed: true, fire: false }
  }

  state.confirmMs = 0

  if (input.target == null) {
    state.hover = null
    state.hoverMs = 0
    // the candidate deliberately survives looking at nothing — the child has to
    // cross empty scenery to get from the face down to the chip beneath it
    return { candidate: state.candidate, progress: 0, armProgress: 0, armed: false, fire: false }
  }

  if (input.target !== state.hover) {
    state.hover = input.target
    state.hoverMs = 0
  }
  state.hoverMs += dtMs
  if (state.hoverMs >= armMs) state.candidate = input.target

  return {
    candidate: state.candidate,
    progress: 0,
    armProgress: Math.min(1, state.hoverMs / armMs),
    armed: true,
    fire: false,
  }
}

/** Called after a fired selection has been dispatched. */
export function clearCandidate(state: AimState): void {
  state.candidate = null
  state.hover = null
  state.hoverMs = 0
  state.confirmMs = 0
}
