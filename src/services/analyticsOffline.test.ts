import { describe, it, expect, vi, beforeEach } from 'vitest'
import { analytics } from './analytics'
import { clearQueue, pending, pendingCount, resetFlushState } from './writeQueue'

/**
 * What happens to a session played through a Wi-Fi outage.
 *
 * This is the case the BUDS sites will actually produce, and the one that used
 * to cost the study its trial data: every analytics call swallowed its failure
 * and the steps were gone.
 */

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response
}

const fetchMock = vi.fn()

async function login() {
  fetchMock.mockResolvedValueOnce(
    jsonResponse({ access_token: 'test-token', token_type: 'bearer', created: false, user: {} }),
  )
  await analytics.login('a@b.com', 'secret123')
}

/** Bodies POSTed to a path, oldest first. */
function posted(path: string) {
  return fetchMock.mock.calls
    .filter(([url]) => String(url).endsWith(path))
    .map(([, init]) => JSON.parse((init as RequestInit).body as string))
}

describe('telemetry with no network', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
    localStorage.clear()
    clearQueue()
    resetFlushState()
  })

  it('keeps a whole session of steps and replays them when the network returns', async () => {
    await login()
    analytics.setActiveStudent('stu-1')

    // The connection drops for the whole session.
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const sessionId = (await analytics.startSession('museum360'))!
    expect(sessionId).toBeTruthy()
    for (let i = 0; i < 5; i += 1) {
      await analytics.recordStep('museum360', 'answer', { correct: true }, { sessionId, stepIndex: i })
    }
    await analytics.endSession(sessionId, 5)

    // Nothing lost: the session, five steps and the end are all still held.
    expect(pendingCount()).toBe(7)

    // Wi-Fi comes back.
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(jsonResponse({}, 201))
    const sent = await analytics.flushPendingWrites()

    expect(sent).toBe(7)
    expect(pendingCount()).toBe(0)
    expect(posted('/api/events')).toHaveLength(5)
  })

  it('replays the session before the steps that name it', async () => {
    await login()
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const sessionId = (await analytics.startSession('park360'))!
    await analytics.recordStep('park360', 'answer', {}, { sessionId })

    fetchMock.mockReset()
    fetchMock.mockResolvedValue(jsonResponse({}, 201))
    await analytics.flushPendingWrites()

    // Order matters: an event naming a session the server has not seen is
    // rejected, so the opening write has to land first.
    const urls = fetchMock.mock.calls.map(([u]) => String(u))
    expect(urls.indexOf('/api/sessions')).toBeLessThan(urls.indexOf('/api/events'))
    expect(posted('/api/sessions')[0].id).toBe(sessionId)
  })

  it('keeps the steps in the order they were played', async () => {
    await login()
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const sessionId = (await analytics.startSession('football360'))!
    for (const i of [0, 1, 2]) {
      await analytics.recordStep('football360', 'answer', {}, { sessionId, stepIndex: i })
    }

    fetchMock.mockReset()
    fetchMock.mockResolvedValue(jsonResponse({}, 201))
    await analytics.flushPendingWrites()

    expect(posted('/api/events').map((b) => b.step_index)).toEqual([0, 1, 2])
  })

  it('gives every step its own queue entry, so none overwrites another', async () => {
    await login()
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const sessionId = (await analytics.startSession('museum360'))!
    await analytics.recordStep('museum360', 'answer', {}, { sessionId, stepIndex: 0 })
    await analytics.recordStep('museum360', 'answer', {}, { sessionId, stepIndex: 0 })

    // Same game, same step index — still two distinct records.
    expect(pending().filter((e) => e.path === '/api/events')).toHaveLength(2)
  })

  it('drops a step the server refuses for good rather than blocking the queue', async () => {
    await login()
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const sessionId = (await analytics.startSession('museum360'))!
    await analytics.recordStep('museum360', 'answer', {}, { sessionId })
    await analytics.recordStep('museum360', 'answer', {}, { sessionId })

    fetchMock.mockReset()
    // The session is refused (404 — say it overflowed away), then the steps.
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ detail: 'Session not found.' }, 404))
      .mockResolvedValueOnce(jsonResponse({ detail: 'Session not found.' }, 404))
      .mockResolvedValueOnce(jsonResponse({ detail: 'Session not found.' }, 404))

    await analytics.flushPendingWrites()

    // All three are gone rather than one wedging everything behind it.
    expect(pendingCount()).toBe(0)
  })

  it('holds everything when the trainer is signed out, rather than dropping it', async () => {
    await login()
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const sessionId = (await analytics.startSession('museum360'))!
    await analytics.recordStep('museum360', 'answer', {}, { sessionId })

    fetchMock.mockReset()
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'Unauthorized' }, 401))
    await analytics.flushPendingWrites()

    // A 401 is fixable by signing back in; the data has to survive until then.
    expect(pendingCount()).toBe(2)
  })

  it('does not queue anything at all when nobody is logged in', async () => {
    analytics.logout()
    const id = await analytics.startSession('museum360')
    await analytics.recordStep('museum360', 'answer', {})

    expect(id).toBeNull()
    expect(pendingCount()).toBe(0)
  })
})
