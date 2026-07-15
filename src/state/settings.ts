import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Difficulty, GameId } from '../types'
import type { Lang } from '../i18n/strings'

interface SettingsState {
  voiceOn: boolean
  soundOn: boolean
  // The single language every prompt, option and spoken line is shown in
  // (English or Malayalam), chosen in Profile → Language. Prompts used to show
  // both languages at once; now only this one is rendered and spoken.
  language: Lang
  difficulty: Record<GameId, Difficulty>
  setVoiceOn: (v: boolean) => void
  setSoundOn: (v: boolean) => void
  setLanguage: (lang: Lang) => void
  setDifficulty: (game: GameId, d: Difficulty) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      voiceOn: true,
      soundOn: true,
      language: 'en',
      difficulty: { emotionrecognition: 'easy', emotionrecognition360: 'easy', blocks: 'easy', playroom360: 'easy', rollback: 'easy', football360: 'easy', museum: 'easy', museum360: 'easy', rightway: 'easy', rulefixer: 'easy', identifyemotions: 'easy', identifyemotions360: 'easy', discovery: 'easy', park360: 'easy' },
      setVoiceOn: (voiceOn) => set({ voiceOn }),
      setSoundOn: (soundOn) => set({ soundOn }),
      setLanguage: (language) => set({ language }),
      setDifficulty: (game, d) =>
        set((s) => ({ difficulty: { ...s.difficulty, [game]: d } })),
    }),
    {
      name: 'autism-settings',
      // Deep-merge so saved state from an older version (missing newer game
      // keys) still gets defaults for every game — otherwise a stale store
      // would leave e.g. difficulty.museum undefined and crash that game.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>
        return {
          ...current,
          ...p,
          difficulty: { ...current.difficulty, ...(p.difficulty ?? {}) },
        }
      },
    },
  ),
)
