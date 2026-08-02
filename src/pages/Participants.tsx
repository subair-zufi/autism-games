import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/auth'
import { initials, participantMeta } from '../lib/participant'
import { PencilIcon, PlusIcon, TrashIcon } from '../components/icons'

const LEVEL_TONE: Record<string, string> = {
  'Level 1': 'green',
  'Level 2': 'amber',
  'Level 3': 'red',
}

export function Participants() {
  const navigate = useNavigate()
  const students = useAuth((s) => s.students)
  const activeStudentId = useAuth((s) => s.activeStudentId)
  const loadStudents = useAuth((s) => s.loadStudents)
  const switchStudent = useAuth((s) => s.switchStudent)
  const removeStudent = useAuth((s) => s.removeStudent)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadStudents().catch(() => {})
  }, [loadStudents])

  async function onDelete(id: string, name: string) {
    if (!window.confirm(`Delete ${name}? Their past records are kept but detached.`)) return
    setError(null)
    try {
      await removeStudent(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  return (
    <div className="page participants">
      <header className="page-head">
        <h1>Participants</h1>
      </header>

      {error && <p className="auth-error">{error}</p>}

      {students.length === 0 && (
        <p className="empty">No participants yet. Tap ＋ to add one.</p>
      )}

      <ul className="participant-list">
        {students.map((s) => {
          const isActive = s.id === activeStudentId
          const tone = s.autism_level ? LEVEL_TONE[s.autism_level] ?? 'amber' : null
          return (
            <li key={s.id} className={isActive ? 'participant-card active' : 'participant-card'}>
              <span className="pc-avatar">{s.avatar ? s.avatar : initials(s.full_name)}</span>
              <div className="pc-info">
                <div className="pc-name-row">
                  <span className="pc-name">{s.full_name}</span>
                  {s.autism_level && <span className={`level-badge tone-${tone}`}>{s.autism_level}</span>}
                </div>
                <span className="pc-meta">{participantMeta(s) || '—'}</span>
                {s.participant_code && <span className="pc-code">{s.participant_code}</span>}
              </div>
              <div className="pc-actions">
                <button
                  className={isActive ? 'select-btn selected' : 'select-btn'}
                  disabled={isActive}
                  onClick={() => switchStudent(s.id)}
                >
                  {isActive ? 'Selected' : 'Select'}
                </button>
                <div className="pc-icon-row">
                  <button className="icon-btn small" aria-label="Edit" onClick={() => navigate(`/participants/${s.id}/edit`)}>
                    <PencilIcon />
                  </button>
                  <button className="icon-btn small danger" aria-label="Delete" onClick={() => onDelete(s.id, s.full_name)}>
                    <TrashIcon />
                  </button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      <button className="fab" aria-label="Add participant" onClick={() => navigate('/participants/new')}>
        <PlusIcon />
      </button>
    </div>
  )
}
