import type { Difficulty } from '../../types'

export type ExhibitId = 'gem' | 'dino' | 'rocket' | 'vase' | 'mask' | 'crystal'

export interface ExhibitMeta {
  id: ExhibitId
  label: string
  emoji: string
}

export const EXHIBITS: ExhibitMeta[] = [
  { id: 'gem', label: 'Gem', emoji: '💎' },
  { id: 'dino', label: 'Dino', emoji: '🦕' },
  { id: 'rocket', label: 'Rocket', emoji: '🚀' },
  { id: 'vase', label: 'Vase', emoji: '🏺' },
  { id: 'mask', label: 'Mask', emoji: '🎭' },
  { id: 'crystal', label: 'Crystal', emoji: '🔮' },
]

export function exhibitMeta(id: ExhibitId): ExhibitMeta {
  return EXHIBITS.find((e) => e.id === id)!
}

/** how many pedestals surround the child — more exhibits = harder to follow the cue */
const COUNT: Record<Difficulty, number> = { easy: 3, medium: 4, hard: 6 }

/**
 * Same joint-attention design as Museum Look (see museum/logic.ts), lifted into
 * an immersive first-person gallery: the child stands inside the rotunda and
 * the exhibits sit in a gentle arc directly in front of them, with the helper
 * avatar behind the row facing them. Following the cue is a comfortable head
 * turn along the row (never a body spin behind the child) — the ergonomic,
 * headset-friendly version of a real "look where I'm pointing" exchange.
 *
 * Cue fading follows Museum Look's ladder, but every cue comes from ONE
 * helper avatar (a second floating hand split attention — Quest pilot):
 *  - pulse:  avatar points + fingertip sparkle trail + glowing target ring
 *  - hover:  avatar points + fingertip sparkle trail
 *  - distal: avatar points, nothing else
 *  - gaze:   no gesture — the avatar only turns to look at the target
 * with the same least-to-most support on errors and the same gaze schedule.
 */
export type CueMode = 'pulse' | 'hover' | 'distal' | 'gaze'
/** the hand's support ladder — fades one rung per success streak (gaze is separate) */
export const HAND_LADDER: CueMode[] = ['pulse', 'hover', 'distal']
export const START_TIER: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 }
/** consecutive first-attempt finds needed to fade the hand cue one rung */
export const FADE_STREAK = 3

export function fadedTier(tier: number): number {
  return Math.min(tier + 1, HAND_LADDER.length - 1)
}

export function supportedTier(tier: number, difficulty: Difficulty): number {
  return Math.max(tier - 1, START_TIER[difficulty])
}

/** whether a trial presents the pointing hand or the gaze-only helper */
export type CueKind = 'hand' | 'gaze'

/** gaze-cue trials per session — the rest use the hand (roughly 40-50% gaze). */
export const GAZE_TRIALS: Record<Difficulty, number> = { easy: 2, medium: 3, hard: 5 }

/**
 * The cue kind for each of a session's `GOAL` trials. Gaze trials are spread
 * evenly across the session and never land on the opening trial (which stays on
 * the more supportive hand), so gaze is probed steadily rather than just once.
 */
export function cueSchedule(difficulty: Difficulty): CueKind[] {
  const goal = GOAL[difficulty]
  const gaze = Math.min(GAZE_TRIALS[difficulty], goal)
  const schedule: CueKind[] = Array(goal).fill('hand')
  for (let i = 0; i < gaze; i++) {
    const pos = Math.floor(((i + 0.5) * goal) / gaze)
    schedule[Math.min(pos, goal - 1)] = 'gaze'
  }
  return schedule
}

/**
 * The cue shown for the current trial. A gaze trial the child has already
 * missed this round drops back to the hand for the retry (least-to-most: if the
 * gaze alone wasn't followed, bring the pointing gesture back to support it).
 */
export function trialCue(kind: CueKind, handTier: number, hasErred: boolean): CueMode {
  if (kind === 'gaze' && !hasErred) return 'gaze'
  return HAND_LADDER[handTier]
}

/** correct finds needed to win a session */
export const GOAL: Record<Difficulty, number> = { easy: 5, medium: 7, hard: 10 }

/**
 * Child-facing points. Independent (first-attempt) responses earn more
 * than corrected ones; retries are still rewarded, never punished.
 */
export const POINTS = { first: 10, retry: 5, streakBonus: 2 }
/** consecutive first-attempt finds needed before the streak bonus kicks in */
export const STREAK_LEN = 3

export function pointsFor(firstAttempt: boolean, streakAfterThis: number): number {
  if (!firstAttempt) return POINTS.retry
  return POINTS.first + (streakAfterThis >= STREAK_LEN ? POINTS.streakBonus : 0)
}

/**
 * Researcher-facing error classification: tapping the pedestal right next
 * to the target is a near-miss (the cue's direction was roughly followed); a
 * pick further around the room suggests the cue itself was not followed.
 */
export function errorType(visible: ExhibitId[], target: ExhibitId, picked: ExhibitId): 'adjacent' | 'far' {
  return Math.abs(visible.indexOf(target) - visible.indexOf(picked)) <= 1 ? 'adjacent' : 'far'
}

/**
 * Stars reward *first-try* finds (the game never fails — wrong taps are only
 * gently corrected, per the joint-attention "errors are never punished"
 * principle). 3 stars ≥80% of finds were first-attempt, 2 ≥50%, else 1 — every
 * finished session earns at least one.
 */
export function starsFor(firstAttemptFinds: number, goal: number): number {
  const ratio = goal > 0 ? firstAttemptFinds / goal : 0
  if (ratio >= 0.8) return 3
  if (ratio >= 0.5) return 2
  return 1
}

export interface Round {
  target: ExhibitId
  /** exhibits on display, clockwise around the room; the cue indicates `target` */
  visible: ExhibitId[]
}

export function makeRound(
  difficulty: Difficulty,
  prevTarget: ExhibitId | null,
  rng: () => number = Math.random,
): Round {
  const n = COUNT[difficulty]
  const targets = EXHIBITS.filter((e) => e.id !== prevTarget)
  const target = targets[Math.floor(rng() * targets.length)].id
  const others = shuffle(EXHIBITS.filter((e) => e.id !== target).map((e) => e.id), rng)
  const visible = shuffle([target, ...others.slice(0, n - 1)], rng)
  return { target, visible }
}

/* ---- front-row layout ------------------------------------------------------
 * Bearings are radians left(−)/right(+) of straight-ahead (bearing 0 = the
 * direction the view faces when a session starts). The exhibits sit in a
 * shallow arc in FRONT of the child — every pedestal within ±FRONT_HALF_ARC of
 * centre, so the whole row is a gentle head turn away and nothing hides behind
 * the child. All exhibits share one radius, so they're equidistant (steady
 * focus in a headset). The helper avatar stands behind the row, facing the
 * child, so its gaze/point reads across the exhibits.
 */

/** distance from the child at the centre to each pedestal in the front row */
export const EXHIBIT_RADIUS = 5.4
/** half-width of the row: exhibits span from −this to +this around straight-ahead */
export const FRONT_HALF_ARC = (Math.PI * 40) / 180

/** Bearing of pedestal `index` of `n`, spread evenly across the front arc. */
export function slotBearing(index: number, n: number): number {
  if (n === 1) return 0
  return -FRONT_HALF_ARC + (index / (n - 1)) * (2 * FRONT_HALF_ARC)
}

/** Convert a bearing to floor coordinates (bearing 0 = forward, toward -z). */
export function bearingToXZ(bearing: number, radius: number): [number, number] {
  return [Math.sin(bearing) * radius, -Math.cos(bearing) * radius]
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
 * The last look-around drag, measured by the scene's own controls. Exhibit
 * taps are ignored right after a drag — independent of which event system
 * delivered the click, since the XR layer forwards a second copy of every
 * screen event whose drag distance is unreadable (see dragDistance).
 * Lives here (not in the scene file) so hot reload never duplicates it and
 * the guard is unit-testable.
 */
export const lookDrag = { px: 0, endedAt: 0 }

/** whether a click arriving now is just the tail end of a look-around drag */
export function isDragTail(now: number = Date.now()): boolean {
  return lookDrag.px > 8 && now - lookDrag.endedAt < 700
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
