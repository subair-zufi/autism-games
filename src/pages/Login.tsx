import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../state/auth'
import { ProfileIcon } from '../components/icons'

export function Login() {
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: string } }
  const login = useAuth((s) => s.login)
  const status = useAuth((s) => s.status)
  const error = useAuth((s) => s.error)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)

  const busy = status === 'loading'

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const ok = await login(email, password)
    if (ok) navigate(location.state?.from ?? '/', { replace: true })
  }

  return (
    <div className="auth-page">
      <header className="auth-hero">
        <span className="auth-hero-avatar"><ProfileIcon /></span>
        <h1>Welcome back</h1>
        <p>Sign in to continue your sessions</p>
      </header>

      <form className="auth-form" onSubmit={onSubmit}>
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
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <div className="auth-row">
          <label className="checkbox">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Remember me
          </label>
          <button type="button" className="link-accent" onClick={() => { /* static per design */ }}>
            Forgot password?
          </button>
        </div>

        {error && <p className="auth-error">{error}</p>}

        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign In'}
        </button>

        <p className="auth-alt">
          New here? <Link to="/register" className="link-accent">Create an account</Link>
        </p>
        <p className="auth-trouble">
          Having trouble? <span className="link-accent">Contact your administrator</span>
        </p>

        <p className="auth-alt">
          <Link to="/play-offline" className="link-accent">Play Offline</Link>
        </p>
      </form>

      <footer className="auth-footer">SocialSpark VR · HIPAA Compliant</footer>
    </div>
  )
}
