import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

/**
 * Emotion Room 360 left no trace of a round the child never answered.
 *
 * `event_ready` said the boards went up and `answer` said what was tapped, so
 * a round with no tap simply had nothing between it and the next thing in the
 * log — indistinguishable from the session ending there. Non-response is the
 * clinically most interesting category, and on Hard (`hintAfterMs: null`) it
 * is also the likeliest: nothing ever prompts the child.
 *
 * The probe is deliberately logging only. Lending Hard a hint would change
 * what the level is, which is a study-design decision rather than a logging
 * fix, so these tests also pin that nothing else happens when it fires.
 */

vi.mock('./EmotionRecognition360Scene', () => ({
  EmotionRecognition360Scene: (p: { boards: { emotion: string }[]; onPick: (i: number) => void }) => (
    <div>
      {p.boards.map((b, i) => (
        <button key={`${b.emotion}-${i}`} data-testid={`board-${i}`} onClick={() => p.onPick(i)} />
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

import { EmotionRecognition360Game } from './EmotionRecognition360Game'
import { useSettings } from '../../state/settings'

function steps(type: string): Record<string, unknown>[] {
  return recordStep.mock.calls
    .filter((c) => c[0] === type)
    .map((c) => (c[1] ?? {}) as Record<string, unknown>)
}

describe('Emotion Room 360 non-response logging', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    recordStep.mockClear()
    useSettings.setState({ voiceOn: false, soundOn: false, volume: 1, language: 'en' })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  function play(level: 'easy' | 'hard') {
    useSettings.getState().setDifficulty('emotionrecognition360', level)
    const view = render(
      <MemoryRouter>
        <EmotionRecognition360Game />
      </MemoryRouter>,
    )
    act(() => {
      view.getByText(/play/i).click()
    })
    // the calm beat before the boards appear
    act(() => {
      vi.advanceTimersByTime(800)
    })
    expect(steps('event_ready')).toHaveLength(1)
    return view
  }

  it('records a round the child never answers, on the level with no hint at all', () => {
    const view = play('hard')
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
    expect(missed[0]).toMatchObject({ boardCount: 3, afterMs: 20_000, hinted: false })
    expect(missed[0].target).toEqual(expect.any(String))
    // the scan the round asked for, so a non-response can be read against how
    // far the child would have had to turn
    expect(missed[0].targetBearingDeg).toEqual(expect.any(Number))

    // logging only: the round is still there, still answerable
    expect(view.getByTestId('board-0')).toBeTruthy()
    expect(steps('answer')).toHaveLength(0)
  })

  it('says it once, however long the child sits there', () => {
    play('hard')
    act(() => {
      vi.advanceTimersByTime(180_000)
    })
    expect(steps('no_answer')).toHaveLength(1)
  })

  it('notes whether the look-around cue had already been given', () => {
    play('easy') // hint fires at 5s
    act(() => {
      vi.advanceTimersByTime(21_000)
    })
    expect(steps('hint')).toHaveLength(1)
    expect(steps('no_answer')[0]).toMatchObject({ hinted: true, boardCount: 2 })
  })

  it('stops the clock as soon as the child answers', () => {
    const view = play('hard')
    // answer with one second left on the clock, so an uncancelled timer would
    // fire during the window below rather than merely not having reached it
    act(() => {
      vi.advanceTimersByTime(19_000)
    })
    act(() => {
      view.getByTestId('board-0').click()
    })
    recordStep.mockClear()
    act(() => {
      vi.advanceTimersByTime(2_000)
    })
    expect(steps('no_answer')).toHaveLength(0)
  })

  it('gives the next round its own clock', () => {
    const view = play('hard')
    act(() => {
      view.getByTestId('board-0').click()
    })
    recordStep.mockClear()
    // feedback (1.6s) + the calm beat (0.7s) + a fresh 20s on the new round
    act(() => {
      vi.advanceTimersByTime(22_000)
    })
    expect(steps('no_answer')).toHaveLength(0)
    act(() => {
      vi.advanceTimersByTime(1_000)
    })
    expect(steps('no_answer')).toHaveLength(1)
  })

  it('does not leave the clock running once the child has left the game', () => {
    const view = play('hard')
    recordStep.mockClear()
    view.unmount()
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(recordStep).not.toHaveBeenCalled()
  })
})
