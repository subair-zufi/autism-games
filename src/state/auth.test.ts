import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../services/analytics', () => {
  const user = { id: '1', email: 'a@b.com', full_name: 'Kid', city: null, education_level: null }
  return {
    analytics: {
      isLoggedIn: false,
      signup: vi.fn(async () => ({ access_token: 't', token_type: 'bearer', created: true, user })),
      login: vi.fn(async () => ({ access_token: 't', token_type: 'bearer', created: false, user })),
      me: vi.fn(async () => null),
      logout: vi.fn(),
    },
  }
})

import { useAuth } from './auth'
import { analytics } from '../services/analytics'

describe('useAuth', () => {
  beforeEach(() => {
    useAuth.setState({ user: null, isLoggedIn: false, status: 'idle', error: null })
    vi.clearAllMocks()
  })

  it('signup sets the user and logged-in state', async () => {
    const ok = await useAuth.getState().signup({ email: 'a@b.com', password: 'secret123' })
    expect(ok).toBe(true)
    expect(useAuth.getState().isLoggedIn).toBe(true)
    expect(useAuth.getState().user?.email).toBe('a@b.com')
  })

  it('signup surfaces an error and returns false on failure', async () => {
    ;(analytics.signup as any).mockRejectedValueOnce(new Error('That email already exists'))
    const ok = await useAuth.getState().signup({ email: 'a@b.com', password: 'wrong' })
    expect(ok).toBe(false)
    expect(useAuth.getState().isLoggedIn).toBe(false)
    expect(useAuth.getState().error).toMatch(/already exists/)
  })

  it('logout clears the user', () => {
    useAuth.setState({ user: { id: '1', email: 'a@b.com' } as any, isLoggedIn: true })
    useAuth.getState().logout()
    expect(analytics.logout).toHaveBeenCalled()
    expect(useAuth.getState().isLoggedIn).toBe(false)
  })
})
