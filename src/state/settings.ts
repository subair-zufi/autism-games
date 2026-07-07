import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Difficulty, GameId } from '../types'
import type { Lang } from '../i18n/strings'

interface SettingsState {
  voiceOn: boolean
  soundOn: boolean
  // UI-chrome language. Questions are always shown in every DISPLAY_LANGS, but
  // this drives single-language chrome and lets us add a language switcher later.
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
      difficulty: { emotionrecognition: 'easy', zebra: 'easy', garden: 'easy', balldrop: 'easy', mirror: 'easy', blocks: 'easy', museum: 'easy', rightway: 'easy', rulefixer: 'easy', slider: 'easy', identifyemotions: 'easy' },
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
      // would leave e.g. difficulty.slider undefined and crash that game.
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
