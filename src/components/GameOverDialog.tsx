import { Link } from 'react-router-dom'
import { t, type Lang } from '../i18n/strings'

export function GameOverDialog(props: {
  score: number
  best: number
  onRestart: () => void
  /** optional: return to the in-game level picker instead of only home/replay */
  onChooseLevel?: () => void
  /** 1-3 stars for the session; omitted for games without a star rating */
  stars?: number
  /** headline override, e.g. an encouraging message when the session ends */
  message?: string
  /** language for the built-in labels; defaults to English */
  lang?: Lang
}) {
  const lang = props.lang ?? 'en'
  return (
    <div className="overlay">
      <div className="dialog">
        <h2>{props.message ?? t('greatPlaying', lang)}</h2>
        {props.stars !== undefined && (
          <p className="dialog-stars" aria-label={`${props.stars} stars`}>
            {'⭐'.repeat(Math.max(1, props.stars))}
          </p>
        )}
        <p className="dialog-score">{t('dialogEarned', lang, { score: props.score })}</p>
        <p className="dialog-best">{t('dialogBest', lang, { best: props.best })}</p>
        <button className="big-btn" onClick={props.onRestart}>{t('playAgain', lang)}</button>
        {props.onChooseLevel && (
          <button className="big-btn secondary" onClick={props.onChooseLevel}>
            {t('changeLevel', lang)}
          </button>
        )}
        <Link to="/" className="big-btn home-link">{t('home', lang)}</Link>
      </div>
    </div>
  )
}
