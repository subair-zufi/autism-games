import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../state/auth'
import { ProfileIcon } from '../components/icons'

export function Register() {
  const navigate = useNavigate()
  const signup = useAuth((s) => s.signup)
  const status = useAuth((s) => s.status)
  const error = useAuth((s) => s.error)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const busy = status === 'loading'

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const { ok, created } = await signup({
      email,
      password,
      full_name: fullName || undefined,
    })
    if (!ok) return
    // Brand-new accounts complete their profile; returning accounts go home.
    navigate(created ? '/complete-profile' : '/', { replace: true })
  }

  return (
    <div className="auth-page">
      <header className="auth-hero">
        <span className="auth-hero-avatar"><ProfileIcon /></span>
        <h1>Create account</h1>
        <p>Set up your mentor account to get started</p>
      </header>

      <form className="auth-form" onSubmit={onSubmit}>
        <label className="field">
          <span>Full Name</span>
          <input
            type="text"
            autoComplete="name"
            placeholder="Dr. Sarah Mitchell"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </label>

        <label className="field">
          <span>Email Address</span>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.org"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && <p className="auth-error">{error}</p>}

        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>

        <p className="auth-alt">
          Already have an account? <Link to="/login" className="link-accent">Sign in</Link>
        </p>
      </form>

      <footer className="auth-footer">SocialSpark VR · HIPAA Compliant</footer>
    </div>
  )
}
