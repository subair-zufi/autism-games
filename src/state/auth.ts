import { create } from 'zustand'
import { analytics, type PlayerUser, type SignupInput } from '../services/analytics'

interface AuthState {
  user: PlayerUser | null
  isLoggedIn: boolean
  status: 'idle' | 'loading' | 'error'
  error: string | null
  hydrate: () => Promise<void>
  signup: (input: SignupInput) => Promise<boolean>
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
}

export const useAuth = create<AuthState>()((set) => ({
  user: null,
  isLoggedIn: analytics.isLoggedIn,
  status: 'idle',
  error: null,

  hydrate: async () => {
    if (!analytics.isLoggedIn) return
    const user = await analytics.me()
    set({ user, isLoggedIn: !!user })
  },

  signup: async (input) => {
    set({ status: 'loading', error: null })
    try {
      const res = await analytics.signup(input)
      set({ user: res.user, isLoggedIn: true, status: 'idle' })
      return true
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : 'Sign-in failed' })
      return false
    }
  },

  login: async (email, password) => {
    set({ status: 'loading', error: null })
    try {
      const res = await analytics.login(email, password)
      set({ user: res.user, isLoggedIn: true, status: 'idle' })
      return true
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : 'Login failed' })
      return false
    }
  },

  logout: () => {
    analytics.logout()
    set({ user: null, isLoggedIn: false, status: 'idle', error: null })
  },
}))
