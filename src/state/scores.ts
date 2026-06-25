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
      best: { emotions: 0, zebra: 0, garden: 0, balldrop: 0, mirror: 0, blocks: 0, museum: 0, rightway: 0, rulefixer: 0, slider: 0, knowemotion: 0 },
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
