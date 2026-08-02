import { Link, useNavigate } from 'react-router-dom'
import { useSettings } from '../state/settings'
import { t, type MessageKey } from '../i18n/strings'
import type { Difficulty, GameMeta } from '../types'

const LEVELS: { id: Difficulty; labelKey: MessageKey }[] = [
  { id: 'easy', labelKey: 'levelEasy' },
  { id: 'medium', labelKey: 'levelMedium' },
  { id: 'hard', labelKey: 'levelHard' },
]

export function StartScreen({
  game,
  onStart,
  levelNotes,
}: {
  game: GameMeta
  onStart: () => void
  /** Optional short caption per level (already localized) — used by the
   *  joint-attention games to show how the cue fades pulse → hover → distal,
   *  so the research manipulation is visible right on the level picker. */
  levelNotes?: Partial<Record<Difficulty, string>>
}) {
  const difficulty = useSettings((s) => s.difficulty[game.id])
  const setDifficulty = useSettings((s) => s.setDifficulty)
  const lang = useSettings((s) => s.language)
  const navigate = useNavigate()
  return (
    <div className="start-screen">
      <div className="start-icon">{game.icon}</div>
      {/* Game titles stay English (matches the Home cards); the level labels
          and Play button below are game instruction, so they localize. */}
      <h1>{game.title}</h1>
      <span className="start-choose">{t('chooseLevel', lang)}</span>
      <div className="level-row">
        {LEVELS.map((l) => (
          <button
            key={l.id}
            className={difficulty === l.id ? 'level-btn selected' : 'level-btn'}
            onClick={() => setDifficulty(game.id, l.id)}
          >
            <span className="level-btn-name">{t(l.labelKey, lang)}</span>
            {levelNotes?.[l.id] && <span className="level-btn-note">{levelNotes[l.id]}</span>}
          </button>
        ))}
      </div>
      <button className="big-btn" onClick={onStart}>{t('play', lang)}</button>
      <button className="big-btn secondary" onClick={() => navigate(-1)}>{t('back', lang)}</button>
      <Link to="/" className="big-btn home-link">{t('home', lang)}</Link>
    </div>
  )
}
