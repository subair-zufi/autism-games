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
 *
 * Easy/Medium and Hard draw from SEPARATE footage sets (`VIDEO_CLIPS` vs
 * `HARD_CLIPS`). Hard is not the same clips paused earlier — that only cropped
 * the ending and let a learner reuse a remembered answer. Instead Hard uses its
 * own clips filmed as a slow build, so `earlyTime` lands on a genuinely
 * partially-formed expression rather than an arbitrary "peak − 2s" frame.
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
   * Required on `HARD_CLIPS` (tuned against each clip's actual slow build);
   * omitted on the Easy/Medium `VIDEO_CLIPS`, which only ever freeze at peak.
   */
  earlyTime?: number
  /** Optional authored "why" follow-up (see CauseQuestion). */
  cause?: CauseQuestion
}

/**
 * Easy/Medium pool — frozen on the fully-formed peak expression only.
 */
export const VIDEO_CLIPS: VideoClip[] = [
  { slug: 'angry_1', src: './videos/angry_1.mp4', emotion: 'angry', gender: 'girl', peakTime: 7 },
  { slug: 'angry_2', src: './videos/angry_2.mp4', emotion: 'angry', gender: 'boy', peakTime: 7 },
  { slug: 'disgust_1', src: './videos/disgust_1.mp4', emotion: 'disgust', gender: 'boy', peakTime: 4 },
  { slug: 'disgust_2', src: './videos/disgust_2.mp4', emotion: 'disgust', gender: 'boy', peakTime: 6 },
  { slug: 'fear_1', src: './videos/fear_1.mp4', emotion: 'scared', gender: 'girl', peakTime: 7 },
  { slug: 'fear_2', src: './videos/fear_2.mp4', emotion: 'scared', gender: 'girl', peakTime: 9 },
  { slug: 'happy_1', src: './videos/happy_1.mp4', emotion: 'happy', gender: 'girl', peakTime: 7 },
  { slug: 'happy_2', src: './videos/happy_2.mp4', emotion: 'happy', gender: 'girl', peakTime: 7 },
  { slug: 'sad_1', src: './videos/sad_1.mp4', emotion: 'sad', gender: 'boy', peakTime: 7 },
  { slug: 'sad_2', src: './videos/sad_2.mp4', emotion: 'sad', gender: 'boy', peakTime: 6 },
  { slug: 'surprise_1', src: './videos/surprise_1.mp4', emotion: 'surprised', gender: 'girl', peakTime: 8 },
  { slug: 'surprise_2', src: './videos/surprise_2.mp4', emotion: 'surprised', gender: 'boy', peakTime: 9 },
]

/**
 * Hard pool — dedicated slow-build footage. `earlyTime` is the partially-formed
 * frame (~40–50% intensity) read off each clip; `peakTime` is the fully-formed
 * expression it resolves to (used for the resume-after-correct playback). Each
 * clip carries an authored `cause` for the "why does he/she feel …?" follow-up.
 */
export const HARD_CLIPS: VideoClip[] = [
  {
    slug: 'happy_hard_1', src: './videos/happy_hard_1.mp4', emotion: 'happy', gender: 'girl',
    earlyTime: 3.5, peakTime: 6,
    cause: {
      options: [
        { en: 'She got a puppy toy as a gift', ml: 'അവൾക്ക് സമ്മാനമായി ഒരു നായക്കുട്ടി കളിപ്പാട്ടം കിട്ടി' },
        { en: 'She lost her toy', ml: 'അവളുടെ കളിപ്പാട്ടം നഷ്ടപ്പെട്ടു' },
        { en: 'She fell down', ml: 'അവൾ വീണു' },
      ],
      answerIndex: 0,
    },
  },
  {
    slug: 'happy_hard_2', src: './videos/happy_hard_2.mp4', emotion: 'happy', gender: 'boy',
    earlyTime: 2, peakTime: 4.5,
    cause: {
      options: [
        { en: 'His paper airplane landed perfectly', ml: 'അവന്റെ പേപ്പർ വിമാനം കൃത്യമായി വീണു' },
        { en: 'He dropped his food', ml: 'അവന്റെ ഭക്ഷണം താഴെ വീണു' },
        { en: 'He broke his toy', ml: 'അവന്റെ കളിപ്പാട്ടം പൊട്ടി' },
      ],
      answerIndex: 0,
    },
  },
  {
    slug: 'sad_hard_1', src: './videos/sad_hard_1.mp4', emotion: 'sad', gender: 'boy',
    earlyTime: 3, peakTime: 5.5,
    cause: {
      options: [
        { en: 'His balloon floated away', ml: 'അവന്റെ ബലൂൺ പറന്നു പോയി' },
        { en: 'He got a new toy', ml: 'അവന് പുതിയ കളിപ്പാട്ടം കിട്ടി' },
        { en: 'He ate ice cream', ml: 'അവൻ ഐസ്ക്രീം കഴിച്ചു' },
      ],
      answerIndex: 0,
    },
  },
  {
    slug: 'sad_hard_2', src: './videos/sad_hard_2.mp4', emotion: 'sad', gender: 'girl',
    earlyTime: 3.5, peakTime: 5.5,
    cause: {
      options: [
        { en: 'Her friend went away', ml: 'അവളുടെ കൂട്ടുകാരി പോയി' },
        { en: 'She won a game', ml: 'അവൾ കളിയിൽ ജയിച്ചു' },
        { en: 'She got a gift', ml: 'അവൾക്ക് സമ്മാനം കിട്ടി' },
      ],
      answerIndex: 0,
    },
  },
  {
    slug: 'angry_hard_1', src: './videos/angry_hard_1.mp4', emotion: 'angry', gender: 'girl',
    earlyTime: 2, peakTime: 4.5,
    cause: {
      options: [
        { en: 'Someone knocked down her blocks', ml: 'ആരോ അവളുടെ ബ്ലോക്കുകൾ തട്ടിയിട്ടു' },
        { en: 'She got a present', ml: 'അവൾക്ക് സമ്മാനം കിട്ടി' },
        { en: 'She saw a butterfly', ml: 'അവൾ ഒരു ചിത്രശലഭത്തെ കണ്ടു' },
      ],
      answerIndex: 0,
    },
  },
  {
    slug: 'angry_hard_2', src: './videos/angry_hard_2.mp4', emotion: 'angry', gender: 'boy',
    earlyTime: 3, peakTime: 5,
    cause: {
      options: [
        { en: 'Someone grabbed his game', ml: 'ആരോ അവന്റെ ഗെയിം തട്ടിയെടുത്തു' },
        { en: 'He won a prize', ml: 'അവന് സമ്മാനം കിട്ടി' },
        { en: 'He ate a snack', ml: 'അവൻ പലഹാരം കഴിച്ചു' },
      ],
      answerIndex: 0,
    },
  },
  {
    slug: 'disgust_hard_1', src: './videos/disgust_hard_1.mp4', emotion: 'disgust', gender: 'boy',
    earlyTime: 4, peakTime: 5.5,
    cause: {
      options: [
        { en: 'The food tasted bad', ml: 'ഭക്ഷണത്തിന് മോശം രുചിയായിരുന്നു' },
        { en: 'The food was yummy', ml: 'ഭക്ഷണം രുചികരമായിരുന്നു' },
        { en: 'He got a toy', ml: 'അവന് ഒരു കളിപ്പാട്ടം കിട്ടി' },
      ],
      answerIndex: 0,
    },
  },
  {
    slug: 'disgust_hard_2', src: './videos/disgust_hard_2.mp4', emotion: 'disgust', gender: 'girl',
    earlyTime: 3.5, peakTime: 5.5,
    cause: {
      options: [
        { en: 'She found something dirty', ml: 'അവൾ വൃത്തികെട്ട ഒന്ന് കണ്ടെത്തി' },
        { en: 'She found a flower', ml: 'അവൾ ഒരു പൂവ് കണ്ടെത്തി' },
        { en: 'She found money', ml: 'അവൾക്ക് പണം കിട്ടി' },
      ],
      answerIndex: 0,
    },
  },
  {
    slug: 'fear_hard_1', src: './videos/fear_hard_1.mp4', emotion: 'scared', gender: 'girl',
    earlyTime: 1.5, peakTime: 3.5,
    cause: {
      options: [
        { en: 'She heard loud thunder', ml: 'അവൾ ഉച്ചത്തിലുള്ള ഇടിമുഴക്കം കേട്ടു' },
        { en: 'She heard music', ml: 'അവൾ സംഗീതം കേട്ടു' },
        { en: 'She heard a bird', ml: 'അവൾ ഒരു പക്ഷിയെ കേട്ടു' },
      ],
      answerIndex: 0,
    },
  },
  {
    slug: 'fear_hard_2', src: './videos/fear_hard_2.mp4', emotion: 'scared', gender: 'boy',
    earlyTime: 2, peakTime: 4,
    cause: {
      options: [
        { en: 'A big dog barked at him', ml: 'ഒരു വലിയ നായ അവനെ നോക്കി കുരച്ചു' },
        { en: 'A friend waved at him', ml: 'ഒരു കൂട്ടുകാരൻ അവന് കൈ വീശി' },
        { en: 'He found a toy', ml: 'അവൻ ഒരു കളിപ്പാട്ടം കണ്ടെത്തി' },
      ],
      answerIndex: 0,
    },
  },
  {
    slug: 'surprise_hard_1', src: './videos/surprise_hard_1.mp4', emotion: 'surprised', gender: 'girl',
    earlyTime: 2, peakTime: 4,
    cause: {
      options: [
        { en: 'A toy popped up suddenly', ml: 'ഒരു കളിപ്പാട്ടം പെട്ടെന്ന് ചാടി വന്നു' },
        { en: 'She fell asleep', ml: 'അവൾ ഉറങ്ങിപ്പോയി' },
        { en: 'She was reading a book', ml: 'അവൾ ഒരു പുസ്തകം വായിക്കുകയായിരുന്നു' },
      ],
      answerIndex: 0,
    },
  },
  {
    slug: 'surprise_hard_2', src: './videos/surprise_hard_2.mp4', emotion: 'surprised', gender: 'boy',
    earlyTime: 3, peakTime: 4.5,
    cause: {
      options: [
        { en: 'A butterfly landed on his hand', ml: 'ഒരു ചിത്രശലഭം അവന്റെ കൈയിൽ വന്നിരുന്നു' },
        { en: 'He was eating lunch', ml: 'അവൻ ഉച്ചഭക്ഷണം കഴിക്കുകയായിരുന്നു' },
        { en: 'He was sleeping', ml: 'അവൻ ഉറങ്ങുകയായിരുന്നു' },
      ],
      answerIndex: 0,
    },
  },
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

/** Hard has its own footage; Easy/Medium share the peak-only pool. */
function poolFor(difficulty: Difficulty): VideoClip[] {
  return difficulty === 'hard' ? HARD_CLIPS : VIDEO_CLIPS
}

/**
 * Stratified clip sample: deal clips emotion by emotion (shuffled cycles), so
 * every emotion appears ⌈count/6⌉ or ⌊count/6⌋ times — never a level that
 * skips an emotion entirely.
 */
function sampleClips(pool: VideoClip[], count: number, rng: () => number): VideoClip[] {
  const byEmotion = new Map<EmotionId, VideoClip[]>()
  for (const clip of shuffle(pool, rng)) {
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

/**
 * The correct choice's slot index for each clip, dealt in shuffled cycles over
 * the level's choice count so a session sweeps every position evenly instead
 * of favouring one side (review M4: Emotion Cinema 360 places choices at
 * bearings by slot index, so an uncounterbalanced shuffle biased the bearing
 * metric the same way Emotion Recognition 360's board pick did).
 */
function answerSlots(n: number, count: number, rng: () => number): number[] {
  const out: number[] = []
  while (out.length < count) {
    const cycle = shuffle(
      Array.from({ length: n }, (_, i) => i),
      rng,
    )
    if (out.length > 0 && cycle[0] === out[out.length - 1] && cycle.length > 1) {
      ;[cycle[0], cycle[1]] = [cycle[1], cycle[0]]
    }
    out.push(...cycle)
  }
  return out.slice(0, count)
}

export function buildQuiz(
  difficulty: Difficulty,
  rng: () => number = Math.random,
): VideoQuestion[] {
  const n = CHOICE_COUNT[difficulty]
  const tier = DISTRACTOR_TIER[difficulty]
  const freezeKind = FREEZE_KIND[difficulty]
  const clips = sampleClips(poolFor(difficulty), VIDEO_COUNT[difficulty], rng)
  const slots = answerSlots(n, clips.length, rng)
  return clips.map((clip, idx) => {
    const answer = clip.emotion
    const distractors = shuffle(pickDistractors(answer, n - 1, tier, rng), rng)
    const choices: EmotionId[] = []
    let di = 0
    for (let i = 0; i < n; i++) choices.push(i === slots[idx] ? answer : distractors[di++])
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
      freezeTime: freezeKind === 'early' ? (clip.earlyTime ?? clip.peakTime) : clip.peakTime,
      freezeKind,
      cause,
    }
  })
}
