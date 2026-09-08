import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RemoteError } from '../remote/client'
import { isMirrorWanted, resetMirror, setMirrorWanted } from '../remote/mirror'

const api = vi.hoisted(() => ({
  openRoom: vi.fn(),
  join: vi.fn(),
  close: vi.fn(),
}))

vi.mock('../remote/client', async () => {
  const actual = await vi.importActual<typeof import('../remote/client')>('../remote/client')
  return { ...actual, remoteApi: api }
})

const { useRemoteLink } = await import('./remote')

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  resetMirror()
  useRemoteLink.setState({
    role: 'off',
    code: null,
    status: 'idle',
    error: null,
    peerOnline: false,
    ackSeq: 0,
  })
})

describe('pairing from the headset', () => {
  it('goes live on the code the relay hands back, and remembers it across a reload', async () => {
    api.openRoom.mockResolvedValue({ code: 'PQ4RTX', expires_in: 3600 })

    expect(await useRemoteLink.getState().startHeadset()).toBe(true)
    const s = useRemoteLink.getState()
    expect(s).toMatchObject({ role: 'headset', code: 'PQ4RTX', status: 'live' })
    // A headset reloads itself whenever a new build lands; the pairing has to
    // survive that without a trainer re-reading a code off the screen — and so
    // does the record of which commands it has already carried out, or the
    // whole session's instructions would run again on the way back up.
    expect(JSON.parse(localStorage.getItem('autism-remote-link')!).state).toEqual({
      role: 'headset',
      code: 'PQ4RTX',
      ackSeq: 0,
    })
  })

  it('starts from the room’s current position, so a re-pair inherits no backlog', async () => {
    api.openRoom.mockResolvedValue({ code: 'PQ4RTX', expires_in: 3600, last_seq: 7 })
    await useRemoteLink.getState().startHeadset()
    expect(useRemoteLink.getState().ackSeq).toBe(7)
  })

  it('explains a signed-out device instead of showing a raw 401', async () => {
    api.openRoom.mockRejectedValue(new RemoteError('Sign in on this device first.', 401))
    expect(await useRemoteLink.getState().startHeadset()).toBe(false)
    expect(useRemoteLink.getState().status).toBe('error')
    expect(useRemoteLink.getState().error).toMatch(/mentor account/i)
    expect(useRemoteLink.getState().role).toBe('off')
  })

  it('explains an unreachable relay in terms a trainer can act on', async () => {
    api.openRoom.mockRejectedValue(new RemoteError('Cannot reach the relay.', 0))
    await useRemoteLink.getState().startHeadset()
    expect(useRemoteLink.getState().error).toMatch(/relay address|network/i)
  })
})

describe('pairing from the console', () => {
  it('joins a code and keeps the relay’s canonical spelling of it', async () => {
    api.join.mockResolvedValue({ code: 'PQ4RTX', expires_in: 3600, state: {}, state_rev: 0, last_seq: 0 })
    expect(await useRemoteLink.getState().joinAsConsole('pq4rtx')).toBe(true)
    expect(useRemoteLink.getState()).toMatchObject({ role: 'console', code: 'PQ4RTX' })
  })

  it('says so when the code is not paired to anything', async () => {
    api.join.mockRejectedValue(new RemoteError('No live pairing with that code.', 404))
    expect(await useRemoteLink.getState().joinAsConsole('ZZZZZZ')).toBe(false)
    expect(useRemoteLink.getState().error).toMatch(/not paired/i)
  })
})

describe('ending a pairing', () => {
  it('stops the mirror, so a headset is not left encoding frames for nobody', async () => {
    api.openRoom.mockResolvedValue({ code: 'PQ4RTX', expires_in: 3600 })
    await useRemoteLink.getState().startHeadset()
    setMirrorWanted(true)

    await useRemoteLink.getState().stop({ closeRoom: true })
    expect(isMirrorWanted()).toBe(false)
    expect(api.close).toHaveBeenCalledWith('PQ4RTX')
    expect(useRemoteLink.getState()).toMatchObject({ role: 'off', code: null, status: 'idle' })
  })

  it('unpairs locally even when the relay cannot be told', async () => {
    api.openRoom.mockResolvedValue({ code: 'PQ4RTX', expires_in: 3600 })
    await useRemoteLink.getState().startHeadset()
    api.close.mockRejectedValue(new RemoteError('offline', 0))

    await expect(useRemoteLink.getState().stop({ closeRoom: true })).resolves.toBeUndefined()
    expect(useRemoteLink.getState().role).toBe('off')
  })
})

describe('remembering what has already been done', () => {
  it('records progress and forgets it when the pairing ends', async () => {
    api.openRoom.mockResolvedValue({ code: 'PQ4RTX', expires_in: 3600 })
    await useRemoteLink.getState().startHeadset()

    useRemoteLink.getState().setAck(4)
    expect(useRemoteLink.getState().ackSeq).toBe(4)
    expect(JSON.parse(localStorage.getItem('autism-remote-link')!).state.ackSeq).toBe(4)

    await useRemoteLink.getState().stop()
    expect(useRemoteLink.getState().ackSeq).toBe(0)
  })
})

describe('connection reporting', () => {
  it('clears an earlier error as soon as a poll comes back', () => {
    useRemoteLink.getState().markError('Connection lost.')
    expect(useRemoteLink.getState().status).toBe('error')

    useRemoteLink.getState().markLive(true)
    expect(useRemoteLink.getState()).toMatchObject({ status: 'live', error: null, peerOnline: true })
  })
})
