import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GameId } from '../types'

interface ScoresState {
  best: Record<GameId, number>
  reportScore: (game: GameId, score: number) => void
}

export const useScores = create<ScoresState>()(
  persist(
    (set) => ({
      best: { emotions: 0, zebra: 0, garden: 0, balldrop: 0, mirror: 0 },
      reportScore: (game, score) =>
        set((s) => ({ best: { ...s.best, [game]: Math.max(s.best[game], score) } })),
    }),
    { name: 'autism-scores' },
  ),
)
