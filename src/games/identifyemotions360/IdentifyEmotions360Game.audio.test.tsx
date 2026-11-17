import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { EmotionId } from '../emotionVocab'

/**
 * Emotion Cinema 360's clip audio used to sit outside the app's sound settings
 * entirely.
 *
 * Nothing ever set `muted` or `volume` on the `<video>`, so a trainer who
 * switched sound off for a sound-sensitive child — the only sensory lever the
 * app had — silenced the chimes and the praise and left the loudest thing in
 * the game playing at full system level. The stimulus pool makes that worse,
 * not better: it spans 41 dB from its quietest clip to its loudest, so a level
 * that is comfortable on one clip is a startle on the next.
 *
 * On top of that, a correct answer started three audio streams in the same
 * tick — the chime, a spoken cheer, and the clip's own audio resuming — and a
 * wrong answer started the replay on a fixed timer while the spoken correction
 * still had about half a second to run.
 *
 * These pin the behaviour, not the implementation: the element must follow the
 * settings live (the trainer changes them mid-session from their phone), and
 * the clip's audio must not come back in the same tick as the cheer.
 */

vi.mock('./IdentifyEmotions360Scene', () => ({
  IdentifyEmotions360Scene: (p: {
    choices: EmotionId[]
    onPickEmotion: (id: EmotionId) => void
    frozen: boolean
  }) => (
    <div>
      <span data-testid="frozen">{String(p.frozen)}</span>
      {p.choices.map((id) => (
        <button key={id} data-testid={`choice-${id}`} onClick={() => p.onPickEmotion(id)} />
      ))}
    </div>
  ),
}))
vi.mock('../../components/WebGLGate', () => ({ WebGLGate: (p: { children: ReactNode }) => <>{p.children}</> }))
vi.mock('../VRWaitingRoom', () => ({ VRWaitingRoom: () => null }))
vi.mock('../vrPractice/VRPracticeScene', () => ({ VRPracticeScene: () => null }))
vi.mock('../gameOverPanel', () => ({ useVrGameOverPanel: () => {} }))

const praise = vi.fn()
vi.mock('../../services/speech', () => ({
  speak: (_t: string, _l: string, onEnd?: () => void) => onEnd?.(),
  praise: () => praise(),
  speakThenPraise: vi.fn(),
  speechAvailable: () => false,
  speakAll: vi.fn(),
  preloadPraise: vi.fn(),
}))
vi.mock('../useGameAnalytics', () => ({
  useGameAnalytics: () => ({ recordStep: vi.fn(), finishGame: vi.fn(), resetSession: vi.fn() }),
}))
vi.mock('../progression', () => ({ useLevelProgress: () => ({ submit: vi.fn() }) }))

import { IdentifyEmotions360Game } from './IdentifyEmotions360Game'
import { useSettings } from '../../state/settings'

/** jsdom implements none of the media methods; these are the few the game uses. */
const play = vi.fn(() => Promise.resolve())
let fakeTime = 0

function installMediaStubs() {
  const proto = window.HTMLMediaElement.prototype
  vi.spyOn(proto, 'play').mockImplementation(play)
  vi.spyOn(proto, 'pause').mockImplementation(() => {})
  vi.spyOn(proto, 'load').mockImplementation(() => {})
  Object.defineProperty(proto, 'currentTime', {
    configurable: true,
    get: () => fakeTime,
    set: (v: number) => {
      fakeTime = v
    },
  })
  Object.defineProperty(proto, 'duration', { configurable: true, get: () => 10 })
  Object.defineProperty(proto, 'paused', { configurable: true, get: () => false })
}

/** The one `<video>` the game builds for the whole session. */
function clipElement(): HTMLVideoElement {
  const el = document.querySelector('video')
  // the element is never attached to the document, so reach it the same way
  // the game does — through the only media element the stubs have seen
  return (el ?? lastMediaElement) as HTMLVideoElement
}

let lastMediaElement: HTMLVideoElement | null = null

describe('Emotion Cinema 360 clip audio', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    fakeTime = 0
    play.mockClear()
    praise.mockClear()
    lastMediaElement = null
    const create = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string, ...rest: unknown[]) => {
      const el = create(tag as 'video', ...(rest as []))
      if (tag === 'video') lastMediaElement = el as HTMLVideoElement
      return el
    }) as typeof document.createElement)
    installMediaStubs()
    useSettings.setState({ voiceOn: false, soundOn: true, volume: 1, language: 'en' })
    useSettings.getState().setDifficulty('identifyemotions360', 'easy')
  })

  afterEach(() => {
    // unmount while the media stubs are still in place: the cleanup effect
    // pauses the clip, and jsdom's real pause() only logs noise
    cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  function start() {
    const view = render(
      <MemoryRouter>
        <IdentifyEmotions360Game />
      </MemoryRouter>,
    )
    act(() => {
      view.getByText(/play/i).click()
    })
    return view
  }

  it('mutes the clip when the trainer switches sound off, live', () => {
    start()
    const video = clipElement()
    expect(video.muted).toBe(false)
    expect(video.volume).toBe(1)

    // the trainer's phone patches the store mid-session — the element has to
    // follow without the game being remounted
    act(() => useSettings.getState().setSoundOn(false))
    expect(video.muted).toBe(true)

    act(() => useSettings.getState().setSoundOn(true))
    expect(video.muted).toBe(false)
  })

  it('plays the clip at the session volume, and treats zero as muted', () => {
    start()
    const video = clipElement()

    act(() => useSettings.getState().setVolume(0.25))
    expect(video.volume).toBe(0.25)
    expect(video.muted).toBe(false)

    // muted as well as zero-gain: some platforms ignore volume on the element
    act(() => useSettings.getState().setVolume(0))
    expect(video.muted).toBe(true)
  })

  it('lets the cheer finish before the clip’s own audio comes back', () => {
    const view = start()
    const video = clipElement()

    // run the clip up to its freeze frame
    act(() => {
      fakeTime = 9
      video.dispatchEvent(new Event('timeupdate'))
    })
    expect(view.getByTestId('frozen').textContent).toBe('true')

    play.mockClear()
    const answer = view.container.querySelectorAll('button[data-testid^="choice-"]')
    expect(answer.length).toBeGreaterThan(0)
    // whichever is correct, one of these is — pick them all; only the right
    // one locks the round, and a wrong one must not resume the clip either
    act(() => {
      for (const b of answer) (b as HTMLButtonElement).click()
    })

    // nothing restarts in the same tick as the chime and the cheer
    expect(play).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(800)
    })
    // …and it does come back, so the child still sees the expression resolve
    expect(play).toHaveBeenCalled()
  })

  it('stops the clip and any speech when the child leaves', () => {
    const cancel = vi.fn()
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { cancel, speak: vi.fn(), getVoices: () => [] },
    })
    const view = start()
    const pause = vi.spyOn(clipElement(), 'pause')
    view.unmount()
    expect(pause).toHaveBeenCalled()
    expect(cancel).toHaveBeenCalled()
  })
})
