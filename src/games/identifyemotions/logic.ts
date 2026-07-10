/**
 * Pure quiz logic for Emotion Clips — no React, no I/O, fully testable.
 *
 * Level design mirrors Emotion Recognition so the two games form one coherent
 * battery (static photos → dynamic clips):
 *  - Stratified sampling: every emotion appears before any emotion repeats
 *    (easy shows each of the 6 emotions once; hard shows all 12 clips).
 *  - Tiered distractors: easy pairs the answer with non-confusable emotions,
 *    hard forces a confusable one (fear↔surprise, anger↔disgust, …).
 *  - Freeze intensity: easy/medium freeze on the fully-formed peak expression;
 *    hard freezes earlier, on a partially-formed (lower-intensity) expression —
 *    the classic dynamic-morph manipulation of expression-intensity threshold.
 */
import type { Difficulty } from '../../types'
import type { Gender, LocalizedText } from '../../i18n/strings'
import {
  pickDistractors,
  shuffle,
  type DistractorTier,
  type EmotionId,
} from '../emotionVocab'

/**
 * An authored "why" follow-up for a clip: after the learner names the emotion,
 * they pick the cause ("emotion understanding", not just labeling). Options
 * are bilingual authored text; `answerIndex` points at the correct one.
 *
 * Author these by watching the footage, e.g. for a clip where a girl drops her
 * ice cream:
 *   cause: {
 *     options: [
 *       { en: 'She dropped her ice cream', ml: 'അവളുടെ ഐസ്ക്രീം താഴെ വീണു' },
 *       { en: 'She got a present', ml: 'അവൾക്ക് ഒരു സമ്മാനം കിട്ടി' },
 *       { en: 'She saw a dog', ml: 'അവൾ ഒരു നായയെ കണ്ടു' },
 *     ],
 *     answerIndex: 0,
 *   }
 */
export interface CauseQuestion {
  options: LocalizedText[]
  answerIndex: number
}

export interface VideoClip {
  slug: string
  src: string
  emotion: EmotionId
  /** Gender of the person in the clip — drives the "he"/"she" freeze prompt. */
  gender: Gender
  /**
   * "Peak emotion" timestamp (seconds): the video is paused here on the frame
   * showing the clearest facial expression, so the learner is asked to name the
   * emotion while it is frozen. The player clamps this to the clip's duration,
   * so an over-estimate simply pauses near the end.
   */
  peakTime: number
  /**
   * Early-freeze timestamp (seconds) used on the Hard level: the expression is
   * only partially formed here, probing the learner's intensity threshold.
   * Currently derived as peakTime − 2s (min 1.5s) — TUNE each value against the
   * footage so the freeze lands after onset but clearly before the peak.
   */
  earlyTime: number
  /** Optional authored "why" follow-up (see CauseQuestion). */
  cause?: CauseQuestion
}

export const VIDEO_CLIPS: VideoClip[] = [
  { slug: 'angry_1', src: './videos/angry_1.mp4', emotion: 'angry', gender: 'girl', peakTime: 7, earlyTime: 5 },
  { slug: 'angry_2', src: './videos/angry_2.mp4', emotion: 'angry', gender: 'boy', peakTime: 7, earlyTime: 5 },
  { slug: 'disgust_1', src: './videos/disgust_1.mp4', emotion: 'disgust', gender: 'boy', peakTime: 4, earlyTime: 2 },
  { slug: 'disgust_2', src: './videos/disgust_2.mp4', emotion: 'disgust', gender: 'boy', peakTime: 6, earlyTime: 4 },
  { slug: 'fear_1', src: './videos/fear_1.mp4', emotion: 'scared', gender: 'girl', peakTime: 7, earlyTime: 5 },
  { slug: 'fear_2', src: './videos/fear_2.mp4', emotion: 'scared', gender: 'girl', peakTime: 9, earlyTime: 7 },
  { slug: 'happy_1', src: './videos/happy_1.mp4', emotion: 'happy', gender: 'girl', peakTime: 7, earlyTime: 5 },
  { slug: 'happy_2', src: './videos/happy_2.mp4', emotion: 'happy', gender: 'girl', peakTime: 7, earlyTime: 5 },
  { slug: 'sad_1', src: './videos/sad_1.mp4', emotion: 'sad', gender: 'boy', peakTime: 7, earlyTime: 5 },
  { slug: 'sad_2', src: './videos/sad_2.mp4', emotion: 'sad', gender: 'boy', peakTime: 6, earlyTime: 4 },
  { slug: 'surprise_1', src: './videos/surprise_1.mp4', emotion: 'surprised', gender: 'girl', peakTime: 8, earlyTime: 6 },
  { slug: 'surprise_2', src: './videos/surprise_2.mp4', emotion: 'surprised', gender: 'boy', peakTime: 9, earlyTime: 7 },
]

export type FreezeKind = 'peak' | 'early'

export interface VideoQuestion {
  clip: VideoClip
  choices: EmotionId[]
  answer: EmotionId
  /** Where this question freezes the clip, and which manipulation that is. */
  freezeTime: number
  freezeKind: FreezeKind
  /** Present when the clip has an authored cause — options pre-shuffled. */
  cause?: CauseQuestion
}

/** Clips per level. Easy = each emotion once; hard = the full stimulus set. */
export const VIDEO_COUNT: Record<Difficulty, number> = { easy: 6, medium: 9, hard: 12 }
export const CHOICE_COUNT: Record<Difficulty, number> = { easy: 2, medium: 3, hard: 4 }
export const DISTRACTOR_TIER: Record<Difficulty, DistractorTier> = {
  easy: 'low',
  medium: 'mixed',
  hard: 'high',
}
/** Hard freezes on the partially-formed expression. */
export const FREEZE_KIND: Record<Difficulty, FreezeKind> = {
  easy: 'peak',
  medium: 'peak',
  hard: 'early',
}

/**
 * Stratified clip sample: deal clips emotion by emotion (shuffled cycles), so
 * every emotion appears ⌈count/6⌉ or ⌊count/6⌋ times — never a level that
 * skips an emotion entirely.
 */
function sampleClips(count: number, rng: () => number): VideoClip[] {
  const byEmotion = new Map<EmotionId, VideoClip[]>()
  for (const clip of shuffle(VIDEO_CLIPS, rng)) {
    const list = byEmotion.get(clip.emotion) ?? []
    list.push(clip)
    byEmotion.set(clip.emotion, list)
  }
  const emotions = [...byEmotion.keys()]
  const out: VideoClip[] = []
  let cycle = 0
  while (out.length < count && cycle < Math.max(...[...byEmotion.values()].map((l) => l.length))) {
    for (const id of shuffle(emotions, rng)) {
      const clip = byEmotion.get(id)?.[cycle]
      if (clip && out.length < count) out.push(clip)
    }
    cycle++
  }
  return shuffle(out, rng)
}

export function buildQuiz(
  difficulty: Difficulty,
  rng: () => number = Math.random,
): VideoQuestion[] {
  const n = CHOICE_COUNT[difficulty]
  const tier = DISTRACTOR_TIER[difficulty]
  const freezeKind = FREEZE_KIND[difficulty]
  return sampleClips(VIDEO_COUNT[difficulty], rng).map((clip) => {
    const answer = clip.emotion
    const choices = shuffle([answer, ...pickDistractors(answer, n - 1, tier, rng)], rng)
    let cause: CauseQuestion | undefined
    if (clip.cause) {
      // Shuffle the authored options, keeping track of where the answer lands.
      const order = shuffle(clip.cause.options.map((_, i) => i), rng)
      cause = {
        options: order.map((i) => clip.cause!.options[i]),
        answerIndex: order.indexOf(clip.cause.answerIndex),
      }
    }
    return {
      clip,
      choices,
      answer,
      freezeTime: freezeKind === 'early' ? clip.earlyTime : clip.peakTime,
      freezeKind,
      cause,
    }
  })
}
