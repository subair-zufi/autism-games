import type { Difficulty } from '../../types'

/**
 * Emotion Clips 360 — *naming an emotion in motion*, immersive.
 *
 * The flat Emotion Clips game (see identifyemotions/logic.ts) lifted into a
 * calm first-person media room: the child sits facing one big screen, watches a
 * short clip that freezes on its expressive frame, and names the feeling by
 * tapping an in-world choice card. Everything about the quiz — which clips,
 * where each freezes (peak vs. early on Hard), the tiered distractors, the
 * "why does he/she feel …?" cause follow-up — is REUSED unchanged from the flat
 * game via `buildQuiz`; only the presentation is immersive.
 *
 * Unlike the other 360 games there is no head-turn/scan metric here: a single
 * screen sits straight ahead. The 360 value is the shared-space "watch
 * together on the big screen" framing and headset comfort, so the one design
 * job is screen ergonomics — see the SCREEN_* constants.
 */
export {
  buildQuiz,
  VIDEO_COUNT,
  CHOICE_COUNT,
  DISTRACTOR_TIER,
  FREEZE_KIND,
  type VideoQuestion,
  type VideoClip,
  type CauseQuestion,
  type FreezeKind,
} from '../identifyemotions/logic'

import { VIDEO_COUNT } from '../identifyemotions/logic'

/** the child's eye height — the camera sits here, facing the screen */
export const EYE_Y = 1.5

/**
 * Big-screen ergonomics (the user's brief: comfortable to watch, not too close,
 * not too far). A 3.2 m × 1.8 m (16:9) screen 4.5 m away subtends ~39°
 * horizontally / ~23° vertically — a comfortable "big screen" that fills the
 * central field of view without forcing eye strain or a sweep of the head. Its
 * centre sits at 1.7 m, a touch above the child's 1.5 m eye line (a ~2.5° up
 * glance), which lifts the screen's bottom edge clear of the answer cards below
 * so nothing overlaps the picture. The screen stands dead ahead at bearing 0
 * (toward -z), the natural resting direction.
 */
export const SCREEN_W = 3.2
export const SCREEN_H = 1.8
export const SCREEN_Y = 1.7
export const SCREEN_DISTANCE = 4.5

/**
 * The answer cards sit on a strip *below* the screen — near enough to read and
 * tap comfortably (2.5 m) and low enough (0.75 m) that, being closer to the
 * child than the screen, they project fully beneath its bottom edge and never
 * cover the face. The child glances down to the cards and up to the screen,
 * like watching a show and answering on a panel; they never require a head turn.
 */
export const CARD_RADIUS = 2.5
export const CARD_Y = 0.75
/** angular gap between adjacent answer cards */
export const CARD_STEP_DEG = 16

/** Signed bearing of the i-th of n answer cards, centred on straight-ahead. */
export function cardBearingDeg(i: number, n: number): number {
  return (i - (n - 1) / 2) * CARD_STEP_DEG
}

/** Convert a bearing to floor coordinates (bearing 0 = forward, toward -z). */
export function bearingToXZ(bearingRad: number, radius: number): [number, number] {
  return [Math.sin(bearingRad) * radius, -Math.cos(bearingRad) * radius]
}

/** Floor [x, z] of the i-th answer card. */
export function cardPosition(i: number, n: number): [number, number] {
  return bearingToXZ((cardBearingDeg(i, n) * Math.PI) / 180, CARD_RADIUS)
}

/**
 * The "why?" (cause) options are whole sentences, not single emotion words, so
 * they get their own wider, roomier layout: bigger cards, spaced far enough
 * apart that adjacent sentences never overlap, and a little further out so the
 * wrapped text stays comfortably readable. (The emotion-naming cards above stay
 * small and tight — one word each.)
 */
export const CAUSE_RADIUS = 3.0
export const CAUSE_Y = 1.05
export const CAUSE_STEP_DEG = 26

/** Signed bearing of the i-th of n cause cards, centred on straight-ahead. */
export function causeBearingDeg(i: number, n: number): number {
  return (i - (n - 1) / 2) * CAUSE_STEP_DEG
}

/** Clips in a session at each difficulty (the quiz length). */
export function sessionLength(difficulty: Difficulty): number {
  return VIDEO_COUNT[difficulty]
}

/**
 * Child-facing points. A first-try naming is worth full marks; getting there
 * after a "let's look again" replay still earns half, the same first/retry
 * split every other 360 game uses.
 *
 * It used to pay 0 for a corrected answer, which made this the one game in the
 * set that punished a retry — against the no-fail principle the others state
 * explicitly, and odd next to a scaffold whose whole job is to invite a second
 * look. Only the child-facing score changes: stars, the level row submitted to
 * `game_progress` and the server's `_clips_trials` all count FIRST-try answers
 * and are unaffected.
 */
export const POINTS = { first: 10, retry: 5 }

export function pointsFor(firstTryCorrect: boolean): number {
  return firstTryCorrect ? POINTS.first : POINTS.retry
}

/**
 * Stars reward accuracy over the session: 3 ≥80% first-try, 2 ≥50%, else 1 —
 * every finished session earns at least one.
 */
export function starsFor(firstTryCorrect: number, total: number): number {
  const ratio = total > 0 ? firstTryCorrect / total : 0
  if (ratio >= 0.8) return 3
  if (ratio >= 0.5) return 2
  return 1
}

/**
 * How far the pointer travelled between press and release, in screen pixels —
 * used to ignore "taps" that were really look-around drags. Screen events
 * (r3f) report this as `delta`; XR controller/hand events (pmndrs/
 * pointer-events) *throw* on accessing it, so those count as clean taps.
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
 * ignored right after a drag. Lives here (not in the scene file) so hot reload
 * never duplicates it and the guard is unit-testable.
 */
export const lookDrag = { px: 0, endedAt: 0 }

/** whether a click arriving now is just the tail end of a look-around drag */
export function isDragTail(now: number = Date.now()): boolean {
  return lookDrag.px > 8 && now - lookDrag.endedAt < 700
}
