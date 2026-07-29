import type { Object3D } from 'three'

/**
 * Gaze selection for the 360 games — the pure part.
 *
 * The child looks at a target and keeps looking; once the gaze has rested on it
 * for `DWELL_MS` it is selected. Nothing is held and nothing is pressed, which
 * is the whole point — see `InputMethod` in `types.ts`. The r3f half lives in
 * `HeadSelect.tsx`; everything here is plain data so the arming and re-arming
 * rules are unit-testable without a headset (there is no way to drive a real
 * head pose from a test).
 */

/** How long the child must hold their gaze on a target to select it. */
export const DWELL_MS = 1600

/**
 * Objects opt in to being selectable by carrying `userData.headSelect`. Marking
 * is explicit rather than "anything with an onClick" because the scenes are
 * full of clickable furniture we do *not* want a wandering gaze to trip — and
 * because the flag is visible when reading a scene file.
 */
export const HEAD_SELECT_FLAG = 'headSelect'

/**
 * Walks up from the intersected object to the nearest ancestor marked
 * selectable. The scenes hang their click handlers on wrapper groups and hit
 * volumes rather than on the visible mesh, so the object the ray actually hits
 * is usually a child of the thing we care about.
 */
export function findSelectTarget(object: Object3D | null | undefined): Object3D | null {
  let node: Object3D | null | undefined = object
  while (node != null) {
    if (node.userData?.[HEAD_SELECT_FLAG] === true) return node
    node = node.parent
  }
  return null
}

export interface AimState {
  /** the selectable object under the reticle right now, if any */
  target: Object3D | null
  /** how long it has been continuously under the reticle, ms */
  heldMs: number
  /**
   * The target a selection last fired on. It stays locked out until the gaze
   * moves elsewhere, so a child who keeps staring after a dwell completes does
   * not fire the same answer over and over. Cleared by looking away — including
   * looking at nothing — which is a gesture every child makes naturally.
   */
  firedOn: Object3D | null
}

export function createAimState(): AimState {
  return { target: null, heldMs: 0, firedOn: null }
}

export interface AimResult {
  /** 0–1 dwell ring fill; 0 while locked out */
  progress: number
  /** the reticle is on a live target and a selection would land */
  armed: boolean
  /** dwell completed this frame — fire the click */
  fire: boolean
}

/** Advances the aim state by one frame. */
export function advanceAim(
  state: AimState,
  target: Object3D | null,
  dtMs: number,
  dwellMs: number = DWELL_MS,
): AimResult {
  // any move off the last-fired target re-arms it
  if (state.firedOn != null && target !== state.firedOn) state.firedOn = null

  if (target !== state.target) {
    state.target = target
    state.heldMs = 0
  }

  if (target == null) return { progress: 0, armed: false, fire: false }
  // still staring at what we just selected — hold everything until they move on
  if (target === state.firedOn) return { progress: 0, armed: false, fire: false }

  state.heldMs += dtMs

  const progress = Math.min(1, state.heldMs / dwellMs)
  const fire = state.heldMs >= dwellMs
  if (fire) {
    state.firedOn = target
    state.heldMs = 0
  }
  return { progress, armed: true, fire }
}
