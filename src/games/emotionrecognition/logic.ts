/**
 * Pure game logic for Emotion Recognition — no React, no I/O, fully testable.
 *
 * Builds a level's worth of activities from the image content, following the
 * spec's per-level rules, and scores a completed level against the two unlock
 * thresholds. Everything is driven by an injectable `rng` so play is randomized
 * in production but deterministic in tests.
 */
import type { Difficulty } from '../../types'
import type { Gender } from '../../i18n/strings'
import { EMOTIONS, shuffle, type EmotionId } from '../emotionVocab'
import {
  SINGLE_IMAGES,
  SINGLE_EMOTIONS,
  twoPersonPhotos,
  threePersonPhotos,
  type GroupPhoto,
} from './content'

// --- Tunable constants (never hardcode these inline) -------------------------

/** Activities shown per level. At least 10 per the spec; raise freely. */
export const ACTIVITY_COUNT = 10
/** Answer options on the Easy level. */
export const EASY_CHOICES = 2
/** Answer options on Moderate/Hard emotion questions. */
export const NAME_CHOICES = 3
/** Accuracy needed to unlock the next level. */
export const PASS_THRESHOLD = 0.7
/** Accuracy that marks a level "mastered" (fully complete). */
export const MASTERY_THRESHOLD = 0.8

// --- Activity model ----------------------------------------------------------

/** Easy + single-person: one face, pick the emotion. */
export interface SingleActivity {
  kind: 'single'
  emotion: EmotionId // the correct answer
  imageSrc: string
  gender: Gender // drives the he/she prompt
  choices: EmotionId[]
}

/** "Who feels ___?" — a group photo, tap the matching person. */
export interface WhoFeelsActivity {
  kind: 'whoFeels'
  photo: GroupPhoto
  targetEmotion: EmotionId
  answerIndex: number
}

/** "How does he/she feel?" — one face in a group photo is highlighted. */
export interface NameFaceActivity {
  kind: 'nameFace'
  photo: GroupPhoto
  position: number
  gender: Gender // gender of the highlighted face
  choices: EmotionId[]
  answer: EmotionId
}

export type Activity = SingleActivity | WhoFeelsActivity | NameFaceActivity

const ALL_EMOTION_IDS = EMOTIONS.map((e) => e.id)

/** Emotion answer choices: the correct one plus random distractors, shuffled. */
function buildChoices(answer: EmotionId, count: number, rng: () => number): EmotionId[] {
  const distractors = shuffle(
    ALL_EMOTION_IDS.filter((id) => id !== answer),
    rng,
  ).slice(0, Math.max(0, count - 1))
  return shuffle([answer, ...distractors], rng)
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]
}

// --- Activity builders -------------------------------------------------------

function makeSingle(choiceCount: number, rng: () => number): SingleActivity {
  const emotion = pick(SINGLE_EMOTIONS, rng)
  const img = pick(SINGLE_IMAGES[emotion], rng)
  return {
    kind: 'single',
    emotion,
    imageSrc: img.src,
    gender: img.gender,
    choices: buildChoices(emotion, choiceCount, rng),
  }
}

function makeWhoFeels(photo: GroupPhoto, rng: () => number): WhoFeelsActivity {
  const answerIndex = Math.floor(rng() * photo.emotions.length)
  return { kind: 'whoFeels', photo, targetEmotion: photo.emotions[answerIndex], answerIndex }
}

function makeNameFace(photo: GroupPhoto, rng: () => number): NameFaceActivity {
  const position = Math.floor(rng() * photo.emotions.length)
  const answer = photo.emotions[position]
  // Prefer the other emotions present in this same photo as distractors (harder,
  // more relevant), then pad from the rest of the vocabulary.
  const samePhoto = photo.emotions.filter((id) => id !== answer)
  const others = shuffle(
    ALL_EMOTION_IDS.filter((id) => id !== answer && !samePhoto.includes(id)),
    rng,
  )
  const distractors = [...samePhoto, ...others].slice(0, NAME_CHOICES - 1)
  const choices = shuffle([answer, ...distractors], rng)
  return { kind: 'nameFace', photo, position, gender: photo.genders[position], choices, answer }
}

/** A group photo becomes one of the two question types at random. */
function makeGroupActivity(photo: GroupPhoto, rng: () => number): Activity {
  return rng() < 0.5 ? makeWhoFeels(photo, rng) : makeNameFace(photo, rng)
}

/** Image categories a level may draw from. */
type Category = 'single' | 'two' | 'three'

function categoriesFor(difficulty: Difficulty): Category[] {
  if (difficulty === 'easy') return ['single']
  if (difficulty === 'medium') return ['single', 'two']
  return ['single', 'two', 'three']
}

/**
 * Build one level's activities.
 *
 *  - Easy: only single-person faces, 2 choices, "What does he/she feel now?".
 *  - Moderate: single + two-person, single faces ask the emotion; group photos
 *    randomly ask "Who feels ___?" or highlight one face.
 *  - Hard: same two question types across single, two- and three-person photos.
 *
 * Image order, question order and option positions are all randomized via `rng`.
 */
export function buildLevel(difficulty: Difficulty, rng: () => number = Math.random): Activity[] {
  const cats = categoriesFor(difficulty)
  const choiceCount = difficulty === 'easy' ? EASY_CHOICES : NAME_CHOICES
  const activities: Activity[] = []
  for (let i = 0; i < ACTIVITY_COUNT; i++) {
    const cat = cats[Math.floor(rng() * cats.length)]
    if (cat === 'single') {
      activities.push(makeSingle(choiceCount, rng))
    } else {
      const photo = pick(cat === 'two' ? twoPersonPhotos() : threePersonPhotos(), rng)
      activities.push(makeGroupActivity(photo, rng))
    }
  }
  return activities
}

// --- Scoring -----------------------------------------------------------------

export interface LevelSummary {
  correct: number
  incorrect: number
  total: number
  accuracy: number // 0..1
  passed: boolean // ≥ PASS_THRESHOLD → next level unlocks
  mastered: boolean // ≥ MASTERY_THRESHOLD → level fully complete
}

/** Score a finished level against the pass (70%) and mastery (80%) thresholds. */
export function scoreLevel(correct: number, total: number): LevelSummary {
  const accuracy = total > 0 ? correct / total : 0
  return {
    correct,
    incorrect: total - correct,
    total,
    accuracy,
    passed: accuracy >= PASS_THRESHOLD,
    mastered: accuracy >= MASTERY_THRESHOLD,
  }
}
