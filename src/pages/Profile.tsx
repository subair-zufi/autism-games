import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/auth'
import { useSettings } from '../state/settings'
import { initials } from '../lib/participant'

export function Profile() {
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)
  const updateProfile = useAuth((s) => s.updateProfile)
  const logout = useAuth((s) => s.logout)
  const status = useAuth((s) => s.status)

  const voiceOn = useSettings((s) => s.voiceOn)
  const soundOn = useSettings((s) => s.soundOn)
  const language = useSettings((s) => s.language)
  const inputMethod = useSettings((s) => s.inputMethod)
  const setVoiceOn = useSettings((s) => s.setVoiceOn)
  const setSoundOn = useSettings((s) => s.setSoundOn)
  const setLanguage = useSettings((s) => s.setLanguage)
  const setInputMethod = useSettings((s) => s.setInputMethod)

  const [editing, setEditing] = useState(false)
  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [designation, setDesignation] = useState(user?.designation ?? '')
  const [organisation, setOrganisation] = useState(user?.organisation ?? '')
  const [mobile, setMobile] = useState(user?.mobile_number ?? '')

  const busy = status === 'loading'

  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    const ok = await updateProfile({
      full_name: fullName || null,
      designation: designation || null,
      organisation: organisation || null,
      mobile_number: mobile || null,
    })
    if (ok) setEditing(false)
  }

  function onLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="page profile">
      <header className="page-head"><h1>Profile</h1></header>

      <div className="profile-card">
        <span className="profile-avatar">{initials(user?.full_name || user?.email || '?')}</span>
        <div className="profile-id">
          <span className="profile-name">{user?.full_name || 'Your name'}</span>
          {user?.designation && <span className="profile-role">{user.designation}</span>}
          {user?.organisation && <span className="profile-org">{user.organisation}</span>}
        </div>
      </div>

      {editing ? (
        <form className="auth-form" onSubmit={onSave}>
          <label className="field"><span>Full Name</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} /></label>
          <label className="field"><span>Designation</span>
            <input value={designation} onChange={(e) => setDesignation(e.target.value)} /></label>
          <label className="field"><span>Organisation / Centre</span>
            <input value={organisation} onChange={(e) => setOrganisation(e.target.value)} /></label>
          <label className="field"><span>Mobile Number</span>
            <input value={mobile} onChange={(e) => setMobile(e.target.value)} /></label>
          <label className="field"><span>Email Address</span>
            <input value={user?.email ?? ''} readOnly disabled /></label>
          <button className="btn-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          <button className="btn-ghost" type="button" onClick={() => setEditing(false)}>Cancel</button>
        </form>
      ) : (
        <>
          <dl className="profile-details">
            <div><dt>Mobile</dt><dd>{user?.mobile_number || '—'}</dd></div>
            <div><dt>Email</dt><dd>{user?.email || '—'}</dd></div>
          </dl>
          <button className="btn-outline" onClick={() => setEditing(true)}>Edit Profile</button>
        </>
      )}

      <section className="panel">
        <h2>Settings</h2>

        <div className="settings-row">
          <div className="settings-label">
            <span className="settings-label-title">Language · ഭാഷ</span>
            <span className="settings-label-sub">Game prompts and voice use this language</span>
          </div>
          <div className="settings-toggles">
            <button
              className={language === 'en' ? 'toggle-pill on' : 'toggle-pill'}
              onClick={() => setLanguage('en')}
            >
              English
            </button>
            <button
              className={language === 'ml' ? 'toggle-pill on' : 'toggle-pill'}
              onClick={() => setLanguage('ml')}
            >
              മലയാളം
            </button>
          </div>
        </div>

        <div className="settings-row">
          <div className="settings-label">
            <span className="settings-label-title">Selection · VR games</span>
            <span className="settings-label-sub">
              {inputMethod === 'dwell'
                ? 'Look at the answer and hold your gaze on it'
                : 'Point the controller at the answer and press the trigger'}
            </span>
          </div>
          <div className="settings-toggles">
            <button
              className={inputMethod === 'dwell' ? 'toggle-pill on' : 'toggle-pill'}
              onClick={() => setInputMethod('dwell')}
            >
              👀 Gaze dwell
            </button>
            <button
              className={inputMethod === 'controller' ? 'toggle-pill on' : 'toggle-pill'}
              onClick={() => setInputMethod('controller')}
            >
              🎮 Controller
            </button>
          </div>
        </div>
        <p className="settings-note">
          You can also switch inside the headset — the two buttons under the in-world Quit
          control. Gaze dwell needs nothing held, which is the point; the controller stays
          available in both modes, so choosing Controller only turns gaze selection{' '}
          <em>off</em> — useful when an adult is driving the session and should not answer just
          by looking around.
        </p>

        <div className="settings-toggles">
          <button className={voiceOn ? 'toggle-pill on' : 'toggle-pill'} onClick={() => setVoiceOn(!voiceOn)}>
            🔊 Voice {voiceOn ? 'On' : 'Off'}
          </button>
          <button className={soundOn ? 'toggle-pill on' : 'toggle-pill'} onClick={() => setSoundOn(!soundOn)}>
            🎵 Sounds {soundOn ? 'On' : 'Off'}
          </button>
        </div>
      </section>

      <button className="btn-danger" onClick={onLogout}>Log out</button>

      {/* Check this against the build you deployed before reporting that a fix
          did not take — the offline cache can otherwise serve an older app. */}
      <p className="build-stamp">Build {__BUILD_STAMP__}</p>
    </div>
  )
}
