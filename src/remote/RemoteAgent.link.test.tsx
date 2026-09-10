import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * A stand-in relay that behaves like the real one: a room with a command
 * history, handing back everything after the sequence number it is asked for.
 */
const room = vi.hoisted(() => ({
  commands: [] as {
    seq: number
    type: string
    payload: Record<string, unknown>
    age_ms?: number
  }[],
  pulls: [] as number[],
}))

const api = vi.hoisted(() => ({
  openRoom: vi.fn(),
  join: vi.fn(),
  close: vi.fn(),
  pushCommand: vi.fn(),
  pullCommands: vi.fn(async (_code: string, after: number) => {
    room.pulls.push(after)
    const commands = room.commands.filter((c) => c.seq > after)
    const last = room.commands.length ? room.commands[room.commands.length - 1].seq : 0
    return { commands, last_seq: last, console_online: true, age_ms: 0 }
  }),
  pushState: vi.fn(async () => ({})),
  pullState: vi.fn(),
}))

vi.mock('./client', async () => {
  const actual = await vi.importActual<typeof import('./client')>('./client')
  return { ...actual, remoteApi: api }
})

const { RemoteAgent } = await import('./RemoteAgent')
const { useRemoteLink } = await import('../state/remote')
const { useAuth } = await import('../state/auth')

function Screen() {
  const navigate = useNavigate()
  const location = useLocation()
  return (
    <>
      <span data-testid="where">{location.pathname}</span>
      <button onClick={() => navigate('/')}>go home by hand</button>
    </>
  )
}

beforeEach(() => {
  localStorage.clear()
  room.commands = []
  room.pulls = []
  vi.clearAllMocks()
  // Pairing is a mentor feature: the agent unpairs itself when signed out.
  useAuth.setState({ isLoggedIn: true, students: [], activeStudentId: null })
  useRemoteLink.setState({
    role: 'headset',
    code: 'PQ4RTX',
    ackSeq: 0,
    status: 'live',
    error: null,
    peerOnline: true,
  })
})

afterEach(() => {
  useRemoteLink.setState({ role: 'off', code: null, ackSeq: 0 })
})

describe('a paired headset stays usable by hand', () => {
  it('does not replay the trainer’s last command when someone navigates on the headset', async () => {
    // The trainer opened a game from their phone a moment ago.
    room.commands.push({ seq: 1, type: 'goto', payload: { gameId: 'park360' } })

    render(
      <MemoryRouter initialEntries={['/']}>
        <RemoteAgent />
        <Screen />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/park-360'))

    // Now someone presses Home on the headset itself.
    await userEvent.click(screen.getByText('go home by hand'))
    expect(screen.getByTestId('where').textContent).toBe('/')

    // It has to stay there. Before this was fixed, navigating changed the
    // identity of react-router's `navigate`, which restarted the listener from
    // sequence zero — so the old "open Park 360" was delivered again and threw
    // the child straight back into the game nobody had asked for twice.
    await new Promise((r) => setTimeout(r, 400))
    expect(screen.getByTestId('where').textContent).toBe('/')
  })

  it('never asks the relay for commands it has already carried out', async () => {
    room.commands.push({ seq: 1, type: 'goto', payload: { gameId: 'park360' } })

    render(
      <MemoryRouter initialEntries={['/']}>
        <RemoteAgent />
        <Screen />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/park-360'))
    await userEvent.click(screen.getByText('go home by hand'))
    await new Promise((r) => setTimeout(r, 250))

    // Exactly one pull may start from zero: the first one.
    expect(room.pulls.filter((after) => after === 0)).toHaveLength(1)
  })

  it('resumes where it left off after a reload instead of replaying the session', async () => {
    room.commands.push({ seq: 1, type: 'goto', payload: { gameId: 'park360' } })
    // What a reload looks like: the pairing survives in storage, and with it
    // the record of what this device has already done.
    useRemoteLink.setState({ ackSeq: 1 })

    render(
      <MemoryRouter initialEntries={['/']}>
        <RemoteAgent />
        <Screen />
      </MemoryRouter>,
    )

    await waitFor(() => expect(room.pulls.length).toBeGreaterThan(0))
    await new Promise((r) => setTimeout(r, 250))
    expect(room.pulls.every((after) => after >= 1)).toBe(true)
    expect(screen.getByTestId('where').textContent).toBe('/')
  })

  it('ignores an instruction that went stale while the headset was away', async () => {
    // Two minutes old: the trainer asked for this long before the headset came
    // back, and acting on it now would move a child who is settled.
    room.commands.push({
      seq: 1,
      type: 'goto',
      payload: { gameId: 'park360' },
      age_ms: 120_000,
    })

    render(
      <MemoryRouter initialEntries={['/']}>
        <RemoteAgent />
        <Screen />
      </MemoryRouter>,
    )

    await waitFor(() => expect(room.pulls.length).toBeGreaterThan(0))
    await new Promise((r) => setTimeout(r, 250))
    expect(screen.getByTestId('where').textContent).toBe('/')
    // It is still acknowledged, so it cannot come back on the next poll.
    expect(useRemoteLink.getState().ackSeq).toBe(1)
  })

  it('fetches a participant it has never heard of, so the console sees their name', async () => {
    const loadStudents = vi.fn(async () => {})
    useAuth.setState({ isLoggedIn: true, students: [], activeStudentId: null, loadStudents })
    room.commands.push({ seq: 1, type: 'participant', payload: { studentId: 'brand-new' } })

    render(
      <MemoryRouter initialEntries={['/']}>
        <RemoteAgent />
        <Screen />
      </MemoryRouter>,
    )

    // The id is what gets recorded either way — this is so the trainer's phone
    // can show who the session is running against, right after they added them.
    await waitFor(() => expect(loadStudents).toHaveBeenCalled())
    expect(useAuth.getState().activeStudentId).toBe('brand-new')
  })

  it('does not hammer a relay that answers instantly instead of parking', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <RemoteAgent />
        <Screen />
      </MemoryRouter>,
    )
    await new Promise((r) => setTimeout(r, 600))
    // With no floor under the poll this loop spun as fast as the network
    // allowed — on a headset, that is the child's battery.
    expect(room.pulls.length).toBeLessThanOrEqual(3)
  })
})
