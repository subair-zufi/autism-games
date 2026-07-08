import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../state/auth'
import { GAME_LIST } from '../types'
import { useScores } from '../state/scores'
import { useSettings } from '../state/settings'
import { playTap } from '../services/sounds'
import type { Student } from '../services/analytics'

export function Home() {
  const isLoggedIn = useAuth((s) => s.isLoggedIn)
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const best = useScores((s) => s.best)
  const voiceOn = useSettings((s) => s.voiceOn)
  const soundOn = useSettings((s) => s.soundOn)
  const setVoiceOn = useSettings((s) => s.setVoiceOn)
  const setSoundOn = useSettings((s) => s.setSoundOn)

  return (
    <div className="home">
      <header className="home-header">
        <h1>Autism Games</h1>
        <p>Pick a game to play!</p>
        {isLoggedIn ? (
          <span className="auth-chip">
            👋 {user?.full_name || user?.email}
            <button className="link-btn" onClick={() => logout()}>Log out</button>
          </span>
        ) : (
          <Link to="/login" className="auth-chip" onClick={() => playTap()}>🔑 Sign in</Link>
        )}
      </header>
      {isLoggedIn && <StudentManager />}
      <div className="card-grid">
        {GAME_LIST.map((g) => (
          <Link
            key={g.id}
            to={g.path}
            className="game-card"
            style={{ '--card-accent': g.color } as React.CSSProperties}
            onClick={() => playTap()}
          >
            <span className="card-icon">{g.icon}</span>
            <span className="card-title">{g.title}</span>
            <span className="card-best">⭐ Best: {best[g.id]}</span>
          </Link>
        ))}
      </div>
      <div className="settings-row">
        <button className={voiceOn ? 'toggle on' : 'toggle'} onClick={() => setVoiceOn(!voiceOn)}>
          🔊 Voice {voiceOn ? 'On' : 'Off'}
        </button>
        <button className={soundOn ? 'toggle on' : 'toggle'} onClick={() => setSoundOn(!soundOn)}>
          🎵 Sounds {soundOn ? 'On' : 'Off'}
        </button>
      </div>
    </div>
  )
}

/**
 * Mentor-only panel: manage students and pick which one gameplay is attributed
 * to. The active student is tracked by the analytics client, so games attach it
 * automatically with no per-game changes.
 */
function StudentManager() {
  const students = useAuth((s) => s.students)
  const activeStudentId = useAuth((s) => s.activeStudentId)
  const loadStudents = useAuth((s) => s.loadStudents)
  const addStudent = useAuth((s) => s.addStudent)
  const editStudent = useAuth((s) => s.editStudent)
  const removeStudent = useAuth((s) => s.removeStudent)
  const switchStudent = useAuth((s) => s.switchStudent)

  const [showInactive, setShowInactive] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Refresh the list on mount (e.g. after a page reload re-hydrates auth).
  useEffect(() => {
    void loadStudents(showInactive).catch(() => {})
  }, [loadStudents, showInactive])

  const active = students.find((s) => s.id === activeStudentId) ?? null

  async function run(action: () => Promise<unknown>) {
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  return (
    <section className="students-panel">
      <div className="students-head">
        <h2>👩‍🏫 Students</h2>
        <span className="students-active">
          {active ? <>Playing as <strong>{active.full_name}</strong></> : 'No student selected'}
        </span>
      </div>

      <label className="students-picker">
        Active student
        <select
          value={activeStudentId ?? ''}
          onChange={(e) => switchStudent(e.target.value || null)}
        >
          <option value="">— none (no attribution) —</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}{s.is_active ? '' : ' (inactive)'}
            </option>
          ))}
        </select>
      </label>

      {error && <p className="students-error">{error}</p>}

      <ul className="students-list">
        {students.length === 0 && <li className="students-empty">No students yet. Add one below.</li>}
        {students.map((s) =>
          editingId === s.id ? (
            <li key={s.id}>
              <StudentForm
                initial={s}
                submitLabel="Save"
                onCancel={() => setEditingId(null)}
                onSubmit={(input) =>
                  run(async () => {
                    await editStudent(s.id, input)
                    setEditingId(null)
                  })
                }
              />
            </li>
          ) : (
            <li key={s.id} className={s.id === activeStudentId ? 'student-row active' : 'student-row'}>
              <span className="student-name">
                {s.full_name}
                {s.id === activeStudentId && <span className="student-badge">▶ active</span>}
                {!s.is_active && <span className="student-badge inactive">inactive</span>}
              </span>
              <span className="student-actions">
                {s.is_active && s.id !== activeStudentId && (
                  <button className="link-btn" onClick={() => switchStudent(s.id)}>Play as</button>
                )}
                <button className="link-btn" onClick={() => setEditingId(s.id)}>Edit</button>
                {s.is_active ? (
                  <button
                    className="link-btn"
                    onClick={() => run(() => editStudent(s.id, { is_active: false }))}
                  >
                    Deactivate
                  </button>
                ) : (
                  <button
                    className="link-btn"
                    onClick={() => run(() => editStudent(s.id, { is_active: true }))}
                  >
                    Reactivate
                  </button>
                )}
              </span>
            </li>
          ),
        )}
      </ul>

      <div className="students-foot">
        {showAdd ? (
          <StudentForm
            submitLabel="Add student"
            onCancel={() => setShowAdd(false)}
            onSubmit={(input) =>
              run(async () => {
                await addStudent(input)
                setShowAdd(false)
              })
            }
          />
        ) : (
          <button className="students-add-btn" onClick={() => setShowAdd(true)}>➕ Add student</button>
        )}
        <label className="students-toggle-inactive">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Show inactive
        </label>
      </div>
      {/* removeStudent is available for hard-delete; deactivate is the softer default */}
      {editingId && (
        <p className="students-delete-hint">
          <button
            className="link-btn danger"
            onClick={() =>
              run(async () => {
                await removeStudent(editingId)
                setEditingId(null)
              })
            }
          >
            Delete permanently
          </button>
        </p>
      )}
    </section>
  )
}

function StudentForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Student
  submitLabel: string
  onSubmit: (input: { full_name: string; date_of_birth: string | null; notes: string | null }) => void
  onCancel: () => void
}) {
  const [fullName, setFullName] = useState(initial?.full_name ?? '')
  const [dob, setDob] = useState(initial?.date_of_birth ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  function submit(e: FormEvent) {
    e.preventDefault()
    const name = fullName.trim()
    if (!name) return
    onSubmit({
      full_name: name,
      date_of_birth: dob || null,
      notes: notes.trim() || null,
    })
  }

  return (
    <form className="student-form" onSubmit={submit}>
      <label>
        Full name
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Student name" required />
      </label>
      <label>
        Date of birth
        <input type="date" value={dob ?? ''} onChange={(e) => setDob(e.target.value)} />
      </label>
      <label>
        Notes
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
      </label>
      <div className="student-form-actions">
        <button type="submit" className="students-add-btn" disabled={!fullName.trim()}>{submitLabel}</button>
        <button type="button" className="link-btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
