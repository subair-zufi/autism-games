import { speechAvailable } from '../services/speech'
import { t, type Lang } from '../i18n/strings'
import { useRemoteReport } from '../remote/status'

/**
 * The band under a game that carries the question the child is being asked.
 *
 * Several games had their own copy of this markup — the two emotion games,
 * Roll Back, Football 360 and Playroom 360 — which is how the trainer's phone
 * ended up showing the question for some games and not others: only the games
 * using the shared `PromptBanner` were reporting it.
 * That is the wrong thing to leave to chance. Children in a headset frequently
 * cannot read the question, and a trainer who cannot see it is guessing at what
 * to prompt them with.
 *
 * So every prompt now passes through here, and here is where it is reported to
 * the console (remote/status.ts). Same markup as before, deliberately: these
 * games are tuned on-device and this is not the change to restyle them with.
 *
 * The answer options are NOT reported anywhere, and should not be. A trainer
 * who can see which choice is correct will cue it without meaning to, and the
 * measure goes with it.
 */
export function BilingualPromptBanner({
  lines,
  lang,
  onSpeak,
}: {
  /** The question, one entry per language on screen (currently always one). */
  lines: { lang: Lang; text: string }[]
  /** Language of the replay button's label. */
  lang: Lang
  /** Say it again. Omit to leave the button out — some games only offer it at
   *  certain moments (Emotion Clips waits until the clip has frozen). */
  onSpeak?: () => void
}) {
  useRemoteReport({ prompt: lines.map((l) => l.text).join(' · ') || null })

  return (
    <div className="prompt-banner er-prompt">
      <div className="er-prompt-lines">
        {lines.map(({ lang: l, text }) => (
          <span key={l} className={`er-prompt-line er-prompt-${l}`}>
            {text}
          </span>
        ))}
      </div>
      {onSpeak && speechAvailable() && (
        <button aria-label={t('sayAgain', lang)} onClick={onSpeak}>
          🔊
        </button>
      )}
    </div>
  )
}
