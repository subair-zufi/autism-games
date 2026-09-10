import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../state/auth'
import { participantMeta } from '../lib/participant'
import type { StudentInput } from '../services/analytics'

/**
 * Participants, managed from the trainer's phone while a session is running.
 *
 * Choosing who a session records against was already here; adding and removing
 * were not, and sending the trainer to the Participants tab to do it means
 * leaving the console — with a child mid-session in a headset — to come back
 * and find their place again. A child who turns up unexpectedly, or one entered
 * twice in a hurry, is a thirty-second problem that should not cost the
 * session.
 *
 * Deliberately not a second copy of the full intake form. This asks for the
 * name and the three fields the study groups by, and links to the full form for
 * everything else — which can be filled in afterwards, when nobody is waiting.
 */
export function RemoteParticipants({
  activeId,
  onSelect,
}: {
  /** Who the headset says it is recording against right now. */
  activeId: string | null
  /** Tell the headset to record against this participant (null = not recording). */
  onSelect: (studentId: string | null) => void
}) {
  const students = useAuth((s) => s.students)
  const loadStudents = useAuth((s) => s.loadStudents)
  const addStudent = useAuth((s) => s.addStudent)
  const removeStudent = useAuth((s) => s.removeStudent)

  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [dob, setDob] = useState('')
  const [gender, setGender] = useState('')
  const [autismLevel, setAutismLevel] = useState('')

  useEffect(() => {
    void loadStudents().catch(() => {})
  }, [loadStudents])

  function resetForm() {
    setFullName('')
    setDob('')
    setGender('')
    setAutismLevel('')
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault()
    const name = fullName.trim()
    if (!name || busy) return
    const input: StudentInput = {
      full_name: name,
      date_of_birth: dob || null,
      gender: gender || null,
      autism_level: autismLevel || null,
    }
    setBusy(true)
    setError(null)
    try {
      const created = await addStudent(input)
      if (!created) throw new Error('Could not add the participant.')
      resetForm()
      setAdding(false)
      // Whoever was just added is almost certainly the child in the headset.
      onSelect(created.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the participant.')
    } finally {
      setBusy(false)
    }
  }

  async function onRemove(id: string, name: string) {
    if (!window.confirm(`Remove ${name}? Their past records are kept but detached.`)) return
    setError(null)
    try {
      await removeStudent(id)
      // The headset is still recording against someone who no longer exists.
      if (id === activeId) onSelect(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the participant.')
    }
  }

  return (
    <section className="rc-section rc-people">
      <h2>Participant</h2>
      <p className="rc-hint">The session is recorded against whoever is selected here.</p>

      {error && <p className="rc-error">{error}</p>}

      <ul className="rc-people-list">
        <li className={!activeId ? 'rc-person active' : 'rc-person'}>
          <button type="button" className="rc-person-pick" onClick={() => onSelect(null)}>
            <span className="rc-person-name">Not recording</span>
            <span className="rc-person-meta">Play without saving any data</span>
          </button>
        </li>
        {students.map((s) => (
          <li key={s.id} className={activeId === s.id ? 'rc-person active' : 'rc-person'}>
            <button type="button" className="rc-person-pick" onClick={() => onSelect(s.id)}>
              <span className="rc-person-name">{s.full_name}</span>
              <span className="rc-person-meta">{participantMeta(s) || '—'}</span>
            </button>
            <button
              type="button"
              className="rc-person-remove"
              aria-label={`Remove ${s.full_name}`}
              onClick={() => void onRemove(s.id, s.full_name)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {adding ? (
        <form className="rc-add-person" onSubmit={onAdd}>
          <label className="field">
            <span>Full name</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Jamie Chen"
              autoFocus
            />
          </label>
          <label className="field">
            <span>Date of birth</span>
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </label>
          <label className="field">
            <span>Gender</span>
            <select value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">Male / Female / Other</option>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
          </label>
          <label className="field">
            <span>Autism level</span>
            <select value={autismLevel} onChange={(e) => setAutismLevel(e.target.value)}>
              <option value="">Level 1 / Level 2 / Level 3</option>
              <option>Level 1</option>
              <option>Level 2</option>
              <option>Level 3</option>
            </select>
          </label>
          <p className="rc-hint">
            The rest of the intake details can be filled in later — Participants → Edit.
          </p>
          <div className="rc-row">
            <button className="rc-btn go" type="submit" disabled={busy || !fullName.trim()}>
              {busy ? 'Adding…' : 'Add and select'}
            </button>
            <button
              className="rc-btn"
              type="button"
              onClick={() => {
                resetForm()
                setAdding(false)
                setError(null)
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="rc-row rc-wrap">
          <button type="button" className="rc-chip" onClick={() => setAdding(true)}>
            ＋ Add participant
          </button>
          <Link to="/participants" className="rc-chip rc-chip-link">
            Full details →
          </Link>
        </div>
      )}
    </section>
  )
}
