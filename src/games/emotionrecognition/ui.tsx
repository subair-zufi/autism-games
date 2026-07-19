/**
 * Presentational building blocks for Emotion Recognition. These are the pieces
 * refactored out of the two old games (image + loader, tap-region overlay,
 * emotion choice row) plus the new bilingual prompt. The level picker and
 * result screen are shared with other level games in
 * `components/LevelScreens.tsx`. They hold no game logic — the orchestrator
 * wires them together.
 */
import { useEffect, useState } from 'react'
import { emotionMeta, type EmotionId } from '../emotionVocab'
import { speak, speechAvailable } from '../../services/speech'
import { emotionLabel, t, type Lang, displayLangs } from '../../i18n/strings'
import type { GroupPhoto } from './content'

/** <img> that shows a spinner until the (possibly slow) photo has loaded.
 *  `onReady` fires when the image becomes visible — the response-latency
 *  measurement starts there, so slow networks don't inflate latencies. */
function LoadingImage({
  src,
  alt,
  className,
  onReady,
}: {
  src: string
  alt: string
  className: string
  onReady?: () => void
}) {
  const [loaded, setLoaded] = useState(false)
  // Reset the loader whenever the source changes to a new image.
  useEffect(() => setLoaded(false), [src])
  const ready = () => {
    setLoaded(true)
    onReady?.()
  }
  return (
    <>
      {!loaded && <div className="emotion-img-loader"><div className="emotion-spinner" /></div>}
      <img
        className={className}
        style={{ opacity: loaded ? 1 : 0 }}
        src={src}
        alt={alt}
        onLoad={ready}
        onError={ready}
      />
    </>
  )
}

/** The question, rendered in the chosen language, with a speak button. */
export function BilingualPrompt({
  lines,
  speakText,
  speakLang = 'en',
}: {
  lines: { lang: Lang; text: string }[]
  speakText: string
  speakLang?: Lang
}) {
  // Speak the prompt (in the chosen language) when it changes.
  useEffect(() => { speak(speakText, speakLang) }, [speakText, speakLang])
  return (
    <div className="prompt-banner er-prompt">
      <div className="er-prompt-lines">
        {lines.map(({ lang, text }) => (
          <span key={lang} className={`er-prompt-line er-prompt-${lang}`}>{text}</span>
        ))}
      </div>
      {speechAvailable() && (
        <button aria-label={t('sayAgain', speakLang)} onClick={() => speak(speakText, speakLang)}>🔊</button>
      )}
    </div>
  )
}

/** Emotion answer buttons (emoji + label in the chosen language) with
 *  correct/wrong states. */
export function ChoiceRow({
  choices,
  answer,
  picked,
  answered,
  lang,
  onPick,
}: {
  choices: EmotionId[]
  answer: EmotionId
  picked: EmotionId | null
  answered: boolean
  lang: Lang
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
            {displayLangs(lang).map((l) => (
              <span key={l} className={`choice-label choice-label-${l}`}>{emotionLabel(id, l)}</span>
            ))}
          </button>
        )
      })}
    </div>
  )
}

/** Single-person face for Easy + single activities. */
export function SingleImageStage({ src, onReady }: { src: string; onReady?: () => void }) {
  return (
    <div className="game-canvas">
      <LoadingImage
        src={src}
        alt="How does this face feel?"
        className="emotion-display-img"
        onReady={onReady}
      />
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
  onReady,
}: {
  photo: GroupPhoto
  mode: 'whoFeels' | 'nameFace'
  highlightIndex?: number
  answered: boolean
  correctIndex?: number
  pickedIndex?: number | null
  onPick?: (i: number) => void
  onReady?: () => void
}) {
  const colWidth = 100 / photo.emotions.length
  return (
    <div className="game-canvas">
      <div className="video-stage">
        <div className="group-photo-wrap">
          <LoadingImage
            src={photo.src}
            alt="People showing different feelings"
            className="group-photo"
            onReady={onReady}
          />
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
