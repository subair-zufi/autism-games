import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Difficulty, GameId } from '../types'

interface SettingsState {
  voiceOn: boolean
  soundOn: boolean
  difficulty: Record<GameId, Difficulty>
  setVoiceOn: (v: boolean) => void
  setSoundOn: (v: boolean) => void
  setDifficulty: (game: GameId, d: Difficulty) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      voiceOn: true,
      soundOn: true,
      difficulty: { emotions: 'easy', zebra: 'easy', garden: 'easy', balldrop: 'easy', mirror: 'easy', blocks: 'easy', museum: 'easy' },
      setVoiceOn: (voiceOn) => set({ voiceOn }),
      setSoundOn: (soundOn) => set({ soundOn }),
      setDifficulty: (game, d) =>
        set((s) => ({ difficulty: { ...s.difficulty, [game]: d } })),
    }),
    { name: 'autism-settings' },
  ),
)
