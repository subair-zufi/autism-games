import type { Difficulty } from '../../types'

export type ExhibitId = 'butterfly' | 'bird' | 'doll' | 'balloon' | 'flower' | 'fish'

export interface ExhibitMeta {
  id: ExhibitId
  label: string
  emoji: string
}

// Warm, friendly things a child recognizes and likes — a butterfly, a bird, a
// doll — rather than abstract museum artefacts (a gem, a vase, a mask). The
// joint-attention task is the same, but the reward of finding a cheerful,
// colourful character keeps an autistic child engaged and motivated to play.
export const EXHIBITS: ExhibitMeta[] = [
  { id: 'butterfly', label: 'Butterfly', emoji: '🦋' },
  { id: 'bird', label: 'Bird', emoji: '🐦' },
  { id: 'doll', label: 'Doll', emoji: '🪆' },
  { id: 'balloon', label: 'Balloon', emoji: '🎈' },
  { id: 'flower', label: 'Flower', emoji: '🌸' },
  { id: 'fish', label: 'Fish', emoji: '🐠' },
]

export function exhibitMeta(id: ExhibitId): ExhibitMeta {
  return EXHIBITS.find((e) => e.id === id)!
}

/** how many pedestals are in the row — more exhibits = harder to follow the cue */
const COUNT: Record<Difficulty, number> = { easy: 3, medium: 4, hard: 5 }

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

/* ---- front-row layout, arced around the AVATAR -----------------------------
 * The exhibits sit on an arc CENTRED ON THE HELPER AVATAR (not the child): the
 * avatar stands at the arc's centre and the pedestals fan out in front of it,
 * toward the child. Two consequences:
 *  1. Every exhibit is equidistant from the avatar and evenly spaced *in the
 *     avatar's own field of view*, so the avatar's gaze/point angle to each
 *     one is distinct — the child can tell the far-right exhibit from a middle
 *     one (arcing around the *child* instead compressed those angles and made
 *     the cue ambiguous, especially on the busiest level).
 *  2. Because the pedestals are one radius away from the avatar in every
 *     direction, none sits at the avatar's body — the exhibit is always well
 *     in front of it (this also fixes the old centre-exhibit overlap).
 * `slotAngle` is the angle from the avatar's forward direction; `slotPosition`
 * is the resulting floor position. Everything is still in front of the child,
 * a gentle head turn away — nothing behind them.
 */

/** the avatar (and the arc's centre) stands this far back, on the −z axis */
export const AVATAR_Z = -7.4
/** distance from the avatar to each pedestal on the arc */
export const OBJECT_RADIUS = 4.2
/** half-width of the arc: exhibits span ±this around the avatar's forward line */
export const FRONT_HALF_ARC = (Math.PI * 40) / 180

/** Angle of pedestal `index` of `n` from the avatar's forward direction. */
export function slotBearing(index: number, n: number): number {
  if (n === 1) return 0
  return -FRONT_HALF_ARC + (index / (n - 1)) * (2 * FRONT_HALF_ARC)
}

/** Floor [x, z] of pedestal `index` of `n`, on the arc centred on the avatar. */
export function slotPosition(index: number, n: number): [number, number] {
  const a = slotBearing(index, n)
  return [Math.sin(a) * OBJECT_RADIUS, AVATAR_Z + Math.cos(a) * OBJECT_RADIUS]
}

/** The child's head-turn to face pedestal `index`, in degrees left(−)/right(+)
 *  of straight-ahead — recorded per trial as the attention-shift size. */
export function slotHeadingDeg(index: number, n: number): number {
  const [x, z] = slotPosition(index, n)
  return Math.round((Math.atan2(x, -z) * 180) / Math.PI)
}

/* ---- tap / gaze targets: large, but never into a neighbour ----------------
 *
 * The arc is centred on the AVATAR (see above), which keeps the avatar's own
 * pointing angles distinct — but it means distance from the CHILD varies a
 * lot: on hard the centre pedestal is 3.20 m away and the outermost 4.98 m.
 * Every exhibit nevertheless carried the same ~1 m hit box, so from the child
 * those boxes subtended anywhere from 11.5° to 17.8° while the two outer pairs
 * sat only 10.3° apart.
 *
 * They therefore OVERLAPPED: exhibit 0 spanned −38.6°…−27.1° and exhibit 1
 * spanned −30.2°…−15.0°, and in that shared 3.1° band the raycaster returns
 * whichever is NEARER — exhibit 1. A child looking squarely at the inner edge
 * of the outermost exhibit selected its neighbour instead, and the trial was
 * recorded as `errorType: 'adjacent'`, a *behavioural* category meaning
 * "followed the cue's direction but not far enough". A geometry defect was
 * being read as a child's attention failing.
 *
 * So each target is sized from the gap it actually has. The volume is a SPHERE
 * rather than a box: a box's silhouette widens toward its diagonal as the
 * child looks along the row, so its true angular width depends on viewing
 * angle, while a sphere presents the same disc from everywhere and the
 * arithmetic below is exact.
 *
 * Deliberately NOT equalising apparent size. Scaling the models themselves to
 * a constant angle would also have fixed this, but it flattens the row's depth
 * cues — and the child uses those to work out which exhibit the avatar's
 * pointing vector lands on. Natural perspective is kept; only the invisible
 * target shrinks.
 *
 * The cost, stated plainly: on hard, exhibits 1 and 3 end up with about 1.5°
 * of visible model on each side that is not tappable (~10 cm on an ~80 cm
 * model at 3.74 m). Every other exhibit at every level keeps a target LARGER
 * than its model, which is the generous padding this game has always had.
 */

/** The biggest a target ever gets — a little wider than the ~1 m models, which
 *  is the padding the uncrowded positions keep. */
export const HIT_RADIUS_MAX = 0.6

/** Fraction of a neighbour gap one exhibit's target may claim. Two neighbours
 *  each claiming this leaves 1 − 2×0.45 = 10% of the gap as a guard band. */
const HIT_GAP_SHARE = 0.45

/** Distance from the child (at the origin) to pedestal `index` of `n`. */
export function slotDistance(index: number, n: number): number {
  const [x, z] = slotPosition(index, n)
  return Math.hypot(x, z)
}

/** The smallest heading gap between exhibit `index` and an adjacent one (deg). */
export function neighbourGapDeg(index: number, n: number): number {
  const self = slotHeadingDeg(index, n)
  let gap = Infinity
  for (const j of [index - 1, index + 1]) {
    if (j < 0 || j >= n) continue
    gap = Math.min(gap, Math.abs(slotHeadingDeg(j, n) - self))
  }
  return gap
}

/** Radius (m) of exhibit `index`'s tap/gaze sphere — capped so it stays a
 *  generous target, and clamped so it can never reach a neighbour. */
export function hitRadius(index: number, n: number): number {
  const gap = neighbourGapDeg(index, n)
  if (!Number.isFinite(gap)) return HIT_RADIUS_MAX
  const budgetRad = (gap * HIT_GAP_SHARE * Math.PI) / 180
  return Math.min(HIT_RADIUS_MAX, slotDistance(index, n) * Math.sin(budgetRad))
}

/** Half the angle that target subtends from the child (deg) — the quantity the
 *  overlap above was a failure of, and what the layout test asserts on. */
export function hitHalfAngleDeg(index: number, n: number): number {
  const d = slotDistance(index, n)
  return (Math.asin(Math.min(1, hitRadius(index, n) / d)) * 180) / Math.PI
}

/* ---- the helper avatar, and whether the child can actually see it ---------
 *
 * These live here, beside the pedestal layout they have to clear, because the
 * two are one geometry problem. In a headset the camera sits at the WEARER's
 * real eye height (`local-floor`) and nothing re-centres the world for a short
 * one, so a 7–10 year-old views this room from 1.05–1.35 m rather than the
 * 1.7 m the scene declares. Everything then rises in their view — and on the
 * odd slot counts (easy's 3, hard's 5) one pedestal sits exactly on the
 * avatar's bearing, 3.2 m away against the avatar's 7.4 m. It cut the avatar
 * off at the waist and swallowed the pointing hand.
 *
 * `handClearanceDeg` is the property that must hold, and the test pins it at
 * the shortest eye height we design for. The scene imports these constants, so
 * lowering the podium or shrinking the avatar fails that test rather than
 * silently hiding the cue again.
 */

/**
 * Podium height — the avatar's feet stand here.
 *
 * Lowered from 1.2 after play: following the avatar's GAZE meant holding the
 * head up at 17-19 degrees for most of a session, and sustained upward gaze is
 * the uncomfortable direction (see hudAnchor.ts). It cannot simply come down,
 * though — the avatar has to clear the exhibit row 3.2 m in front of it, which
 * is why it was raised in the first place. The room gives that back by setting
 * the exhibits lower too (`PEDESTAL_H`), so the whole scene drops together and
 * the hand keeps exactly the clearance it had.
 */
export const HELPER_LIFT = 0.8
/** The avatar's body is drawn this much larger than life (see Museum360Scene). */
export const HELPER_SCALE = 1.25
/** Shoulder height above the avatar's feet, body-local (before the scale). */
export const HELPER_SHOULDER_Y = 1.4
/** Shoulder to fingertip, body-local (before the scale). */
export const HELPER_ARM_LEN = 1.05

/** Tallest exhibit model's top above `EXHIBIT_Y` — the worst-case occluder. */
export const EXHIBIT_MODEL_TOP = 0.62
/**
 * Pedestal height, and with it the whole row's height.
 *
 * Lowered alongside the podium. It is what buys the avatar's drop: the thing
 * the avatar must see over is the top of this row, so taking 0.2 m off the
 * plinths lets the helper come down 0.4 m for the same clearance. It also
 * suits the players — the exhibits now sit a little BELOW a child's eye line
 * rather than on it, and down is the restful direction to look.
 */
export const PEDESTAL_H = 0.4
/** World height of an exhibit's centre (pedestal height + half the model). */
export const EXHIBIT_Y = PEDESTAL_H + 0.5

/** The shortest eye height the room is expected to work at (a seated child). */
export const MIN_DESIGN_EYE_Y = 0.95

/**
 * How far below the shoulder the pointing arm may ever angle.
 *
 * Aimed straight at the plinth the arm dropped ~24°, putting the hand behind
 * the centre pedestal for a child. Levelling it entirely clears the row, but
 * costs too much the other way: on odd slot counts the avatar, the centre
 * exhibit and the child are collinear, so a level arm points straight down the
 * child's line of sight and foreshortens into a dot. 12° clears the row at
 * `MIN_DESIGN_EYE_Y` with ~1.5° to spare while leaving that worst-case gesture
 * ~2.7° of visible extent.
 */
export const MAX_POINT_DEPRESSION_DEG = 10

function elevationDeg(y: number, dist: number, eyeY: number): number {
  return (Math.atan((y - eyeY) / dist) * 180) / Math.PI
}

/**
 * Elevation below which the centre pedestal hides whatever is behind it, for a
 * child whose eyes are at `eyeY`. Returns −Infinity for an even `n`, where no
 * pedestal sits on the avatar's bearing and nothing is occluded.
 */
export function centreOccluderElevationDeg(n: number, eyeY: number): number {
  const centre = (n - 1) / 2
  if (!Number.isInteger(centre)) return -Infinity
  const [x, z] = slotPosition(centre, n)
  return elevationDeg(EXHIBIT_Y + EXHIBIT_MODEL_TOP, Math.hypot(x, z), eyeY)
}

/**
 * How far above the centre pedestal's top edge the pointing fingertip sits
 * when the avatar points at exhibit `index` of `n`, in degrees. Negative means
 * the gesture is hidden behind the pedestal.
 *
 * The arm aims at the exhibit but never angles further down than
 * `MAX_POINT_DEPRESSION_DEG`, which is what keeps the hand above the row.
 */
export function handClearanceDeg(index: number, n: number, eyeY: number): number {
  const [tx, tz] = slotPosition(index, n)
  const yaw = Math.atan2(tx, tz - AVATAR_Z)
  const shoulder = {
    x: Math.cos(yaw) * 0.3 * HELPER_SCALE,
    y: HELPER_LIFT + HELPER_SHOULDER_Y * HELPER_SCALE,
    z: AVATAR_Z - Math.sin(yaw) * 0.3 * HELPER_SCALE,
  }
  const dx = tx - shoulder.x
  const dz = tz - shoulder.z
  let dy = EXHIBIT_Y - shoulder.y
  const horiz = Math.hypot(dx, dz)
  // the same clamp the scene applies each frame
  const maxDrop = horiz * Math.tan((MAX_POINT_DEPRESSION_DEG * Math.PI) / 180)
  if (dy < -maxDrop) dy = -maxDrop
  const len = Math.hypot(dx, dy, dz)
  const reach = HELPER_ARM_LEN * HELPER_SCALE
  const fx = shoulder.x + (dx / len) * reach
  const fy = shoulder.y + (dy / len) * reach
  const fz = shoulder.z + (dz / len) * reach
  return elevationDeg(fy, Math.hypot(fx, fz), eyeY) - centreOccluderElevationDeg(n, eyeY)
}

/**
 * How far a child whose eyes are at `eyeY` must look UP to meet the avatar's.
 *
 * The gaze rung asks them to hold that look while the avatar makes its bid and
 * shifts, so it is a sustained posture, not a glance. Past roughly 20 degrees
 * it is the uncomfortable direction, and play found 17-19 degrees already too
 * much. Paired with `handClearanceDeg`: lowering the avatar improves this one
 * and costs the other, so both are pinned.
 */
export function avatarEyeElevationDeg(eyeY: number): number {
  const eyes = HELPER_LIFT + 1.77 * HELPER_SCALE
  return elevationDeg(eyes, Math.abs(AVATAR_Z), eyeY)
}

/** Convert a bearing to floor coordinates (bearing 0 = forward, toward -z).
 *  Used for wall decor arranged around the rotunda (centred on the child). */
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
