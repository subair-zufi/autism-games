import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Difficulty, DwellProfile, GameId, InputMethod, PlayMode } from '../types'
import type { Lang } from '../i18n/strings'

interface SettingsState {
  voiceOn: boolean
  soundOn: boolean
  /**
   * Master level for everything the child hears, 0..1 — the chimes, the praise
   * clips, the spoken prompts, and the video clips in the two Emotion Clips
   * games.
   *
   * `voiceOn`/`soundOn` are booleans, so until this existed the only lever a
   * trainer had for a sound-sensitive child was off — which also removes the
   * task's spoken instruction. Worse, the clips' own audio was outside even
   * that: nothing ever set `muted` or `volume` on the <video>, so muting the
   * app left the loudest thing in it playing at full level (review C2).
   *
   * Set at intake and changeable live from the trainer's phone, like
   * `dwellProfile` — the point is to reach a child who is already wearing the
   * headset.
   */
  volume: number
  // The single language every prompt, option and spoken line is shown in
  // (English or Malayalam), chosen in Profile → Language. Prompts used to show
  // both languages at once; now only this one is rendered and spoken.
  language: Lang
  difficulty: Record<GameId, Difficulty>
  // Which build of each skill's games Home shows — flipped from the
  // persistent header toggle so the choice survives navigation and reloads.
  playMode: PlayMode
  // How the child selects inside the 360 games — resting their gaze on the
  // target, or the controller ray. Set once per child at intake, and also
  // switchable in-world (the headset hides this page).
  inputMethod: InputMethod
  // How forgiving that gaze dwell is for this child — set at intake from how
  // steadily they can hold a look, and changeable from the trainer's remote
  // when a session shows the setting was wrong. Recorded on every gaze step.
  dwellProfile: DwellProfile
  // Whether the child has completed the one-time shared VR/360 practice
  // scene (look-around + tap gesture) — every 360 game checks this before its
  // very first real session so headset novelty isn't confounded with the
  // skill being measured (review U2). True forever once done.
  vrPracticeDone: boolean
  setVoiceOn: (v: boolean) => void
  setSoundOn: (v: boolean) => void
  setVolume: (v: number) => void
  setLanguage: (lang: Lang) => void
  setDifficulty: (game: GameId, d: Difficulty) => void
  setPlayMode: (mode: PlayMode) => void
  setInputMethod: (m: InputMethod) => void
  setDwellProfile: (p: DwellProfile) => void
  setVrPracticeDone: (v: boolean) => void
}

/** Keep a level in range, and treat junk (NaN, a string from an older console)
 *  as "leave it alone" rather than silencing the child's session. */
export function clampVolume(v: unknown, fallback = 1): number {
  const n = typeof v === 'number' ? v : Number.NaN
  if (!Number.isFinite(n)) return fallback
  return Math.min(1, Math.max(0, n))
}

/**
 * The levels the trainer's remote steps through, loudest first.
 *
 * Their console has chips, not sliders — it gets pressed with one thumb while
 * watching a child who has just flinched — so the control steps DOWN and wraps
 * back to full at the bottom, because down is the direction someone reaching
 * for it is almost always going.
 */
export const VOLUME_STEPS: readonly number[] = [1, 0.75, 0.5, 0.25, 0]

/** The next level down from `current`, wrapping to full below the quietest. */
export function nextVolumeStep(current: number | undefined): number {
  const now = clampVolume(current)
  return VOLUME_STEPS.find((v) => v < now - 0.01) ?? 1
}

const DWELL_PROFILE_IDS: ReadonlySet<string> = new Set<DwellProfile>([
  'standard',
  'extended',
  'high-support',
])

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      voiceOn: true,
      soundOn: true,
      // full, which is how every session before this setting existed played
      volume: 1,
      language: 'en',
      difficulty: { emotionrecognition: 'easy', emotionrecognition360: 'easy', blocks: 'easy', playroom360: 'easy', rollback: 'easy', football360: 'easy', museum: 'easy', museum360: 'easy', identifyemotions: 'easy', identifyemotions360: 'easy', calmcrew: 'easy', discovery: 'easy', park360: 'easy' },
      playMode: 'desktop',
      // gaze by default: nothing to hold, which is the point of the whole feature
      inputMethod: 'dwell',
      // the tuning every child played before the profile existed, so an
      // unchanged setup keeps behaving exactly as it did
      dwellProfile: 'standard',
      vrPracticeDone: false,
      setVoiceOn: (voiceOn) => set({ voiceOn }),
      setSoundOn: (soundOn) => set({ soundOn }),
      setVolume: (v) => set({ volume: clampVolume(v) }),
      setLanguage: (language) => set({ language }),
      setDifficulty: (game, d) =>
        set((s) => ({ difficulty: { ...s.difficulty, [game]: d } })),
      setPlayMode: (playMode) => set({ playMode }),
      setInputMethod: (inputMethod) => set({ inputMethod }),
      setDwellProfile: (dwellProfile) => set({ dwellProfile }),
      setVrPracticeDone: (vrPracticeDone) => set({ vrPracticeDone }),
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
          // 'poke' (bare-hand poke of an in-reach pad) was removed after Quest
          // testing. Devices that ran that build still have it persisted, and
          // it would otherwise leave them with no working selection at all.
          inputMethod:
            p.inputMethod === 'dwell' || p.inputMethod === 'controller'
              ? p.inputMethod
              : current.inputMethod,
          // a headset carrying a value this build doesn't know would otherwise
          // index DWELL_PROFILES to undefined and leave the child unable to
          // select at all
          dwellProfile: DWELL_PROFILE_IDS.has(p.dwellProfile as string)
            ? (p.dwellProfile as DwellProfile)
            : current.dwellProfile,
          // a headset carrying a junk level would otherwise multiply every
          // gain by NaN and leave the child with no sound at all
          volume: clampVolume(p.volume, current.volume),
        }
      },
    },
  ),
)
