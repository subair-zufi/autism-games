import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/auth'

export function CompleteProfile() {
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)
  const updateProfile = useAuth((s) => s.updateProfile)
  const status = useAuth((s) => s.status)
  const error = useAuth((s) => s.error)

  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [designation, setDesignation] = useState(user?.designation ?? '')
  const [organisation, setOrganisation] = useState(user?.organisation ?? '')
  const [mobile, setMobile] = useState(user?.mobile_number ?? '')
  // Hydrate any fields still blank once `user` loads (e.g. reload on this page),
  // so an existing value isn't wiped by an empty submit.
  const [touched, setTouched] = useState(false)
  useEffect(() => {
    if (!user || touched) return
    setFullName((v) => v || user.full_name || '')
    setDesignation((v) => v || user.designation || '')
    setOrganisation((v) => v || user.organisation || '')
    setMobile((v) => v || user.mobile_number || '')
  }, [user, touched])

  const busy = status === 'loading'

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const ok = await updateProfile({
      full_name: fullName || null,
      designation: designation || null,
      organisation: organisation || null,
      mobile_number: mobile || null,
    })
    if (ok) navigate('/', { replace: true })
  }

  return (
    <div className="profile-setup">
      <header className="profile-hero">
        <h1>Complete Your Profile</h1>
        <p>Help us personalise your experience</p>
        <div className="profile-hero-avatar" aria-hidden>
          {(fullName || user?.email || '?').charAt(0).toUpperCase()}
        </div>
      </header>

      <form className="auth-form" onSubmit={onSubmit}>
        <label className="field">
          <span>Full Name</span>
          <input value={fullName} onChange={(e) => { setTouched(true); setFullName(e.target.value) }} placeholder="Dr. Sarah Mitchell" />
        </label>
        <label className="field">
          <span>Designation</span>
          <input value={designation} onChange={(e) => { setTouched(true); setDesignation(e.target.value) }} placeholder="Clinical Psychologist" />
        </label>
        <label className="field">
          <span>Organisation / Centre</span>
          <input value={organisation} onChange={(e) => { setTouched(true); setOrganisation(e.target.value) }} placeholder="Sunrise Therapy Center" />
        </label>
        <label className="field">
          <span>Mobile Number</span>
          <input value={mobile} onChange={(e) => { setTouched(true); setMobile(e.target.value) }} placeholder="+1 (555) 000-0000" />
        </label>
        <label className="field">
          <span>Email Address</span>
          <input value={user?.email ?? ''} readOnly disabled />
        </label>

        {error && <p className="auth-error">{error}</p>}

        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save & Continue'}
        </button>
        <button type="button" className="btn-ghost" onClick={() => navigate('/', { replace: true })}>
          Skip for now
        </button>
      </form>
    </div>
  )
}
