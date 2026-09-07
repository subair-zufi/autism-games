import { beforeEach, describe, expect, it } from 'vitest'
import { buildStatus } from './RemoteAgent'
import { useSettings } from '../state/settings'
import { useAuth } from '../state/auth'
import { resetGameReport } from './status'
import { resetMirror, setMirrorWanted } from './mirror'
import { REMOTE_PROTOCOL_VERSION } from './protocol'

beforeEach(() => {
  window.location.hash = '#/'
  useSettings.setState(useSettings.getInitialState())
  useAuth.setState({ students: [], activeStudentId: null })
  resetGameReport()
  resetMirror()
})

describe('what the headset reports about itself', () => {
  it('reads the open game and its level off the route', () => {
    useSettings.getState().setDifficulty('park360', 'hard')
    window.location.hash = '#/park-360'

    const status = buildStatus()
    expect(status.v).toBe(REMOTE_PROTOCOL_VERSION)
    expect(status.route).toBe('/park-360')
    expect(status.gameId).toBe('park360')
    expect(status.gameTitle).toBe('Park 360')
    expect(status.level).toBe('hard')
    // Nothing has reported a round yet, so a game screen reads as "waiting".
    expect(status.phase).toBe('start')
  })

  it('reads the mentor screens as the menu, with no game or level', () => {
    window.location.hash = '#/participants'
    const status = buildStatus()
    expect(status.gameId).toBeNull()
    expect(status.level).toBeNull()
    expect(status.phase).toBe('menu')
  })

  it('ignores a query string on the route', () => {
    window.location.hash = '#/park-360?from=home'
    expect(buildStatus().gameId).toBe('park360')
  })

  it('carries the settings the trainer can change, so their phone shows the truth', () => {
    useSettings.getState().setVoiceOn(false)
    useSettings.getState().setLanguage('ml')
    useSettings.getState().setInputMethod('controller')

    expect(buildStatus().settings).toEqual({
      voiceOn: false,
      soundOn: true,
      language: 'ml',
      inputMethod: 'controller',
      playMode: 'desktop',
    })
  })

  it('names the participant the session is being recorded against', () => {
    useAuth.setState({
      students: [{ id: 's1', full_name: 'Aarav' } as never],
      activeStudentId: 's1',
    })
    const status = buildStatus()
    expect(status.studentId).toBe('s1')
    expect(status.studentName).toBe('Aarav')
  })

  it('says the mirror is off until a console asks for it', () => {
    expect(buildStatus().mirror).toBe('off')
    setMirrorWanted(true)
    // Asked for, but no frame has been produced yet.
    expect(buildStatus().mirror).toBe('unavailable')
  })
})
