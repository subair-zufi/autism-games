import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/auth'
import { useSettings } from '../state/settings'
import { initials } from '../lib/participant'
import { RemoteControlCard } from '../components/RemoteControlCard'
import type { DwellProfile } from '../types'

/** Label and one-line meaning for each steadiness setting (types.ts
 *  `DwellProfile`; the numbers are in games/headAim.ts `DWELL_PROFILES`). */
const DWELL_PROFILE_PILLS: ReadonlyArray<[DwellProfile, string]> = [
  ['standard', '🎯 Standard'],
  ['extended', '🫱 Extended'],
  ['high-support', '🤝 High support'],
]

const DWELL_PROFILE_SUB: Record<DwellProfile, string> = {
  standard: 'Hold the ✓ for about 1.6 seconds — for a child who can keep their head still',
  extended: 'Shorter hold, wider ✓, more forgiving of a wobble',
  'high-support': 'Shortest hold and the widest ✓ — for a child whose head will not hold still',
}

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
  const dwellProfile = useSettings((s) => s.dwellProfile)
  const setVoiceOn = useSettings((s) => s.setVoiceOn)
  const setSoundOn = useSettings((s) => s.setSoundOn)
  const setLanguage = useSettings((s) => s.setLanguage)
  const setInputMethod = useSettings((s) => s.setInputMethod)
  const setDwellProfile = useSettings((s) => s.setDwellProfile)

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
                ? 'Look at the answer, then hold on the ✓ that appears on it'
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
          control. Gaze dwell needs nothing held, and takes two steps on purpose: resting on
          something marks it and floats a ✓ on it, and only holding on that ✓ answers, so
          a child can study every face without picking one by accident. The controller stays
          available in both modes, so choosing Controller only turns gaze selection{' '}
          <em>off</em> — useful when an adult is driving the session and should not answer just
          by looking around.
        </p>

        {inputMethod === 'dwell' && (
          <>
            <div className="settings-row">
              <div className="settings-label">
                <span className="settings-label-title">Steadiness support · gaze</span>
                <span className="settings-label-sub">{DWELL_PROFILE_SUB[dwellProfile]}</span>
              </div>
              <div className="settings-toggles">
                {DWELL_PROFILE_PILLS.map(([id, label]) => (
                  <button
                    key={id}
                    className={dwellProfile === id ? 'toggle-pill on' : 'toggle-pill'}
                    onClick={() => setDwellProfile(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <p className="settings-note">
              Set this from how steadily the child can hold a look, not from how well they play.
              A child who finds the right answer but cannot keep their head still long enough to
              confirm it scores the same as one who never found it — move them up a step and
              watch whether they start answering. Every recorded trial carries the setting it was
              played at, so it can be controlled for in the analysis; response time cannot be
              compared across settings without it, because the hold itself is part of the time.
            </p>
          </>
        )}

        <div className="settings-toggles">
          <button className={voiceOn ? 'toggle-pill on' : 'toggle-pill'} onClick={() => setVoiceOn(!voiceOn)}>
            🔊 Voice {voiceOn ? 'On' : 'Off'}
          </button>
          <button className={soundOn ? 'toggle-pill on' : 'toggle-pill'} onClick={() => setSoundOn(!soundOn)}>
            🎵 Sounds {soundOn ? 'On' : 'Off'}
          </button>
        </div>
      </section>

      <RemoteControlCard />

      <button className="btn-danger" onClick={onLogout}>Log out</button>

      {/* Check this against the build you deployed before reporting that a fix
          did not take — the offline cache can otherwise serve an older app. */}
      <p className="build-stamp">Build {__BUILD_STAMP__}</p>
    </div>
  )
}
