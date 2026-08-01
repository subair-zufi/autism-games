import { useEffect, useMemo, useRef } from 'react'
import { create } from 'zustand'
import { t, type Lang } from '../i18n/strings'
import { useSettings } from '../state/settings'
import type { Difficulty, GameId } from '../types'

/**
 * The results of a finished round, published by the game and rendered in-world
 * by `VRGameOver`.
 *
 * Why this exists rather than props: on this headset **any** `XRSession.end()`
 * makes the Quest browser drop the child into its home environment with no
 * window to come back to — proven with a bare WebXR page that shares none of
 * our code. Every game used to end its session the moment a round finished, so
 * the results dialog could be read on the flat page. That meant every completed
 * game stranded the child. The results now stay inside VR, and the panel offers
 * the same three choices as the flat dialog: play again, choose a level, or go
 * Home — only the last of which leaves the headset at all.
 *
 * A store rather than scene props because each of the seven scenes would
 * otherwise need the same fields threaded through its own interface; this way a
 * game publishes, and the shared panel — mounted next to `HeadSelect` in every
 * scene — picks it up.
 */

/** The three levels, in the same order the flat `StartScreen` shows them. */
const LEVELS: Difficulty[] = ['easy', 'medium', 'hard']

export interface VrLevelOption {
  id: Difficulty
  label: string
}

/**
 * Every field arrives already localized. The games build these lines for their
 * flat results dialog anyway, so passing them through keeps one wording in one
 * place instead of the in-world panel growing its own copy of the i18n.
 */
export interface VrGameOverInfo {
  headline: string
  /** e.g. "You earned ⭐ 7" */
  scoreLine: string
  /** e.g. "Your best: 12" */
  bestLine: string
  /** 1–3 stars, omitted by games without a star rating */
  stars?: number
  labels: {
    playAgain: string
    chooseLevel: string
    home: string
    play: string
    chooseLevelTitle: string
  }
  levels: VrLevelOption[]
  currentLevel: Difficulty
  /**
   * Selects a level without starting. Kept separate from `onPlay` on purpose: a
   * game's `start()` closes over the difficulty from its last render, so setting
   * and starting in one act would begin the round on the *previous* level. The
   * flat picker is two steps for the same reason.
   */
  onSelectLevel: (level: Difficulty) => void
  /** start a round on the currently selected level, staying in VR */
  onPlay: () => void
}

interface VrGameOverState {
  info: VrGameOverInfo | null
  show: (info: VrGameOverInfo) => void
  hide: () => void
}

export const useVrGameOver = create<VrGameOverState>((set) => ({
  info: null,
  show: (info) => set({ info }),
  hide: () => set({ info: null }),
}))

/**
 * Publishes a finished round to the in-world panel. Call once per 360 game,
 * replacing the effect that used to end the session on `phase === 'over'`.
 *
 * The wording is built here from the same keys the flat `GameOverDialog` and
 * `StartScreen` use, so the two never drift apart.
 */
export function useVrGameOverPanel(opts: {
  over: boolean
  /** headline, already localized — some games vary it by win/try-again */
  headline: string
  score: number
  best: number
  stars?: number
  lang: Lang
  gameId: GameId
  /** the level currently chosen for this game */
  level: Difficulty
  /** start a round on the chosen level */
  onRestart: () => void
}): void {
  const show = useVrGameOver((s) => s.show)
  const hide = useVrGameOver((s) => s.hide)
  const setDifficulty = useSettings((s) => s.setDifficulty)

  // Held in a ref so a restart always runs the *current* closure. Putting the
  // callback in the dependency list instead would either republish every frame
  // or, worse, restart a round with a stale level config.
  const restart = useRef(opts.onRestart)
  restart.current = opts.onRestart

  const { over, headline, score, best, stars, lang, gameId, level } = opts

  const levels = useMemo<VrLevelOption[]>(
    () =>
      LEVELS.map((id) => ({
        id,
        label: t(id === 'easy' ? 'levelEasy' : id === 'medium' ? 'levelMedium' : 'levelHard', lang),
      })),
    [lang],
  )

  useEffect(() => {
    if (!over) {
      hide()
      return
    }
    show({
      headline,
      scoreLine: t('dialogEarned', lang, { score }),
      bestLine: t('dialogBest', lang, { best }),
      stars,
      labels: {
        playAgain: t('playAgain', lang),
        chooseLevel: t('changeLevel', lang),
        home: t('home', lang),
        play: t('play', lang),
        chooseLevelTitle: t('chooseLevel', lang),
      },
      levels,
      currentLevel: level,
      onSelectLevel: (next) => setDifficulty(gameId, next),
      onPlay: () => restart.current(),
    })
  }, [over, headline, score, best, stars, lang, gameId, level, levels, show, hide, setDifficulty])

  // leaving the game must not leave a stale panel behind for the next one
  useEffect(() => hide, [hide])
}
