import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyRemoteCommand, currentGameId, type RemoteContext } from './commands'
import type { RemoteCommand } from './protocol'

/** A context that records what the app was asked to do. */
function makeCtx(overrides: Partial<RemoteContext> = {}) {
  const calls = {
    navigate: [] as string[],
    exits: [] as string[],
    levels: [] as [string, string][],
    settings: [] as unknown[],
    students: [] as (string | null)[],
    intents: [] as string[],
    mirror: [] as [boolean, number | undefined][],
  }
  const ctx: RemoteContext = {
    route: () => '/',
    navigate: (p) => calls.navigate.push(p),
    currentSession: () => null,
    exitTo: async (_session, path) => {
      calls.exits.push(path)
    },
    setDifficulty: (g, l) => calls.levels.push([g, l]),
    applySettings: (p) => calls.settings.push(p),
    setStudent: (id) => calls.students.push(id),
    emit: (intent) => {
      calls.intents.push(intent)
      return 0
    },
    setMirror: (on, ms) => calls.mirror.push([on, ms]),
    ...overrides,
  }
  return { ctx, calls }
}

const fakeSession = {} as XRSession

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('goto', () => {
  it('sets the level before opening the game, so the round starts on it', async () => {
    const { ctx, calls } = makeCtx()
    await applyRemoteCommand(
      { type: 'goto', payload: { gameId: 'park360', level: 'hard' } } as RemoteCommand,
      ctx,
    )
    expect(calls.levels).toEqual([['park360', 'hard']])
    expect(calls.navigate).toEqual(['/park-360'])
  })

  it('leaves a live headset session properly instead of navigating out from under it', async () => {
    const { ctx, calls } = makeCtx({ currentSession: () => fakeSession })
    await applyRemoteCommand({ type: 'goto', payload: { gameId: 'museum360' } } as RemoteCommand, ctx)
    // Never a bare navigate while presenting: that is what strands the child in
    // the headset's own home environment (games/exitVr.ts).
    expect(calls.navigate).toEqual([])
    expect(calls.exits).toEqual(['/museum-360'])
  })

  it('ignores a game this build does not have', async () => {
    const { ctx, calls } = makeCtx()
    await applyRemoteCommand(
      { type: 'goto', payload: { gameId: 'nosuchgame' } } as unknown as RemoteCommand,
      ctx,
    )
    expect(calls.navigate).toEqual([])
    expect(calls.exits).toEqual([])
  })

  it('ignores a level value that is not a level', async () => {
    const { ctx, calls } = makeCtx()
    await applyRemoteCommand(
      { type: 'goto', payload: { gameId: 'park360', level: 'impossible' } } as unknown as RemoteCommand,
      ctx,
    )
    expect(calls.levels).toEqual([])
    expect(calls.navigate).toEqual(['/park-360'])
  })

  it('pressing the game the child is already on presses Play instead of nothing', async () => {
    const pressed: string[] = []
    const { ctx, calls } = makeCtx({
      route: () => '/park-360',
      emit: (intent) => {
        pressed.push(intent)
        return 1
      },
    })
    await applyRemoteCommand({ type: 'goto', payload: { gameId: 'park360' } } as RemoteCommand, ctx)
    expect(pressed).toEqual(['play'])
    expect(calls.navigate).toEqual([])
  })

  it('re-navigates to the same game when no screen took the press', async () => {
    const { ctx, calls } = makeCtx({ route: () => '/park-360' })
    await applyRemoteCommand({ type: 'goto', payload: { gameId: 'park360' } } as RemoteCommand, ctx)
    // Both presses were offered and neither landed, so it opens the game afresh.
    expect(calls.intents).toEqual(['play', 'restart'])
    expect(calls.navigate).toEqual(['/park-360'])
  })
})

describe('quit and home', () => {
  it('quit ends the session and lands on Home', async () => {
    const { ctx, calls } = makeCtx({ currentSession: () => fakeSession })
    await applyRemoteCommand({ type: 'quit', payload: {} } as RemoteCommand, ctx)
    expect(calls.exits).toEqual(['/'])
  })

  it('home navigates when nothing is presenting', async () => {
    const { ctx, calls } = makeCtx({ route: () => '/park-360' })
    await applyRemoteCommand({ type: 'home', payload: {} } as RemoteCommand, ctx)
    expect(calls.navigate).toEqual(['/'])
    expect(calls.exits).toEqual([])
  })
})

describe('the rest of the controls', () => {
  it('setLevel defaults to the game currently open', async () => {
    const { ctx, calls } = makeCtx({ route: () => '/football-360' })
    await applyRemoteCommand({ type: 'setLevel', payload: { level: 'medium' } } as RemoteCommand, ctx)
    expect(calls.levels).toEqual([['football360', 'medium']])
  })

  it('setLevel on a menu screen with no game named does nothing', async () => {
    const { ctx, calls } = makeCtx({ route: () => '/' })
    await applyRemoteCommand({ type: 'setLevel', payload: { level: 'hard' } } as RemoteCommand, ctx)
    expect(calls.levels).toEqual([])
  })

  it('play and restart become presses on whatever screen is up', async () => {
    const { ctx, calls } = makeCtx()
    await applyRemoteCommand({ type: 'play', payload: {} } as RemoteCommand, ctx)
    await applyRemoteCommand({ type: 'restart', payload: {} } as RemoteCommand, ctx)
    expect(calls.intents).toEqual(['play', 'restart'])
  })

  it('passes settings through and switches participant', async () => {
    const { ctx, calls } = makeCtx()
    await applyRemoteCommand({ type: 'setting', payload: { voiceOn: false } } as RemoteCommand, ctx)
    await applyRemoteCommand({ type: 'participant', payload: { studentId: 'abc' } } as RemoteCommand, ctx)
    expect(calls.settings).toEqual([{ voiceOn: false }])
    expect(calls.students).toEqual(['abc'])
  })

  it('keeps junk out of the settings the child’s next session inherits', async () => {
    const { ctx, calls } = makeCtx()
    await applyRemoteCommand(
      {
        type: 'setting',
        payload: { language: 'klingon', voiceOn: 'yes', inputMethod: 'dwell' },
      } as unknown as RemoteCommand,
      ctx,
    )
    // Only the value this build actually understands survives.
    expect(calls.settings).toEqual([{ inputMethod: 'dwell' }])
  })

  it('does not touch settings when nothing in the payload is usable', async () => {
    const { ctx, calls } = makeCtx()
    await applyRemoteCommand(
      { type: 'setting', payload: { playMode: 'holodeck' } } as unknown as RemoteCommand,
      ctx,
    )
    expect(calls.settings).toEqual([])
  })

  it('treats a missing or empty participant as "not recording"', async () => {
    const { ctx, calls } = makeCtx()
    await applyRemoteCommand({ type: 'participant', payload: {} } as unknown as RemoteCommand, ctx)
    await applyRemoteCommand(
      { type: 'participant', payload: { studentId: '' } } as unknown as RemoteCommand,
      ctx,
    )
    expect(calls.students).toEqual([null, null])
  })

  it('turns the mirror on and off', async () => {
    const { ctx, calls } = makeCtx()
    await applyRemoteCommand({ type: 'mirror', payload: { on: true, intervalMs: 500 } } as RemoteCommand, ctx)
    await applyRemoteCommand({ type: 'mirror', payload: { on: false } } as RemoteCommand, ctx)
    expect(calls.mirror).toEqual([
      [true, 500],
      [false, undefined],
    ])
  })

  it('a throwing app never breaks the loop that is the child’s way out', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { ctx } = makeCtx({
      navigate: () => {
        throw new Error('router exploded')
      },
    })
    await expect(
      applyRemoteCommand({ type: 'home', payload: {} } as RemoteCommand, ctx),
    ).resolves.toBeUndefined()
  })
})

describe('currentGameId', () => {
  it('maps a route to its game, and anything else to null', () => {
    expect(currentGameId('/park-360')).toBe('park360')
    expect(currentGameId('/')).toBeNull()
    expect(currentGameId('/participants')).toBeNull()
  })
})
