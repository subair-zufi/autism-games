/**
 * Shared level-select and level-result screens for level-based games
 * (Emotion Recognition, Emotion Clips). Purely presentational — unlock state
 * comes from `useLevelProgress`, scoring from `scoreLevel`.
 */
import { Link } from 'react-router-dom'
import { t, type Lang } from '../i18n/strings'
import type { Difficulty } from '../types'
import type { LevelState, LevelSummary } from '../games/progression'

const LEVEL_KEY: Record<Difficulty, 'levelEasy' | 'levelMedium' | 'levelHard'> = {
  easy: 'levelEasy',
  medium: 'levelMedium',
  hard: 'levelHard',
}

/** Level picker that locks levels the learner has not unlocked yet. */
export function LevelSelect({
  title,
  icon,
  levels,
  selected,
  stateFor,
  lang,
  onSelect,
  onStart,
}: {
  title: string
  icon: string
  levels: Difficulty[]
  selected: Difficulty
  stateFor: (l: Difficulty) => LevelState
  lang: Lang
  onSelect: (l: Difficulty) => void
  onStart: () => void
}) {
  return (
    <div className="start-screen">
      <div className="start-icon">{icon}</div>
      <h1>{title}</h1>
      <p className="er-subtitle">{t('chooseLevel', lang)}</p>
      <div className="level-row">
        {levels.map((l) => {
          const st = stateFor(l)
          const isSel = selected === l
          return (
            <button
              key={l}
              className={`level-btn${isSel ? ' selected' : ''}${st.unlocked ? '' : ' locked'}`}
              disabled={!st.unlocked}
              onClick={() => onSelect(l)}
            >
              <span>{st.unlocked ? '' : '🔒 '}{t(LEVEL_KEY[l], lang)}</span>
              {st.attempts > 0 && (
                <span className="level-best">
                  {st.mastered ? '🏆 ' : st.passed ? '✅ ' : ''}
                  {Math.round(st.bestAccuracy * 100)}%
                </span>
              )}
            </button>
          )
        })}
      </div>
      <button className="big-btn" onClick={onStart} disabled={!stateFor(selected).unlocked}>
        {t('play', lang)}
      </button>
      <Link to="/" className="big-btn home-link">{t('home', lang)}</Link>
    </div>
  )
}

/** End-of-level result: score, accuracy, counts and the pass/retry message. */
export function LevelResult({
  summary,
  lang,
  onReplay,
  onChooseLevel,
}: {
  summary: LevelSummary
  lang: Lang
  onReplay: () => void
  onChooseLevel: () => void
}) {
  const messageKey = summary.mastered ? 'resultMastered' : summary.passed ? 'resultPassed' : 'resultFailed'
  return (
    <div className="overlay">
      <div className="dialog er-result">
        <h2>{t('resultTitle', lang)} 🎉</h2>
        <div className="er-result-stats">
          <div><strong>{t('score', lang)}</strong><span>{summary.correct} / {summary.total}</span></div>
          <div><strong>{t('accuracy', lang)}</strong><span>{Math.round(summary.accuracy * 100)}%</span></div>
          <div><strong>{t('numCorrect', lang)}</strong><span className="er-correct">{summary.correct}</span></div>
          <div><strong>{t('numIncorrect', lang)}</strong><span className="er-incorrect">{summary.incorrect}</span></div>
        </div>
        <p className={`er-result-msg ${summary.passed ? 'pass' : 'retry'}`}>{t(messageKey, lang)}</p>
        <button className="big-btn" onClick={onReplay}>{t('playAgain', lang)}</button>
        <button className="big-btn secondary" onClick={onChooseLevel}>{t('chooseLevel', lang)}</button>
        <Link to="/" className="big-btn home-link">{t('home', lang)}</Link>
      </div>
    </div>
  )
}
