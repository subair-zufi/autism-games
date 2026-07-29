/**
 * Shared VR/360 practice scene — pure, unit-testable pieces.
 *
 * Every 360 game shares one interaction model: drag-to-look (or a real head
 * turn in VR), then tap to select. Until now a child's very first contact
 * with it happened inside a scored session, so headset novelty and the skill
 * being measured were confounded (review U2). This one-time, unscored warm-up
 * — gated by `vrPracticeDone` in `state/settings.ts` — teaches the gesture
 * before any real session starts, and never runs again once completed.
 */

import type { InputMethod } from '../../types'

/**
 * Practice targets in order: straight ahead first (the tap gesture alone,
 * no turn needed), then one to each side — a real look-around turn, same
 * front-arc comfort rule every 360 game follows (nothing behind the child).
 */
export const PRACTICE_BEARINGS_DEG = [0, -30, 30]

export function isPracticeComplete(tappedCount: number): boolean {
  return tappedCount >= PRACTICE_BEARINGS_DEG.length
}

/** How long the "Great tap!" beat shows after each successful target. */
export const PRACTICE_FEEDBACK_MS = 900

/** The instruction keys the warm-up can show (see `i18n/strings.ts`). */
export type PracticePromptKey =
  | 'practiceIntro'
  | 'practiceIntroPoke'
  | 'practiceIntroDwell'
  | 'practiceGreat'
  | 'practiceReady'

/**
 * Which instruction to show right now.
 *
 * Inside a headset the child selects with whichever controller-free method is
 * set in Profile → Selection, and those are different physical acts — poking a
 * pad is not holding a gaze — so the warm-up has to name the one they will
 * actually use. Outside a session the mouse selects and the generic "tap"
 * wording is still the right one.
 *
 * Confirming a target is exactly what a new input method makes uncertain
 * ("did my poke land?"), so a success beat takes priority over the standing
 * instruction.
 */
export function practicePromptKey(opts: {
  ready: boolean
  celebrating: boolean
  /** true only while an immersive session is actually presenting */
  inVR: boolean
  inputMethod: InputMethod
}): PracticePromptKey {
  if (opts.ready) return 'practiceReady'
  if (opts.celebrating) return 'practiceGreat'
  if (!opts.inVR) return 'practiceIntro'
  return opts.inputMethod === 'poke' ? 'practiceIntroPoke' : 'practiceIntroDwell'
}

/**
 * How far the pointer travelled between press and release, in screen pixels —
 * used to ignore "taps" that were really look-around drags. Screen events
 * (r3f) report this as `delta`; XR controller/hand events (pmndrs/
 * pointer-events) *throw* on accessing it, so those count as clean taps —
 * correct, since in VR the head does the looking and no drag exists.
 */
export function dragDistance(e: { delta?: number }): number {
  try {
    return e.delta ?? 0
  } catch {
    return 0
  }
}

/**
 * The last look-around drag, measured by the scene's own controls. Taps are
 * ignored right after a drag — independent of which event system delivered
 * the click, since the XR layer forwards a second copy of every screen event
 * whose drag distance is unreadable (see dragDistance). Lives here (not in
 * the scene file) so hot reload never duplicates it and the guard is
 * unit-testable.
 */
export const lookDrag = { px: 0, endedAt: 0 }

/** whether a click arriving now is just the tail end of a look-around drag */
export function isDragTail(now: number = Date.now()): boolean {
  return lookDrag.px > 8 && now - lookDrag.endedAt < 700
}
