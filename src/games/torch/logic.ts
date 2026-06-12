import type { Difficulty } from '../../types'

export interface TorchConfig {
  /** completed question-and-answer exchanges in a session */
  exchanges: number
  /** how long the robot holds the torch while asking, in ms — longer = harder to wait */
  robotMs: number
}

export const CONFIG: Record<Difficulty, TorchConfig> = {
  easy: { exchanges: 4, robotMs: 2600 },
  medium: { exchanges: 5, robotMs: 3600 },
  hard: { exchanges: 6, robotMs: 4800 },
}

export interface Answer {
  id: string
  label: string
  emoji: string
}

export interface Question {
  id: string
  /** what the robot asks while holding the torch */
  ask: string
  /** there is no wrong answer — the skill being practised is waiting for the turn */
  answers: Answer[]
  /** robot's friendly reply after the child answers (answer label is appended) */
  reply: string
}

export const QUESTIONS: Question[] = [
  {
    id: 'animal',
    ask: 'What is your favourite animal?',
    answers: [
      { id: 'dog', label: 'Dog', emoji: '🐶' },
      { id: 'cat', label: 'Cat', emoji: '🐱' },
      { id: 'lion', label: 'Lion', emoji: '🦁' },
    ],
    reply: 'I like that one too!',
  },
  {
    id: 'food',
    ask: 'What do you like to eat?',
    answers: [
      { id: 'pizza', label: 'Pizza', emoji: '🍕' },
      { id: 'apple', label: 'Apple', emoji: '🍎' },
      { id: 'rice', label: 'Rice', emoji: '🍚' },
    ],
    reply: 'Yum, that sounds tasty!',
  },
  {
    id: 'colour',
    ask: 'What is your favourite colour?',
    answers: [
      { id: 'blue', label: 'Blue', emoji: '🔵' },
      { id: 'red', label: 'Red', emoji: '🔴' },
      { id: 'green', label: 'Green', emoji: '🟢' },
    ],
    reply: 'What a lovely colour!',
  },
  {
    id: 'play',
    ask: 'What do you like to play?',
    answers: [
      { id: 'ball', label: 'Ball games', emoji: '⚽' },
      { id: 'blocks', label: 'Building', emoji: '🧱' },
      { id: 'draw', label: 'Drawing', emoji: '🎨' },
    ],
    reply: 'That sounds like fun!',
  },
  {
    id: 'place',
    ask: 'Where do you like to go?',
    answers: [
      { id: 'park', label: 'The park', emoji: '🌳' },
      { id: 'beach', label: 'The beach', emoji: '🏖️' },
      { id: 'home', label: 'Home', emoji: '🏠' },
    ],
    reply: 'I would love to go there!',
  },
  {
    id: 'weather',
    ask: 'What weather do you like?',
    answers: [
      { id: 'sun', label: 'Sunny', emoji: '☀️' },
      { id: 'rain', label: 'Rainy', emoji: '🌧️' },
      { id: 'snow', label: 'Snowy', emoji: '❄️' },
    ],
    reply: 'Great choice of weather!',
  },
]

/** Pick the next question, never repeating the previous one. */
export function nextQuestion(
  prevId: string | null,
  rng: () => number = Math.random,
): Question {
  const pool = QUESTIONS.filter((q) => q.id !== prevId)
  return pool[Math.floor(rng() * pool.length)]
}
