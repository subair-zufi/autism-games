import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAuth } from './state/auth'
import { useOffline } from './state/offline'

// Re-declare the gate's behaviour via the real component by rendering App's
// route tree is heavy; instead import the exported RequireAuth.
import { RequireAuth } from './App'

function Protected() {
  return <div>secret</div>
}

describe('RequireAuth with offline mode', () => {
  beforeEach(() => {
    useAuth.setState({ isLoggedIn: false })
    useOffline.setState({ offlineMode: false })
  })

  it('redirects to /login when neither logged in nor offline', () => {
    render(
      <MemoryRouter initialEntries={['/secret']}>
        <Routes>
          <Route path="/login" element={<div>login page</div>} />
          <Route path="/secret" element={<RequireAuth><Protected /></RequireAuth>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('login page')).toBeInTheDocument()
  })

  it('renders children when offlineMode is on', () => {
    useOffline.setState({ offlineMode: true })
    render(
      <MemoryRouter initialEntries={['/secret']}>
        <Routes>
          <Route path="/login" element={<div>login page</div>} />
          <Route path="/secret" element={<RequireAuth><Protected /></RequireAuth>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('secret')).toBeInTheDocument()
  })
})
