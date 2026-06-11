import type { Difficulty } from '../../types'

export type ObjectId =
  | 'flower-red'
  | 'flower-yellow'
  | 'flower-purple'
  | 'butterfly'
  | 'tree'
  | 'bird'
  | 'mushroom'
  | 'bee'

export interface ObjectMeta {
  id: ObjectId
  label: string
  emoji: string
  category: string
  /** [x, z] spot in the garden; y is decided by each model */
  position: [number, number]
}

export const GARDEN_OBJECTS: ObjectMeta[] = [
  { id: 'flower-red', label: 'Red Flower', emoji: '🌹', category: 'flower', position: [-1.7, 0.6] },
  { id: 'flower-yellow', label: 'Yellow Flower', emoji: '🌻', category: 'flower', position: [0, 0.9] },
  { id: 'flower-purple', label: 'Purple Flower', emoji: '🪻', category: 'flower', position: [1.7, 0.6] },
  { id: 'butterfly', label: 'Butterfly', emoji: '🦋', category: 'butterfly', position: [1, -1.3] },
  { id: 'tree', label: 'Tree', emoji: '🌳', category: 'tree', position: [-2.7, -1.6] },
  { id: 'bird', label: 'Bird', emoji: '🐦', category: 'bird', position: [-0.9, -1] },
  { id: 'mushroom', label: 'Mushroom', emoji: '🍄', category: 'mushroom', position: [2.6, -0.5] },
  { id: 'bee', label: 'Bee', emoji: '🐝', category: 'bee', position: [-2.3, 0.3] },
]

export function objectMeta(id: ObjectId): ObjectMeta {
  return GARDEN_OBJECTS.find((o) => o.id === id)!
}

const CHOICE_COUNT: Record<Difficulty, number> = { easy: 3, medium: 4, hard: 4 }

export interface Round {
  target: ObjectId
  choices: ObjectId[]
}

export function makeRound(
  difficulty: Difficulty,
  prevTarget: ObjectId | null,
  rng: () => number = Math.random,
): Round {
  const targets = GARDEN_OBJECTS.filter((o) => o.id !== prevTarget)
  const target = targets[Math.floor(rng() * targets.length)]

  let pool = GARDEN_OBJECTS.filter((o) => o.id !== target.id)
  let distractors: ObjectMeta[]
  if (difficulty === 'easy') {
    // keep categories distinct so nothing looks confusable
    distractors = []
    for (const o of shuffle(pool, rng)) {
      if (distractors.length >= CHOICE_COUNT.easy - 1) break
      const cats = [target.category, ...distractors.map((d) => d.category)]
      if (!cats.includes(o.category)) distractors.push(o)
    }
  } else if (difficulty === 'hard' && target.category === 'flower') {
    // flowers first: color discrimination is the challenge
    const flowers = shuffle(pool.filter((o) => o.category === 'flower'), rng)
    const rest = shuffle(pool.filter((o) => o.category !== 'flower'), rng)
    distractors = [...flowers, ...rest].slice(0, CHOICE_COUNT.hard - 1)
  } else {
    distractors = shuffle(pool, rng).slice(0, CHOICE_COUNT[difficulty] - 1)
  }

  return {
    target: target.id,
    choices: shuffle([target, ...distractors], rng).map((o) => o.id),
  }
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
