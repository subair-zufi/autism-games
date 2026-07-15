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
      best: { emotionrecognition: 0, blocks: 0, playroom360: 0, rollback: 0, football360: 0, museum: 0, museum360: 0, rightway: 0, rulefixer: 0, identifyemotions: 0, discovery: 0, park360: 0 },
      reportScore: (game, score) =>
        set((s) => ({ best: { ...s.best, [game]: Math.max(s.best[game] ?? 0, score) } })),
    }),
    {
      name: 'autism-scores',
      // Deep-merge so a saved store from an older version still has a best
      // score entry for every game (new games default to 0).
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ScoresState>
        return {
          ...current,
          ...p,
          best: { ...current.best, ...(p.best ?? {}) },
        }
      },
    },
  ),
)
