import { create } from 'zustand'
import {
  analytics,
  type PlayerUser,
  type ProfileInput,
  type SignupInput,
  type Student,
  type StudentInput,
} from '../services/analytics'

interface AuthState {
  user: PlayerUser | null
  isLoggedIn: boolean
  status: 'idle' | 'loading' | 'error'
  error: string | null
  students: Student[]
  activeStudentId: string | null
  hydrate: () => Promise<void>
  /** Returns whether it succeeded and whether a brand-new account was created
   *  (true) versus an idempotent login of an existing account (false). */
  signup: (input: SignupInput) => Promise<{ ok: boolean; created: boolean }>
  login: (email: string, password: string) => Promise<boolean>
  updateProfile: (input: ProfileInput) => Promise<boolean>
  logout: () => void
  loadStudents: (includeInactive?: boolean) => Promise<void>
  addStudent: (input: StudentInput) => Promise<Student | null>
  editStudent: (
    id: string,
    input: Partial<StudentInput> & { is_active?: boolean },
  ) => Promise<boolean>
  removeStudent: (id: string) => Promise<void>
  switchStudent: (id: string | null) => void
}

export const useAuth = create<AuthState>()((set, get) => ({
  user: null,
  isLoggedIn: analytics.isLoggedIn,
  status: 'idle',
  error: null,
  students: [],
  activeStudentId: analytics.activeStudentId,

  hydrate: async () => {
    if (!analytics.isLoggedIn) return
    const user = await analytics.me()
    set({ user, isLoggedIn: !!user })
    if (user) await get().loadStudents()
  },

  signup: async (input) => {
    set({ status: 'loading', error: null })
    try {
      const res = await analytics.signup(input)
      set({ user: res.user, isLoggedIn: true, status: 'idle' })
      await get().loadStudents()
      return { ok: true, created: res.created }
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : 'Sign-in failed' })
      return { ok: false, created: false }
    }
  },

  login: async (email, password) => {
    set({ status: 'loading', error: null })
    try {
      const res = await analytics.login(email, password)
      set({ user: res.user, isLoggedIn: true, status: 'idle' })
      await get().loadStudents()
      return true
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : 'Login failed' })
      return false
    }
  },

  updateProfile: async (input) => {
    set({ status: 'loading', error: null })
    try {
      const user = await analytics.updateMe(input)
      set({ user, status: 'idle' })
      return true
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : 'Update failed' })
      return false
    }
  },

  logout: () => {
    analytics.logout()
    set({
      user: null,
      isLoggedIn: false,
      status: 'idle',
      error: null,
      students: [],
      activeStudentId: null,
    })
  },

  loadStudents: async (includeInactive = false) => {
    const students = await analytics.listStudents(includeInactive)
    set({ students, activeStudentId: analytics.activeStudentId })
  },

  addStudent: async (input) => {
    const student = await analytics.createStudent(input)
    set((s) => ({ students: [...s.students, student] }))
    get().switchStudent(student.id)
    return student
  },

  editStudent: async (id, input) => {
    const updated = await analytics.updateStudent(id, input)
    set((s) => ({ students: s.students.map((st) => (st.id === id ? updated : st)) }))
    // A deactivated student that the picker no longer shows should not stay active.
    if (updated.is_active === false && analytics.activeStudentId === id) {
      analytics.setActiveStudent(null)
      set({ activeStudentId: null })
    }
    return true
  },

  removeStudent: async (id) => {
    await analytics.deleteStudent(id)
    set((s) => ({
      students: s.students.filter((st) => st.id !== id),
      activeStudentId: analytics.activeStudentId,
    }))
  },

  switchStudent: (id) => {
    analytics.setActiveStudent(id)
    set({ activeStudentId: id })
  },
}))
