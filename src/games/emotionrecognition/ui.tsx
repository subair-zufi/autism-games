/**
 * Presentational building blocks for Emotion Recognition. These are the pieces
 * refactored out of the two old games (image + loader, tap-region overlay,
 * emotion choice row) plus the new bilingual prompt, level picker and result
 * screen. They hold no game logic — the orchestrator wires them together.
 */
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { emotionMeta, type EmotionId } from '../emotionVocab'
import { speak, speechAvailable } from '../../services/speech'
import { emotionLabel, t, type Lang, DISPLAY_LANGS } from '../../i18n/strings'
import type { Difficulty } from '../../types'
import type { GroupPhoto } from './content'
import type { LevelSummary } from './logic'
import type { LevelState } from './useLevelProgress'

/** <img> that shows a spinner until the (possibly slow) photo has loaded. */
function LoadingImage({ src, alt, className }: { src: string; alt: string; className: string }) {
  const [loaded, setLoaded] = useState(false)
  // Reset the loader whenever the source changes to a new image.
  useEffect(() => setLoaded(false), [src])
  return (
    <>
      {!loaded && <div className="emotion-img-loader"><div className="emotion-spinner" /></div>}
      <img
        className={className}
        style={{ opacity: loaded ? 1 : 0 }}
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
      />
    </>
  )
}

/** The question, rendered in every display language, with a speak button. */
export function BilingualPrompt({ lines, speakText }: { lines: { lang: Lang; text: string }[]; speakText: string }) {
  // Speak the primary-language prompt when it changes (matches PromptBanner).
  useEffect(() => { speak(speakText) }, [speakText])
  return (
    <div className="prompt-banner er-prompt">
      <div className="er-prompt-lines">
        {lines.map(({ lang, text }) => (
          <span key={lang} className={`er-prompt-line er-prompt-${lang}`}>{text}</span>
        ))}
      </div>
      {speechAvailable() && (
        <button aria-label="Say it again" onClick={() => speak(speakText)}>🔊</button>
      )}
    </div>
  )
}

/** Emotion answer buttons (emoji + bilingual labels) with correct/wrong states. */
export function ChoiceRow({
  choices,
  answer,
  picked,
  answered,
  onPick,
}: {
  choices: EmotionId[]
  answer: EmotionId
  picked: EmotionId | null
  answered: boolean
  onPick: (id: EmotionId) => void
}) {
  return (
    <div className="choice-row">
      {choices.map((id) => {
        const m = emotionMeta(id)
        // After answering: always mark the correct choice, and mark the wrong pick.
        let cls = 'choice-btn'
        if (answered && id === answer) cls += ' correct'
        else if (answered && id === picked) cls += ' wrong'
        return (
          <button key={id} className={cls} disabled={answered} onClick={() => onPick(id)}>
            <span className="choice-emoji">{m.emoji}</span>
            {DISPLAY_LANGS.map((lang) => (
              <span key={lang} className={`choice-label choice-label-${lang}`}>{emotionLabel(id, lang)}</span>
            ))}
          </button>
        )
      })}
    </div>
  )
}

/** Single-person face for Easy + single activities. */
export function SingleImageStage({ src }: { src: string }) {
  return (
    <div className="game-canvas">
      <LoadingImage src={src} alt="How does this face feel?" className="emotion-display-img" />
    </div>
  )
}

/**
 * Group photo with a tappable region per face.
 *  - `whoFeels`: regions are buttons; picking the target person answers.
 *  - `nameFace`: one region is highlighted and the answer comes from ChoiceRow.
 */
export function GroupPhotoStage({
  photo,
  mode,
  highlightIndex,
  answered,
  correctIndex,
  pickedIndex,
  onPick,
}: {
  photo: GroupPhoto
  mode: 'whoFeels' | 'nameFace'
  highlightIndex?: number
  answered: boolean
  correctIndex?: number
  pickedIndex?: number | null
  onPick?: (i: number) => void
}) {
  const colWidth = 100 / photo.emotions.length
  return (
    <div className="game-canvas">
      <div className="video-stage">
        <div className="group-photo-wrap">
          <LoadingImage src={photo.src} alt="People showing different feelings" className="group-photo" />
          {photo.emotions.map((_, i) => {
            let cls = 'tap-region'
            if (mode === 'nameFace' && i === highlightIndex) cls += ' highlight'
            if (mode === 'whoFeels' && answered && i === correctIndex) cls += ' correct'
            if (mode === 'whoFeels' && answered && i === pickedIndex && i !== correctIndex) cls += ' wrong'
            return (
              <button
                key={i}
                className={cls}
                style={{ left: `${i * colWidth}%`, width: `${colWidth}%` }}
                disabled={mode !== 'whoFeels' || answered}
                aria-label={`person ${i + 1}`}
                onClick={() => onPick?.(i)}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** Thin progress bar for "activity n of N". */
export function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0
  return (
    <div className="er-progressbar" role="progressbar" aria-valuenow={current} aria-valuemax={total}>
      <div className="er-progressbar-fill" style={{ width: `${pct}%` }} />
    </div>
  )
}

const LEVEL_KEY: Record<Difficulty, 'levelEasy' | 'levelMedium' | 'levelHard'> = {
  easy: 'levelEasy',
  medium: 'levelMedium',
  hard: 'levelHard',
}

/** Level picker that locks levels the learner has not unlocked yet. */
export function LevelSelect({
  levels,
  selected,
  stateFor,
  lang,
  onSelect,
  onStart,
}: {
  levels: Difficulty[]
  selected: Difficulty
  stateFor: (l: Difficulty) => LevelState
  lang: Lang
  onSelect: (l: Difficulty) => void
  onStart: () => void
}) {
  return (
    <div className="start-screen">
      <div className="start-icon">🧠</div>
      <h1>{t('gameTitle', lang)}</h1>
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
