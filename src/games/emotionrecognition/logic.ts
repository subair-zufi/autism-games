/**
 * Pure game logic for Emotion Recognition — no React, no I/O, fully testable.
 *
 * Builds a level's worth of activities from the image content and scores a
 * completed level against the two unlock thresholds (shared with the other
 * level games in `../progression`). Everything is driven by an injectable
 * `rng` so play is randomized in production but deterministic in tests.
 *
 * Level design (per the study design, so attempts at the same level are
 * psychometrically comparable):
 *  - Fixed composition: each difficulty has a fixed quota of single/two/three
 *    person items, so item difficulty is a property of the level, not of the
 *    random draw.
 *  - Stratified emotions: every emotion available in the stimulus pool appears
 *    as the target before any emotion repeats, so per-emotion accuracy always
 *    has a denominator.
 *  - Tiered distractors: Easy pairs the target with non-confusable emotions,
 *    Hard forces a confusable one (fear↔surprise, anger↔disgust, …), making
 *    "level" a perceptual-difficulty construct rather than only a layout one.
 */
import type { Difficulty } from '../../types'
import type { Gender } from '../../i18n/strings'
import {
  pickDistractors,
  shuffle,
  type DistractorTier,
  type EmotionId,
} from '../emotionVocab'
import {
  SINGLE_IMAGES,
  groupPhotosFor,
  singleImagesFor,
  type GroupPhoto,
  type StimulusPool,
} from './content'

// Scoring is shared across level games; re-exported so existing imports and
// tests keep working.
export {
  PASS_THRESHOLD,
  MASTERY_THRESHOLD,
  scoreLevel,
  type LevelSummary,
} from '../progression'

// --- Tunable constants (never hardcode these inline) -------------------------

/** Activities shown per level. At least 10 per the spec; raise freely. */
export const ACTIVITY_COUNT = 10
/** Answer options on the Easy level. */
export const EASY_CHOICES = 2
/** Answer options on Moderate/Hard emotion questions. */
export const NAME_CHOICES = 3

/** Image categories a level draws from. */
type Category = 'single' | 'two' | 'three'

/**
 * Fixed per-level composition. Quotas must sum to ACTIVITY_COUNT so every
 * attempt at a level is the same mixture of item types.
 */
export const COMPOSITION: Record<Difficulty, Record<Category, number>> = {
  easy: { single: 10, two: 0, three: 0 },
  medium: { single: 5, two: 5, three: 0 },
  hard: { single: 2, two: 4, three: 4 },
}

/** How perceptually confusable the wrong answers are at each level. */
export const DISTRACTOR_TIER: Record<Difficulty, DistractorTier> = {
  easy: 'low',
  medium: 'mixed',
  hard: 'high',
}

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

/** Emotion answer choices: the correct one plus tier-appropriate distractors. */
function buildChoices(
  answer: EmotionId,
  count: number,
  tier: DistractorTier,
  rng: () => number,
): EmotionId[] {
  return shuffle([answer, ...pickDistractors(answer, count - 1, tier, rng)], rng)
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]
}

// --- Activity builders -------------------------------------------------------

function makeSingle(
  emotion: EmotionId,
  choiceCount: number,
  tier: DistractorTier,
  pool: StimulusPool,
  rng: () => number,
): SingleActivity {
  const images = singleImagesFor(emotion, pool)
  const img = pick(images, rng)
  return {
    kind: 'single',
    emotion,
    imageSrc: img.src,
    gender: img.gender,
    choices: buildChoices(emotion, choiceCount, tier, rng),
  }
}

function makeWhoFeels(photo: GroupPhoto, target: EmotionId): WhoFeelsActivity {
  const answerIndex = photo.emotions.indexOf(target)
  return { kind: 'whoFeels', photo, targetEmotion: target, answerIndex }
}

function makeNameFace(
  photo: GroupPhoto,
  target: EmotionId,
  tier: DistractorTier,
  rng: () => number,
): NameFaceActivity {
  const position = photo.emotions.indexOf(target)
  // Prefer the other emotions present in this same photo as distractors (harder,
  // more relevant), then pad with tier-appropriate emotions from the vocabulary.
  const samePhoto = photo.emotions.filter((id) => id !== target)
  const padding = pickDistractors(target, NAME_CHOICES - 1, tier, rng).filter(
    (id) => !samePhoto.includes(id),
  )
  const distractors = [...shuffle(samePhoto, rng), ...padding].slice(0, NAME_CHOICES - 1)
  const choices = shuffle([target, ...distractors], rng)
  return { kind: 'nameFace', photo, position, gender: photo.genders[position], choices, answer: target }
}

/** A group photo becomes one of the two question types at random. */
function makeGroupActivity(
  photo: GroupPhoto,
  target: EmotionId,
  tier: DistractorTier,
  rng: () => number,
): Activity {
  return rng() < 0.5 ? makeWhoFeels(photo, target) : makeNameFace(photo, target, tier, rng)
}

// --- Level construction ------------------------------------------------------

/** Emotions that have at least one stimulus for the given category + pool. */
function emotionsAvailable(cat: Category, pool: StimulusPool): EmotionId[] {
  if (cat === 'single') {
    return (Object.keys(SINGLE_IMAGES) as EmotionId[]).filter(
      (id) => singleImagesFor(id, pool).length > 0,
    )
  }
  const photos = groupPhotosFor(cat === 'two' ? 2 : 3, pool)
  return [...new Set(photos.flatMap((p) => p.emotions))]
}

/**
 * Build one level's activities.
 *
 * Categories come from the fixed COMPOSITION quota (shuffled). Target emotions
 * are dealt in stratified cycles: every emotion available in this level's pool
 * is used once before any repeats, so a 10-item level always covers the full
 * vocabulary (in the training pool: all 6 emotions).
 *
 * `pool` selects the stimuli: 'training' for practice, 'probe' for Assessment
 * mode (held-out images only — emotions with no probe stimulus for a category
 * are skipped there rather than silently reusing trained images).
 */
export function buildLevel(
  difficulty: Difficulty,
  rng: () => number = Math.random,
  pool: StimulusPool = 'training',
): Activity[] {
  const tier = DISTRACTOR_TIER[difficulty]
  const choiceCount = difficulty === 'easy' ? EASY_CHOICES : NAME_CHOICES
  const cats = shuffle(
    (Object.entries(COMPOSITION[difficulty]) as [Category, number][]).flatMap(
      ([cat, n]) => Array<Category>(n).fill(cat),
    ),
    rng,
  )
  // All emotions reachable in this level (union over its categories).
  const levelEmotions = [...new Set(cats.flatMap((c) => emotionsAvailable(c, pool)))]

  // Deal emotions in shuffled cycles: take the first queued emotion that has a
  // stimulus for this slot's category, refilling the queue when it runs out.
  let queue: EmotionId[] = []
  const nextEmotionFor = (cat: Category): EmotionId => {
    const avail = emotionsAvailable(cat, pool)
    if (queue.length === 0) queue = shuffle(levelEmotions, rng)
    const i = queue.findIndex((e) => avail.includes(e))
    if (i >= 0) return queue.splice(i, 1)[0]
    return pick(avail, rng)
  }

  const activities: Activity[] = []
  for (const cat of cats) {
    // In the probe pool a whole category can be empty (no held-out stimuli
    // yet) — skip the slot rather than contaminating assessment with trained
    // images. Practice pools are never empty.
    if (emotionsAvailable(cat, pool).length === 0) continue
    const emotion = nextEmotionFor(cat)
    if (cat === 'single') {
      activities.push(makeSingle(emotion, choiceCount, tier, pool, rng))
    } else {
      const photos = groupPhotosFor(cat === 'two' ? 2 : 3, pool).filter((p) =>
        p.emotions.includes(emotion),
      )
      activities.push(makeGroupActivity(pick(photos, rng), emotion, tier, rng))
    }
  }
  return activities
}

// --- Chance levels -----------------------------------------------------------

/** Guessing probability of one activity (2 choices → 0.5, 3 people → 1/3 …). */
export function activityChance(a: Activity): number {
  if (a.kind === 'whoFeels') return 1 / a.photo.emotions.length
  return 1 / a.choices.length
}

/** Mean guessing probability across a level — feed into `scoreLevel` so the
 *  recorded adjusted accuracy is comparable across levels. */
export function levelChance(activities: Activity[]): number {
  if (activities.length === 0) return 0
  return activities.reduce((sum, a) => sum + activityChance(a), 0) / activities.length
}
