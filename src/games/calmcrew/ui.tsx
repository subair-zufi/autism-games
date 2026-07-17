import type { Lang } from '../../i18n/strings'
import { emotionLabel } from '../../i18n/strings'
import { emotionMeta, type EmotionId } from '../emotionVocab'
import { STRATEGIES, type StrategyId } from './logic'
import { strategyLabel } from './strings'

/** Red → amber → green as the meter falls from 100 to 0. */
function meterColor(value: number): string {
  const v = Math.max(0, Math.min(100, value))
  const hue = (1 - v / 100) * 120 // 0 = red at full, 120 = green at empty
  return `hsl(${hue}, 70%, 48%)`
}

/** The Feelings Meter: how big the feeling is right now, 0–100. */
export function FeelingsMeter({ value, big, calm }: { value: number; big: string; calm: string }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className="meter" role="meter" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <span className="meter-cap meter-cap-big">{big}</span>
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${v}%`, background: meterColor(v) }} />
      </div>
      <span className="meter-cap meter-cap-calm">{calm}</span>
    </div>
  )
}

/** The child's face — upset while the feeling is big, easing to calm as it falls. */
export function CalmFace({ triggerEmoji, meter }: { triggerEmoji: string; meter: number }) {
  const face = meter > 66 ? '😣' : meter > 33 ? '😕' : '😌'
  return (
    <div className="calm-face-wrap">
      <div className="calm-face">{face}</div>
      <div className="calm-trigger-badge" aria-hidden>{triggerEmoji}</div>
    </div>
  )
}

/** "Name it" — pick the feeling the situation stirs up. */
export function FeelingChoices({
  options,
  answer,
  answered,
  picked,
  onPick,
  lang,
}: {
  options: EmotionId[]
  answer: EmotionId
  answered: boolean
  picked: EmotionId | null
  onPick: (e: EmotionId) => void
  lang: Lang
}) {
  return (
    <div className="choice-row">
      {options.map((e) => {
        const meta = emotionMeta(e)
        const show = answered && (e === answer || e === picked)
        const mark = e === answer ? ' ✅' : e === picked ? ' 💛' : ''
        return (
          <button
            key={e}
            className="choice-btn"
            disabled={answered}
            onClick={() => onPick(e)}
          >
            <span className="choice-emoji">{meta.emoji}</span>
            <span>{emotionLabel(e, lang)}{show ? mark : ''}</span>
          </button>
        )
      })}
    </div>
  )
}

/** "Choose it" — the calming toolkit. `suggested` glows on easy. */
export function StrategyGrid({
  suggested,
  onPick,
  lang,
}: {
  suggested: StrategyId | null
  onPick: (id: StrategyId) => void
  lang: Lang
}) {
  return (
    <div className="strategy-grid">
      {STRATEGIES.map((s) => (
        <button
          key={s.id}
          className={s.id === suggested ? 'strategy-card suggested' : 'strategy-card'}
          onClick={() => onPick(s.id)}
        >
          <span className="strategy-emoji">{s.emoji}</span>
          <span className="strategy-name">{strategyLabel(s.id, lang)}</span>
        </button>
      ))}
    </div>
  )
}

/** The balloon: hold it to breathe in (it inflates), let go to breathe out. */
export function BalloonBreather({
  held,
  inhaleMs,
  cyclesDone,
  cyclesTotal,
  onHoldStart,
  onHoldEnd,
  label,
}: {
  held: boolean
  inhaleMs: number
  cyclesDone: number
  cyclesTotal: number
  onHoldStart: () => void
  onHoldEnd: () => void
  label: string
}) {
  return (
    <div className="balloon-wrap">
      <button
        className={held ? 'balloon inhaling' : 'balloon'}
        style={{ transitionDuration: `${inhaleMs}ms` }}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); onHoldStart() }}
        onPointerUp={onHoldEnd}
        onPointerLeave={() => { if (held) onHoldEnd() }}
        aria-label="Breathing balloon"
      >
        🎈
      </button>
      <p className="breath-label">{label}</p>
      <p className="breath-count" aria-hidden>
        {'○'.repeat(Math.max(0, cyclesTotal - cyclesDone))}
        {'●'.repeat(Math.min(cyclesDone, cyclesTotal))}
      </p>
    </div>
  )
}

/** Count to ten: tap the numbers in order; taps out of order do nothing. */
export function CountPad({ target, count, onTap }: { target: number; count: number; onTap: (n: number) => void }) {
  return (
    <div className="count-pad">
      {Array.from({ length: target }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          className={n <= count ? 'count-num done' : 'count-num'}
          disabled={n !== count + 1}
          onClick={() => onTap(n)}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

/** A guided coping action: one big button to do it, then to notice it worked. */
export function QuickPanel({ emoji, text, onStep }: { emoji: string; text: string; onStep: () => void }) {
  return (
    <button className="quick-panel" onClick={onStep}>
      <span className="quick-emoji">{emoji}</span>
      <span className="quick-text">{text}</span>
    </button>
  )
}
