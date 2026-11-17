import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { EmotionId } from '../emotionVocab'

/**
 * Emotion Cinema 360 recorded nothing about a trial except its answers.
 *
 * There was no record of when the freeze happened — the moment the question
 * becomes answerable and the zero point `latencyMs` is measured from — so a
 * re-asked question looked identical to a first asking. "Watch again" was
 * never recorded at all, even though the in-world card exists precisely so a
 * child in a headset can take a second look without paying an error for it, so
 * a voluntary re-watch left no trace. And a trial the child never answered
 * produced no event whatsoever, which made "did not respond" and "the session
 * ended here" the same thing in the data.
 *
 * These pin the events rather than their payload details, so the fields can be
 * extended without rewriting the tests.
 */

vi.mock('./IdentifyEmotions360Scene', () => ({
  IdentifyEmotions360Scene: (p: {
    choices: EmotionId[]
    onPickEmotion: (id: EmotionId) => void
    onReplay: () => void
    frozen: boolean
  }) => (
    <div>
      <span data-testid="frozen">{String(p.frozen)}</span>
      <button data-testid="watch-again" onClick={p.onReplay} />
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
vi.mock('../../services/speech', () => ({
  speak: (_t: string, _l: string, onEnd?: () => void) => onEnd?.(),
  praise: vi.fn(),
  speakThenPraise: vi.fn(),
  speechAvailable: () => false,
  speakAll: vi.fn(),
  preloadPraise: vi.fn(),
}))

const recordStep = vi.fn()
vi.mock('../useGameAnalytics', () => ({
  useGameAnalytics: () => ({
    recordStep: (...a: unknown[]) => recordStep(...a),
    finishGame: vi.fn(),
    resetSession: vi.fn(),
  }),
}))
vi.mock('../progression', () => ({ useLevelProgress: () => ({ submit: vi.fn() }) }))

import { IdentifyEmotions360Game } from './IdentifyEmotions360Game'
import { useSettings } from '../../state/settings'

let fakeTime = 0

function installMediaStubs() {
  const proto = window.HTMLMediaElement.prototype
  vi.spyOn(proto, 'play').mockImplementation(() => Promise.resolve())
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

let videoEl: HTMLVideoElement | null = null

/** Every step of one type that has been recorded so far. */
function steps(type: string): Record<string, unknown>[] {
  return recordStep.mock.calls
    .filter((c) => c[0] === type)
    .map((c) => (c[1] ?? {}) as Record<string, unknown>)
}

describe('Emotion Cinema 360 trial logging', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    fakeTime = 0
    videoEl = null
    recordStep.mockClear()
    const create = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string, ...rest: unknown[]) => {
      const el = create(tag as 'video', ...(rest as []))
      if (tag === 'video') videoEl ??= el as HTMLVideoElement
      return el
    }) as typeof document.createElement)
    installMediaStubs()
    useSettings.setState({ voiceOn: false, soundOn: false, volume: 1, language: 'en' })
    useSettings.getState().setDifficulty('identifyemotions360', 'easy')
  })

  afterEach(() => {
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

  /** Run the clip up to its freeze frame. */
  function freeze(view: ReturnType<typeof start>) {
    act(() => {
      fakeTime = 9
      videoEl!.dispatchEvent(new Event('timeupdate'))
    })
    expect(view.getByTestId('frozen').textContent).toBe('true')
  }

  it('records the freeze — the moment the question becomes answerable', () => {
    const view = start()
    freeze(view)

    const frozen = steps('clip_frozen')
    expect(frozen).toHaveLength(1)
    expect(frozen[0]).toMatchObject({ difficulty: 'easy', via: 'target', attempt: 0 })
    expect(frozen[0].clip).toEqual(expect.any(String))
    // the guessing baseline the trial was run at, on the step itself
    expect(frozen[0].chance).toBeCloseTo(0.5)
    // what the clip was authored to stop on vs where it actually stopped —
    // `timeupdate` overshoots, and that slop has to be measurable
    expect(frozen[0].freezeTime).toEqual(expect.any(Number))
    expect(frozen[0].actualFreezeTime).toEqual(expect.any(Number))
  })

  it('records a voluntary "Watch again", separately from the one the game imposes', () => {
    const view = start()
    freeze(view)
    recordStep.mockClear()

    act(() => {
      view.getByTestId('watch-again').click()
    })
    const replays = steps('replay')
    expect(replays).toHaveLength(1)
    // a second look the CHILD asked for, which is the whole reason the
    // in-world card exists
    expect(replays[0]).toMatchObject({ source: 'child', attempt: 0 })
    expect(replays[0].afterFreezeMs).toEqual(expect.any(Number))

    // and the question is recorded as asked again, not silently repeated
    freeze(view)
    expect(steps('clip_frozen')).toHaveLength(1)
  })

  it('marks the automatic replay after a wrong answer as a scaffold, not a choice', () => {
    const view = start()
    freeze(view)
    recordStep.mockClear()

    // click every choice: exactly one is right, so at least one is wrong
    act(() => {
      for (const b of view.container.querySelectorAll('button[data-testid^="choice-"]')) {
        ;(b as HTMLButtonElement).click()
      }
    })
    act(() => {
      vi.advanceTimersByTime(600)
    })

    const scaffolded = steps('replay').filter((r) => r.source === 'scaffold')
    expect(scaffolded.length).toBeGreaterThan(0)
    expect(steps('replay').every((r) => r.source === 'child' || r.source === 'scaffold')).toBe(true)
  })

  it('records a question the child never answers, without prompting or advancing', () => {
    const view = start()
    freeze(view)
    recordStep.mockClear()

    act(() => {
      vi.advanceTimersByTime(19_000)
    })
    expect(steps('no_answer')).toHaveLength(0)

    act(() => {
      vi.advanceTimersByTime(2_000)
    })
    const missed = steps('no_answer')
    expect(missed).toHaveLength(1)
    expect(missed[0]).toMatchObject({ stage: 'emotion', afterMs: 20_000, difficulty: 'easy' })

    // logging only: the round does not move on and nothing is replayed, so the
    // level's own scaffold (or lack of one) is still what the child gets
    expect(view.getByTestId('frozen').textContent).toBe('true')
    expect(steps('replay')).toHaveLength(0)

    // and it says it once, however long the child sits there
    act(() => {
      vi.advanceTimersByTime(120_000)
    })
    expect(steps('no_answer')).toHaveLength(1)
  })

  it('stops the no-answer clock as soon as the child answers', () => {
    const view = start()
    freeze(view)
    act(() => {
      for (const b of view.container.querySelectorAll('button[data-testid^="choice-"]')) {
        ;(b as HTMLButtonElement).click()
      }
    })
    recordStep.mockClear()
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(steps('no_answer')).toHaveLength(0)
  })

  it('does not leave the clock running once the child has left the game', () => {
    const view = start()
    freeze(view)
    recordStep.mockClear()
    view.unmount()
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(recordStep).not.toHaveBeenCalled()
  })
})
