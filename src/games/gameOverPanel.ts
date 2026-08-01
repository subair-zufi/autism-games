import { useEffect, useRef } from 'react'
import { create } from 'zustand'
import { t, type Lang } from '../i18n/strings'

/**
 * The results of a finished round, published by the game and rendered in-world
 * by `VRGameOver`.
 *
 * Why this exists rather than props: on this headset **any** `XRSession.end()`
 * makes the Quest browser drop the child into its home environment with no
 * window to come back to — proven with a bare WebXR page that shares none of
 * our code. Every game used to end its session the moment a round finished, so
 * the results dialog could be read on the flat page. That meant every completed
 * game stranded the child. The results now stay inside VR, and the session ends
 * once, deliberately, when the whole visit is over.
 *
 * A store rather than scene props because each of the seven scenes would
 * otherwise need the same four fields threaded through its own interface; this
 * way a game publishes, and the shared panel — mounted next to `HeadSelect` in
 * every scene — picks it up.
 */

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
  playAgainLabel: string
  finishLabel: string
  /** start another round, staying in VR */
  onRestart: () => void
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
 * The wording is built here from the same keys the flat `GameOverDialog` uses,
 * so the two never drift apart.
 */
export function useVrGameOverPanel(opts: {
  over: boolean
  /** headline, already localized — some games vary it by win/try-again */
  headline: string
  score: number
  best: number
  stars?: number
  lang: Lang
  onRestart: () => void
}): void {
  const show = useVrGameOver((s) => s.show)
  const hide = useVrGameOver((s) => s.hide)

  // Held in a ref so a restart always runs the *current* closure. Putting the
  // callback in the dependency list instead would either republish every frame
  // or, worse, restart a round with a stale level config.
  const restart = useRef(opts.onRestart)
  restart.current = opts.onRestart

  const { over, headline, score, best, stars, lang } = opts

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
      playAgainLabel: t('playAgain', lang),
      finishLabel: t('vrFinish', lang),
      onRestart: () => restart.current(),
    })
  }, [over, headline, score, best, stars, lang, show, hide])

  // leaving the game must not leave a stale panel behind for the next one
  useEffect(() => hide, [hide])
}
