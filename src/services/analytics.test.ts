import { describe, it, expect, vi, beforeEach } from 'vitest'
import { analytics } from './analytics'

/** Build a minimal fetch Response stand-in. */
function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

const fetchMock = vi.fn()

const sampleStudent = {
  id: 'stu-1',
  mentor_id: 'mentor-1',
  full_name: 'Ada',
  date_of_birth: null,
  notes: null,
  avatar: null,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
}

/** Log the singleton in so token-guarded calls go through. */
async function login() {
  fetchMock.mockResolvedValueOnce(
    jsonResponse({ access_token: 'test-token', token_type: 'bearer', created: false, user: {} }),
  )
  await analytics.login('a@b.com', 'secret123')
}

function lastCall() {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
  return { url, init, body: init.body ? JSON.parse(init.body as string) : undefined }
}

describe('AnalyticsClient student support', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
    analytics.logout() // reset in-memory token + active student
  })

  it('tracks and persists the active student to localStorage', () => {
    analytics.setActiveStudent('stu-1')
    expect(analytics.activeStudentId).toBe('stu-1')
    expect(localStorage.getItem('ag_active_student')).toBe('stu-1')

    analytics.setActiveStudent(null)
    expect(analytics.activeStudentId).toBeNull()
    expect(localStorage.getItem('ag_active_student')).toBeNull()
  })

  it('logout clears the active student', () => {
    analytics.setActiveStudent('stu-1')
    analytics.logout()
    expect(analytics.activeStudentId).toBeNull()
    expect(localStorage.getItem('ag_active_student')).toBeNull()
  })

  it('listStudents is a no-op returning [] when logged out', async () => {
    expect(await analytics.listStudents()).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('listStudents hits the scoped endpoint with the auth header', async () => {
    await login()
    fetchMock.mockResolvedValueOnce(jsonResponse([sampleStudent]))

    const res = await analytics.listStudents(true)

    expect(res).toEqual([sampleStudent])
    const { url, init } = lastCall()
    expect(url).toBe('/api/students?include_inactive=true')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token')
  })

  it('createStudent POSTs the input', async () => {
    await login()
    fetchMock.mockResolvedValueOnce(jsonResponse(sampleStudent))

    const res = await analytics.createStudent({ full_name: 'Ada' })

    expect(res).toEqual(sampleStudent)
    const { url, init, body } = lastCall()
    expect(url).toBe('/api/students')
    expect(init.method).toBe('POST')
    expect(body).toEqual({ full_name: 'Ada' })
  })

  it('updateStudent PATCHes partial fields', async () => {
    await login()
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...sampleStudent, is_active: false }))

    await analytics.updateStudent('stu-1', { is_active: false })

    const { url, init, body } = lastCall()
    expect(url).toBe('/api/students/stu-1')
    expect(init.method).toBe('PATCH')
    expect(body).toEqual({ is_active: false })
  })

  it('deleteStudent resets the active student when it was the deleted one', async () => {
    await login()
    analytics.setActiveStudent('stu-1')
    fetchMock.mockResolvedValueOnce(jsonResponse(null, 204))

    await analytics.deleteStudent('stu-1')

    const { url, init } = lastCall()
    expect(url).toBe('/api/students/stu-1')
    expect(init.method).toBe('DELETE')
    expect(analytics.activeStudentId).toBeNull()
  })

  it('deleteStudent leaves a different active student untouched', async () => {
    await login()
    analytics.setActiveStudent('stu-2')
    fetchMock.mockResolvedValueOnce(jsonResponse(null, 204))

    await analytics.deleteStudent('stu-1')

    expect(analytics.activeStudentId).toBe('stu-2')
  })

  it('startSession attaches the active student_id', async () => {
    await login()
    analytics.setActiveStudent('stu-1')
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'sess-1' }))

    const id = await analytics.startSession('emotions')

    expect(id).toBe('sess-1')
    const { body } = lastCall()
    expect(body).toMatchObject({ game_key: 'emotions', student_id: 'stu-1' })
  })

  it('recordStep attaches the active student_id', async () => {
    await login()
    analytics.setActiveStudent('stu-1')
    fetchMock.mockResolvedValueOnce(jsonResponse(null, 201))

    await analytics.recordStep('emotions', 'answer', { correct: true }, { sessionId: 'sess-1' })

    const { body } = lastCall()
    expect(body).toMatchObject({ game_key: 'emotions', student_id: 'stu-1', session_id: 'sess-1' })
  })

  it('sends student_id: null when no student is active', async () => {
    await login()
    analytics.setActiveStudent(null)
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'sess-2' }))

    await analytics.startSession('blocks')

    const { body } = lastCall()
    expect(body.student_id).toBeNull()
  })

  it('does not touch the API for guests/logged-out users', async () => {
    // logged out from beforeEach
    expect(await analytics.startSession('emotions')).toBeNull()
    await analytics.recordStep('emotions', 'answer')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
