import type { Difficulty } from '../../types'

export type PeerMood = 'sad' | 'cry' | 'hurt' | 'neutral'

export interface Option {
  id: string
  label: string
  emoji: string
  isGood: boolean
  /** spoken consequence after the child picks this */
  result: string
}

export interface Situation {
  id: string
  /** what the narrator describes about the frozen moment */
  text: string
  /** emoji cue shown in the bubble */
  bubble: string
  scene: { mood: PeerMood; books?: boolean; tall?: boolean }
  options: Option[]
}

export const SITUATIONS: Situation[] = [
  {
    id: 'books',
    text: 'Aisha dropped all her books on the floor.',
    bubble: '📚',
    scene: { mood: 'sad', books: true },
    options: [
      { id: 'help', label: 'Help pick them up', emoji: '🤝', isGood: true, result: 'You helped! Aisha feels happy and says thank you.' },
      { id: 'walk', label: 'Walk past', emoji: '🚶', isGood: false, result: 'Aisha is left struggling alone. Helping would be kinder.' },
      { id: 'laugh', label: 'Laugh at her', emoji: '😂', isGood: false, result: 'That hurts Aisha\'s feelings. Helping is the kind choice.' },
    ],
  },
  {
    id: 'crying',
    text: 'A new boy is crying all by himself at break.',
    bubble: '😢',
    scene: { mood: 'cry' },
    options: [
      { id: 'ask', label: 'Ask if he is okay', emoji: '💬', isGood: true, result: 'He feels cared for and stops crying. Well done.' },
      { id: 'ignore', label: 'Ignore him', emoji: '🙈', isGood: false, result: 'He stays sad and alone. Checking in would help.' },
      { id: 'stare', label: 'Point and stare', emoji: '👉', isGood: false, result: 'That makes him feel worse. A kind word helps more.' },
    ],
  },
  {
    id: 'teacher',
    text: 'Your teacher walks in to start the class.',
    bubble: '🧑‍🏫',
    scene: { mood: 'neutral', tall: true },
    options: [
      { id: 'greet', label: 'Say good morning', emoji: '🙂', isGood: true, result: 'A friendly greeting! Your teacher smiles back.' },
      { id: 'shout', label: 'Keep talking loudly', emoji: '📢', isGood: false, result: 'It is hard to start class. Greeting calmly is better.' },
      { id: 'turn', label: 'Turn away', emoji: '🙅', isGood: false, result: 'That seems unfriendly. A hello is the kind choice.' },
    ],
  },
  {
    id: 'fell',
    text: 'A friend trips and falls in the playground.',
    bubble: '🤕',
    scene: { mood: 'hurt' },
    options: [
      { id: 'helpup', label: 'Help them up', emoji: '🤝', isGood: true, result: 'You helped them up. They feel safe and thankful.' },
      { id: 'run', label: 'Run away', emoji: '🏃', isGood: false, result: 'They are left hurt. Stopping to help is kinder.' },
      { id: 'laugh2', label: 'Laugh at them', emoji: '😂', isGood: false, result: 'That is unkind when they are hurt. Help them instead.' },
    ],
  },
  {
    id: 'lonely',
    text: 'A child stands alone, watching your game.',
    bubble: '🧍',
    scene: { mood: 'sad' },
    options: [
      { id: 'invite', label: 'Invite them to play', emoji: '👋', isGood: true, result: 'They join in and have fun. That was very kind.' },
      { id: 'ignore2', label: 'Ignore them', emoji: '🙈', isGood: false, result: 'They keep feeling left out. Inviting them is kind.' },
      { id: 'shoo', label: 'Tell them to go away', emoji: '🙅', isGood: false, result: 'That hurts their feelings. Including them is better.' },
    ],
  },
  {
    id: 'swing',
    text: 'Your friend has waited a long time for the swing.',
    bubble: '⏳',
    scene: { mood: 'sad' },
    options: [
      { id: 'turnit', label: 'Give them a turn', emoji: '🤝', isGood: true, result: 'You took turns! Your friend is happy and grateful.' },
      { id: 'keep', label: 'Keep swinging', emoji: '🙃', isGood: false, result: 'Your friend keeps waiting. Taking turns is fair.' },
      { id: 'push', label: 'Push them away', emoji: '😠', isGood: false, result: 'That is not safe or kind. Take turns instead.' },
    ],
  },
]

const ROUNDS: Record<Difficulty, number> = { easy: 4, medium: 5, hard: 6 }
export function rounds(difficulty: Difficulty): number {
  return ROUNDS[difficulty]
}

export interface Round {
  situation: Situation
  /** options in the order they should be shown (shuffled) */
  choices: Option[]
}

export function makeRound(
  prevId: string | null,
  rng: () => number = Math.random,
): Round {
  const pool = SITUATIONS.filter((s) => s.id !== prevId)
  const situation = pool[Math.floor(rng() * pool.length)]
  return { situation, choices: shuffle(situation.options, rng) }
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
