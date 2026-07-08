import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../services/analytics', () => {
  const user = { id: '1', email: 'a@b.com', full_name: 'Kid', city: null, education_level: null }
  const mkStudent = (id: string, full_name: string, is_active = true) => ({
    id, mentor_id: 'm', full_name, date_of_birth: null, notes: null, avatar: null, is_active, created_at: 'now',
  })
  let active: string | null = null
  return {
    analytics: {
      isLoggedIn: false,
      get activeStudentId() { return active },
      setActiveStudent: vi.fn((id: string | null) => { active = id }),
      listStudents: vi.fn(async () => [mkStudent('s1', 'Ada'), mkStudent('s2', 'Bea')]),
      createStudent: vi.fn(async (input: { full_name: string }) => mkStudent('s3', input.full_name)),
      updateStudent: vi.fn(async (id: string, patch: { is_active?: boolean }) =>
        mkStudent(id, 'Ada', patch.is_active ?? true)),
      deleteStudent: vi.fn(async () => { active = null }),
      signup: vi.fn(async () => ({ access_token: 't', token_type: 'bearer', created: true, user })),
      login: vi.fn(async () => ({ access_token: 't', token_type: 'bearer', created: false, user })),
      me: vi.fn(async () => null),
      logout: vi.fn(() => { active = null }),
    },
  }
})

import { useAuth } from './auth'
import { analytics } from '../services/analytics'

describe('useAuth', () => {
  beforeEach(() => {
    useAuth.setState({ user: null, isLoggedIn: false, status: 'idle', error: null, students: [], activeStudentId: null })
    analytics.setActiveStudent(null)
    vi.clearAllMocks()
  })

  it('signup sets the user and logged-in state', async () => {
    const res = await useAuth.getState().signup({ email: 'a@b.com', password: 'secret123' })
    expect(res).toEqual({ ok: true, created: true })
    expect(useAuth.getState().isLoggedIn).toBe(true)
    expect(useAuth.getState().user?.email).toBe('a@b.com')
  })

  it('signup surfaces an error and returns not-ok on failure', async () => {
    ;(analytics.signup as any).mockRejectedValueOnce(new Error('That email already exists'))
    const res = await useAuth.getState().signup({ email: 'a@b.com', password: 'wrong' })
    expect(res.ok).toBe(false)
    expect(useAuth.getState().isLoggedIn).toBe(false)
    expect(useAuth.getState().error).toMatch(/already exists/)
  })

  it('logout clears the user and students', () => {
    useAuth.setState({
      user: { id: '1', email: 'a@b.com' } as any,
      isLoggedIn: true,
      students: [{ id: 's1' } as any],
      activeStudentId: 's1',
    })
    useAuth.getState().logout()
    expect(analytics.logout).toHaveBeenCalled()
    expect(useAuth.getState().isLoggedIn).toBe(false)
    expect(useAuth.getState().students).toEqual([])
    expect(useAuth.getState().activeStudentId).toBeNull()
  })

  it('login loads the mentor students', async () => {
    await useAuth.getState().login('a@b.com', 'secret123')
    expect(analytics.listStudents).toHaveBeenCalled()
    expect(useAuth.getState().students.map((s) => s.full_name)).toEqual(['Ada', 'Bea'])
  })

  it('loadStudents populates the list', async () => {
    await useAuth.getState().loadStudents()
    expect(useAuth.getState().students).toHaveLength(2)
  })

  it('addStudent appends the created student', async () => {
    await useAuth.getState().loadStudents()
    const created = await useAuth.getState().addStudent({ full_name: 'Cy' })
    expect(created?.full_name).toBe('Cy')
    expect(useAuth.getState().students.map((s) => s.full_name)).toContain('Cy')
  })

  it('switchStudent updates state and the client', () => {
    useAuth.getState().switchStudent('s2')
    expect(analytics.setActiveStudent).toHaveBeenCalledWith('s2')
    expect(useAuth.getState().activeStudentId).toBe('s2')
  })

  it('editStudent deactivating the active student clears it', async () => {
    useAuth.setState({ students: [{ id: 's1', full_name: 'Ada', is_active: true } as any] })
    useAuth.getState().switchStudent('s1')
    await useAuth.getState().editStudent('s1', { is_active: false })
    expect(useAuth.getState().activeStudentId).toBeNull()
    expect(useAuth.getState().students.find((s) => s.id === 's1')?.is_active).toBe(false)
  })

  it('removeStudent drops the student from the list', async () => {
    await useAuth.getState().loadStudents()
    await useAuth.getState().removeStudent('s1')
    expect(useAuth.getState().students.map((s) => s.id)).not.toContain('s1')
  })
})
