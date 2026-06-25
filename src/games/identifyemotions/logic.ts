import type { Difficulty } from '../../types'
import { EMOTIONS, shuffle, type EmotionId } from '../emotionVocab'

export interface VideoClip {
  slug: string
  src: string
  emotion: EmotionId
}

export const VIDEO_CLIPS: VideoClip[] = [
  { slug: 'angry_1', src: './videos/angry_1.mp4', emotion: 'angry' },
  { slug: 'angry_2', src: './videos/angry_2.mp4', emotion: 'angry' },
  { slug: 'disgust_1', src: './videos/disgust_1.mp4', emotion: 'disgust' },
  { slug: 'disgust_2', src: './videos/disgust_2.mp4', emotion: 'disgust' },
  { slug: 'fear_1', src: './videos/fear_1.mp4', emotion: 'scared' },
  { slug: 'fear_2', src: './videos/fear_2.mp4', emotion: 'scared' },
  { slug: 'happy_1', src: './videos/happy_1.mp4', emotion: 'happy' },
  { slug: 'happy_2', src: './videos/happy_2.mp4', emotion: 'happy' },
  { slug: 'sad_1', src: './videos/sad_1.mp4', emotion: 'sad' },
  { slug: 'sad_2', src: './videos/sad_2.mp4', emotion: 'sad' },
  { slug: 'surprise_1', src: './videos/surprise_1.mp4', emotion: 'surprised' },
  { slug: 'surprise_2', src: './videos/surprise_2.mp4', emotion: 'surprised' },
]

export interface VideoQuestion {
  clip: VideoClip
  choices: EmotionId[]
  answer: EmotionId
}

const VIDEO_COUNT: Record<Difficulty, number> = { easy: 5, medium: 7, hard: 10 }
const CHOICE_COUNT: Record<Difficulty, number> = { easy: 3, medium: 4, hard: 4 }

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
