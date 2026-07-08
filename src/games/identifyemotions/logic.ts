import type { Difficulty } from '../../types'
import type { Gender } from '../../i18n/strings'
import { EMOTIONS, shuffle, type EmotionId } from '../emotionVocab'

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
   *
   * NOTE: genders and peak times below are set per clip from the footage; tune
   * these values if a pause lands before the expression is fully formed.
   */
  peakTime: number
}

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
  { slug: 'sad_2', src: './videos/sad_2.mp4', emotion: 'sad', gender: 'girl', peakTime: 6 },
  { slug: 'surprise_1', src: './videos/surprise_1.mp4', emotion: 'surprised', gender: 'boy', peakTime: 8 },
  { slug: 'surprise_2', src: './videos/surprise_2.mp4', emotion: 'surprised', gender: 'girl', peakTime: 9 },
]

export interface VideoQuestion {
  clip: VideoClip
  choices: EmotionId[]
  answer: EmotionId
}

const VIDEO_COUNT: Record<Difficulty, number> = { easy: 5, medium: 7, hard: 10 }
const CHOICE_COUNT: Record<Difficulty, number> = { easy: 2, medium: 3, hard: 4 }

export function buildQuiz(
  difficulty: Difficulty,
  rng: () => number = Math.random,
): VideoQuestion[] {
  const clips = shuffle([...VIDEO_CLIPS], rng).slice(0, VIDEO_COUNT[difficulty])
  const n = CHOICE_COUNT[difficulty]
  return clips.map((clip) => {
    const answer = clip.emotion
    const distractors = shuffle(
      EMOTIONS.map((e) => e.id).filter((id) => id !== answer),
      rng,
    ).slice(0, n - 1)
    const choices = shuffle([answer, ...distractors], rng)
    return { clip, choices, answer }
  })
}
