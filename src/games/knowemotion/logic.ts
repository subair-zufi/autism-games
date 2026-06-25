import type { Difficulty } from '../../types'
import { EMOTIONS, shuffle, type EmotionId } from '../emotionVocab'

export interface GroupPhoto {
  slug: string
  src: string
  emotions: EmotionId[] // ordered left → right
}

export const GROUP_PHOTOS: GroupPhoto[] = [
  // two-person
  { slug: 'disgust_fear', src: './groups/disgust_fear.png', emotions: ['disgust', 'scared'] },
  { slug: 'fear_angry', src: './groups/fear_angry.png', emotions: ['scared', 'angry'] },
  { slug: 'happy_sad', src: './groups/happy_sad.png', emotions: ['happy', 'sad'] },
  { slug: 'happy_surprise', src: './groups/happy_surprise.png', emotions: ['happy', 'surprised'] },
  { slug: 'sad_angry', src: './groups/sad_angry.png', emotions: ['sad', 'angry'] },
  { slug: 'surprise_disgust', src: './groups/surprise_disgust.png', emotions: ['surprised', 'disgust'] },
  // three-person
  { slug: 'disgust_surprise_angry', src: './groups/disgust_surprise_angry.png', emotions: ['disgust', 'surprised', 'angry'] },
  { slug: 'disgust_surprise_angry_2', src: './groups/disgust_surprise_angry_2.png', emotions: ['disgust', 'surprised', 'angry'] },
  { slug: 'disgust_surprise_fear', src: './groups/disgust_surprise_fear.png', emotions: ['disgust', 'surprised', 'scared'] },
  { slug: 'fear_surprise_happy', src: './groups/fear_surprise_happy.png', emotions: ['scared', 'surprised', 'happy'] },
  { slug: 'sad_happy_angry', src: './groups/sad_happy_angry.png', emotions: ['sad', 'happy', 'angry'] },
  { slug: 'sad_happy_angry_2', src: './groups/sad_happy_angry_2.png', emotions: ['sad', 'happy', 'angry'] },
  { slug: 'sad_happy_angry_3', src: './groups/sad_happy_angry_3.png', emotions: ['sad', 'happy', 'angry'] },
  { slug: 'surprise_disgust_sad', src: './groups/surprise_disgust_sad.png', emotions: ['surprised', 'disgust', 'sad'] },
]

export interface FindQuestion {
  type: 'find'
  photo: GroupPhoto
  targetEmotion: EmotionId
  answerIndex: number
}

export interface NameQuestion {
  type: 'name'
  photo: GroupPhoto
  position: number
  choices: EmotionId[]
  answer: EmotionId
}

export type Question = FindQuestion | NameQuestion

const QUESTION_COUNT: Record<Difficulty, number> = { easy: 6, medium: 6, hard: 10 }
const NAME_CHOICES = 4

const twoPerson = () => GROUP_PHOTOS.filter((p) => p.emotions.length === 2)
const threePerson = () => GROUP_PHOTOS.filter((p) => p.emotions.length === 3)

function makeFind(photo: GroupPhoto, rng: () => number): FindQuestion {
  const targetEmotion = photo.emotions[Math.floor(rng() * photo.emotions.length)]
  return { type: 'find', photo, targetEmotion, answerIndex: photo.emotions.indexOf(targetEmotion) }
}

function makeName(photo: GroupPhoto, rng: () => number): NameQuestion {
  const position = Math.floor(rng() * photo.emotions.length)
  const answer = photo.emotions[position]
  // Prefer the other emotions present in this same photo as distractors,
  // then pad with the rest of the vocabulary, up to NAME_CHOICES total.
  const samePhoto = photo.emotions.filter((id) => id !== answer)
  const others = shuffle(
    EMOTIONS.map((e) => e.id).filter((id) => id !== answer && !samePhoto.includes(id)),
    rng,
  )
  const distractors = [...samePhoto, ...others].slice(0, NAME_CHOICES - 1)
  const choices = shuffle([answer, ...distractors], rng)
  return { type: 'name', photo, position, choices, answer }
}

export function buildQuiz(difficulty: Difficulty, rng: () => number = Math.random): Question[] {
  const count = QUESTION_COUNT[difficulty]
  const pool =
    difficulty === 'easy' ? twoPerson()
    : difficulty === 'medium' ? threePerson()
    : [...GROUP_PHOTOS]
  const photos = shuffle(pool, rng).slice(0, count)
  return photos.map((photo) => {
    const useName = difficulty === 'hard' && rng() < 0.4
    return useName ? makeName(photo, rng) : makeFind(photo, rng)
  })
}
