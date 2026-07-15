import type { Difficulty } from '../../types'
import type { Gender } from '../../i18n/strings'
import {
  pickDistractors,
  shuffle,
  type DistractorTier,
  type EmotionId,
} from '../emotionVocab'
import { SINGLE_IMAGES, singleImagesFor } from '../emotionrecognition/content'

/**
 * Emotion Recognition 360 — *recognizing* an emotion by scanning faces, immersive.
 *
 * The flat game's "Who feels ___?" question lifted into a first-person 360°
 * gallery: two or three framed face-boards stand across the FRONT half-circle,
 * each showing one real single-person photo (the same `SINGLE_IMAGES` assets as
 * the flat game). The child hears/reads the target emotion, turns the view — a
 * real head turn in VR — to look at each face, and taps the board of the person
 * who feels it.
 *
 * What carries over unchanged from Emotion Recognition (see
 * emotionrecognition/logic.ts): stratified targets (every available emotion is
 * asked before any repeats) and tiered distractors (Easy pairs the target with
 * a far, non-confusable emotion; Hard forces a confusable one — fear↔surprise,
 * anger↔disgust …), so "level" stays a perceptual-difficulty construct.
 *
 * What is new — and the reason this game exists in VR — is the scan: every
 * answer records the correct board's signed bearing (`targetBearingDeg`), i.e.
 * how far the child had to turn to reach the right face, the same
 * attention-shift measure as the other 360 games. Everything playable stays in
 * the front arc so finding the face is a comfortable head turn, never a spin.
 */

/** Half-width of the playable arc: no board sits beyond ±this. */
export const FRONT_HALF_ARC_DEG = 40

/**
 * Where the boards stand, by how many there are. Two boards flank the front;
 * three add one straight ahead. Spacing is wide enough to force a real look but
 * close enough that the neighbouring faces stay in peripheral view.
 */
export const BEARINGS: Record<number, number[]> = {
  2: [-22, 22],
  3: [-32, 0, 32],
}

/** How far each board stands from the child (who never moves). */
export const BOARD_RADIUS = 4.2

export interface RoundConfig {
  /** how many face-boards stand up each round (also the guessing denominator) */
  boardCount: number
  /** how confusable the wrong faces are */
  tier: DistractorTier
  /**
   * ms after the boards appear before a "look around" hint fires (gentle chime
   * + a soft ring under the correct board). `null` = no hint ever.
   */
  hintAfterMs: number | null
  /** correct answers needed to finish a session */
  goal: number
}

export const CONFIG: Record<Difficulty, RoundConfig> = {
  easy: { boardCount: 2, tier: 'low', hintAfterMs: 5000, goal: 6 },
  medium: { boardCount: 3, tier: 'mixed', hintAfterMs: 9000, goal: 8 },
  hard: { boardCount: 3, tier: 'high', hintAfterMs: null, goal: 10 },
}

/** One face on one board. */
export interface Board {
  emotion: EmotionId
  imageSrc: string
  gender: Gender
  /** signed bearing from straight-ahead, degrees left(−)/right(+) */
  bearingDeg: number
}

export interface Round {
  boards: Board[]
  /** the emotion the child is asked to find */
  target: EmotionId
  /** index into `boards` of the correct face */
  answerIndex: number
}

/** Emotions that actually have at least one single-person photo to show. */
export const AVAILABLE_EMOTIONS: EmotionId[] = (Object.keys(SINGLE_IMAGES) as EmotionId[]).filter(
  (id) => singleImagesFor(id).length > 0,
)

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]
}

/** Convert a bearing to floor coordinates (bearing 0 = forward, toward -z). */
export function bearingToXZ(bearingRad: number, radius: number): [number, number] {
  return [Math.sin(bearingRad) * radius, -Math.cos(bearingRad) * radius]
}

/** Floor [x, z] of a board at a given bearing. */
export function boardPosition(bearingDeg: number): [number, number] {
  return bearingToXZ((bearingDeg * Math.PI) / 180, BOARD_RADIUS)
}

/**
 * Build one round for `target`: the target's face plus tier-appropriate
 * distractor faces, one real photo each, shuffled onto the level's board
 * bearings.
 */
export function makeRound(
  target: EmotionId,
  difficulty: Difficulty,
  rng: () => number = Math.random,
): Round {
  const cfg = CONFIG[difficulty]
  const distractors = pickDistractors(target, cfg.boardCount - 1, cfg.tier, rng)
  const emotions = shuffle([target, ...distractors], rng)
  const bearings = BEARINGS[cfg.boardCount]
  const boards: Board[] = emotions.map((emotion, i) => {
    const img = pick(singleImagesFor(emotion), rng)
    return { emotion, imageSrc: img.src, gender: img.gender, bearingDeg: bearings[i] }
  })
  const answerIndex = boards.findIndex((b) => b.emotion === target)
  return { boards, target, answerIndex }
}

/**
 * The session's target emotions, dealt in stratified cycles: every available
 * emotion is asked once before any repeats, and the same emotion never lands on
 * two rounds in a row.
 */
export function buildTargets(difficulty: Difficulty, rng: () => number = Math.random): EmotionId[] {
  const goal = CONFIG[difficulty].goal
  const out: EmotionId[] = []
  let queue: EmotionId[] = []
  while (out.length < goal) {
    if (queue.length === 0) queue = shuffle(AVAILABLE_EMOTIONS, rng)
    const next = queue.shift()!
    // avoid an immediate repeat across a cycle boundary when we still have a
    // different emotion queued to use instead
    if (out.length > 0 && next === out[out.length - 1] && queue.length > 0) {
      queue.push(next)
      continue
    }
    out.push(next)
  }
  return out
}

/** The correct board's bearing — the scan the round asked for (signed degrees). */
export function answerBearingDeg(round: Round): number {
  return round.boards[round.answerIndex].bearingDeg
}

/** Guessing probability of a round (1 / boards). */
export function roundChance(round: Round): number {
  return 1 / round.boards.length
}

/** Child-facing points: a correct first tap is worth this. */
export const POINTS_PER_CORRECT = 10

export function pointsFor(correct: boolean): number {
  return correct ? POINTS_PER_CORRECT : 0
}

/**
 * Stars reward accuracy over the session: 3 ≥80% correct, 2 ≥50%, else 1 —
 * every finished session earns at least one.
 */
export function starsFor(correct: number, goal: number): number {
  const ratio = goal > 0 ? correct / goal : 0
  if (ratio >= 0.8) return 3
  if (ratio >= 0.5) return 2
  return 1
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
 * ignored right after a drag — independent of which event system delivered the
 * click, since the XR layer forwards a second copy of every screen event whose
 * drag distance is unreadable (see dragDistance). Lives here (not in the scene
 * file) so hot reload never duplicates it and the guard is unit-testable.
 */
export const lookDrag = { px: 0, endedAt: 0 }

/** whether a click arriving now is just the tail end of a look-around drag */
export function isDragTail(now: number = Date.now()): boolean {
  return lookDrag.px > 8 && now - lookDrag.endedAt < 700
}
