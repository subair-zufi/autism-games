import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../state/auth'
import type { StudentInput } from '../services/analytics'
import { BackIcon, HomeIcon } from '../components/icons'

export function ParticipantForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const students = useAuth((s) => s.students)
  const loadStudents = useAuth((s) => s.loadStudents)
  const addStudent = useAuth((s) => s.addStudent)
  const editStudent = useAuth((s) => s.editStudent)

  const editing = id ? students.find((s) => s.id === id) : undefined

  const [fullName, setFullName] = useState('')
  const [dob, setDob] = useState('')
  const [gender, setGender] = useState('')
  const [parentName, setParentName] = useState('')
  const [parentContact, setParentContact] = useState('')
  const [autismLevel, setAutismLevel] = useState('')
  const [iq, setIq] = useState('')
  const [centre, setCentre] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // When editing directly via URL, make sure the list is loaded, then hydrate.
  useEffect(() => {
    if (id && !editing) void loadStudents().catch(() => {})
  }, [id, editing, loadStudents])
  useEffect(() => {
    if (!editing) return
    setFullName(editing.full_name)
    setDob(editing.date_of_birth ?? '')
    setGender(editing.gender ?? '')
    setParentName(editing.parent_guardian_name ?? '')
    setParentContact(editing.parent_contact ?? '')
    setAutismLevel(editing.autism_level ?? '')
    setIq(editing.iq_score != null ? String(editing.iq_score) : '')
    setCentre(editing.rehabilitation_centre ?? '')
  }, [editing])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const name = fullName.trim()
    if (!name) return
    const input: StudentInput = {
      full_name: name,
      date_of_birth: dob || null,
      gender: gender || null,
      parent_guardian_name: parentName || null,
      parent_contact: parentContact || null,
      autism_level: autismLevel || null,
      iq_score: iq ? Number(iq) : null,
      rehabilitation_centre: centre || null,
    }
    setBusy(true)
    setError(null)
    try {
      if (editing) await editStudent(editing.id, input)
      else await addStudent(input)
      navigate('/participants', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="detail participant-form-page">
      <header className="detail-topbar">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back"><BackIcon /></button>
        <h1>{editing ? 'Edit Participant' : 'New Participant'}</h1>
        <Link to="/" className="icon-btn" aria-label="Home"><HomeIcon /></Link>
      </header>

      <form className="auth-form" onSubmit={onSubmit}>
        <label className="field">
          <span>Full Name</span>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Jamie Chen" required />
        </label>
        <label className="field">
          <span>Date of Birth</span>
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
          <span>Parent / Guardian Name</span>
          <input value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="Full name" />
        </label>
        <label className="field">
          <span>Parent Contact</span>
          <input value={parentContact} onChange={(e) => setParentContact(e.target.value)} placeholder="+1 (555) 000-0000" />
        </label>
        <label className="field">
          <span>Autism Level</span>
          <select value={autismLevel} onChange={(e) => setAutismLevel(e.target.value)}>
            <option value="">Level 1 / Level 2 / Level 3</option>
            <option>Level 1</option>
            <option>Level 2</option>
            <option>Level 3</option>
          </select>
        </label>
        <label className="field">
          <span>IQ Score (optional)</span>
          <input type="number" min={0} max={300} value={iq} onChange={(e) => setIq(e.target.value)} placeholder="e.g. 85" />
        </label>
        <label className="field">
          <span>Rehabilitation Centre</span>
          <input value={centre} onChange={(e) => setCentre(e.target.value)} placeholder="Centre name" />
        </label>

        {error && <p className="auth-error">{error}</p>}

        <button className="btn-primary" type="submit" disabled={busy || !fullName.trim()}>
          {busy ? 'Saving…' : editing ? 'Save Changes' : 'Add Participant'}
        </button>
      </form>
    </div>
  )
}
