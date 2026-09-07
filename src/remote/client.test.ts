import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The analytics client reads the mentor token at construction, so it has to be
// there before this module tree is imported.
localStorage.setItem('ag_player_token', 'test-token')

const { RemoteError, relayBase, remoteApi, setRelayBase } = await import('./client')

let fetchMock: ReturnType<typeof vi.fn>

function respond(status: number, body: unknown = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

beforeEach(() => {
  setRelayBase(null)
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  setRelayBase(null)
})

describe('talking to the relay', () => {
  it('sends the mentor token, so a stranger cannot drive a headset', async () => {
    fetchMock.mockResolvedValue(respond(201, { code: 'PQ4RTX', expires_in: 3600 }))
    await remoteApi.openRoom()
    const [, init] = fetchMock.mock.calls[0]
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token')
  })

  it('uses the relay the device was pointed at — a laptop on the room’s Wi-Fi', async () => {
    setRelayBase('http://192.168.1.20:8000/')
    expect(relayBase()).toBe('http://192.168.1.20:8000')
    fetchMock.mockResolvedValue(respond(200, {}))
    await remoteApi.join('pq4rtx')
    expect(fetchMock.mock.calls[0][0]).toBe('http://192.168.1.20:8000/api/remote/rooms/PQ4RTX/join')
  })

  it('normalises the code the trainer typed', async () => {
    fetchMock.mockResolvedValue(respond(200, {}))
    await remoteApi.join(' pq4rtx ')
    expect(fetchMock.mock.calls[0][0]).toContain('/rooms/PQ4RTX/join')
  })
})

describe('when things go wrong', () => {
  it('marks a dead pairing as gone, which is what unpairs both ends', async () => {
    fetchMock.mockResolvedValue(respond(404, { detail: 'No live pairing with that code.' }))
    await expect(remoteApi.join('ZZZZZZ')).rejects.toSatisfy(
      (err: unknown) => err instanceof RemoteError && err.isGone,
    )
  })

  it('reports an unreachable relay rather than throwing a raw network error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(remoteApi.openRoom()).rejects.toMatchObject({ status: 0 })
  })

  it('gives up on a poll the server never answers', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const err = new Error('aborted')
            err.name = 'AbortError'
            reject(err)
          })
        }),
    )

    const poll = remoteApi.pullCommands('PQ4RTX', 0, 20)
    const settled = expect(poll).rejects.toMatchObject({ status: 0 })
    await vi.advanceTimersByTimeAsync(20_000 + 15_000)
    await settled
  })

  it('lets the caller’s own cancellation through untouched', async () => {
    const abort = new AbortController()
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const err = new Error('aborted')
            err.name = 'AbortError'
            reject(err)
          })
        }),
    )

    const poll = remoteApi.pullCommands('PQ4RTX', 0, 20, abort.signal)
    abort.abort()
    await expect(poll).rejects.toMatchObject({ name: 'AbortError' })
  })
})
