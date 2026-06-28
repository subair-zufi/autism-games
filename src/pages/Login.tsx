import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/auth'

export function Login() {
  const navigate = useNavigate()
  const signup = useAuth((s) => s.signup)
  const login = useAuth((s) => s.login)
  const status = useAuth((s) => s.status)
  const error = useAuth((s) => s.error)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [city, setCity] = useState('')
  const [education, setEducation] = useState('')
  // After a 409 we offer an explicit "log in instead" action.
  const [showLogin, setShowLogin] = useState(false)

  async function onContinue(e: React.FormEvent) {
    e.preventDefault()
    const ok = await signup({
      email,
      password,
      full_name: fullName || undefined,
      city: city || undefined,
      education_level: education || undefined,
    })
    if (ok) navigate('/')
    else setShowLogin(true)
  }

  async function onLogin() {
    const ok = await login(email, password)
    if (ok) navigate('/')
  }

  const busy = status === 'loading'

  return (
    <div className="login-page">
      <button className="back-btn" onClick={() => navigate('/')}>← Back</button>
      <h1>Sign in</h1>
      <p className="login-sub">Signing in saves your progress. It's optional — you can play without it.</p>
      <form className="login-form" onSubmit={onContinue}>
        <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <label>Name (optional)<input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} /></label>
        <label>City (optional)<input type="text" value={city} onChange={(e) => setCity(e.target.value)} /></label>
        <label>Education (optional)<input type="text" value={education} onChange={(e) => setEducation(e.target.value)} /></label>
        {error && <p className="login-error">{error}</p>}
        <button className="login-submit" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : 'Continue'}
        </button>
        {showLogin && (
          <button className="login-alt" type="button" disabled={busy} onClick={onLogin}>
            Log in instead (this email already exists)
          </button>
        )}
      </form>
    </div>
  )
}
