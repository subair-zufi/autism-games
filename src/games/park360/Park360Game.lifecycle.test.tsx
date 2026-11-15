import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

/**
 * Park 360 used to leave a timer running after the child had left the game.
 *
 * The celebration pause that deals the next round was a bare `setTimeout`, so
 * `clearTimers()` could not cancel it. Quitting during the 2s celebration let
 * it fire on an unmounted component, where `beginRound` armed a fresh spawn
 * timer that nothing could ever clear — and `armNudge`/`fireNudge` re-arm each
 * other, so a chime, a spoken nudge and a recorded step went out every few
 * seconds for the life of the tab. Worse, `recordStep` opened a BRAND-NEW
 * park360 session for them: nudges with no shares, which is precisely the
 * recorded signature of a non-initiating child.
 *
 * This pins the quiet-after-unmount property rather than the implementation,
 * so either guard (the timer ref, or `useGameAnalytics`'s mounted check)
 * failing on its own is enough to fail the test.
 */

vi.mock('./Park360Scene', () => ({
  Park360Scene: (p: { onTapDiscovery: () => void; onTapFriend: () => void }) => (
    <div>
      <button data-testid="surprise" onClick={p.onTapDiscovery} />
      <button data-testid="friend" onClick={p.onTapFriend} />
    </div>
  ),
}))
vi.mock('../../components/WebGLGate', () => ({ WebGLGate: (p: { children: ReactNode }) => <>{p.children}</> }))
vi.mock('../VRWaitingRoom', () => ({ VRWaitingRoom: () => null }))
vi.mock('../vrPractice/VRPracticeScene', () => ({ VRPracticeScene: () => null }))
vi.mock('../gameOverPanel', () => ({ useVrGameOverPanel: () => {} }))
vi.mock('../../services/speech', () => ({
  speak: vi.fn(),
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

import { Park360Game } from './Park360Game'
import { useSettings } from '../../state/settings'

describe('Park360Game timer lifetime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    recordStep.mockClear()
    useSettings.setState((s) => ({
      difficulty: { ...s.difficulty, park360: 'easy' },
      vrPracticeDone: true,
    }))
  })
  afterEach(() => vi.useRealTimers())

  it('records nothing once the game is unmounted mid-celebration', async () => {
    const view = render(
      <MemoryRouter>
        <Park360Game />
      </MemoryRouter>,
    )
    // no WebXR in jsdom, so Play starts the session immediately
    await act(async () => {
      view.getByText(/play/i).click()
    })
    // the park waits spawnDelayMs() (900-2500ms) before the surprise pops in
    await act(async () => {
      vi.advanceTimersByTime(2600)
    })
    // complete one share: enters `celebrating` and schedules the next round
    await act(async () => {
      view.getByTestId('surprise').click()
    })
    await act(async () => {
      view.getByTestId('friend').click()
    })
    expect(recordStep.mock.calls.map((c) => c[0])).toContain('share')

    recordStep.mockClear()
    view.unmount()

    // easy nudges every 4s, so a minute of silence covers ~14 would-be nudges
    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })
    expect(recordStep.mock.calls.map((c) => c[0])).toEqual([])
  })
})
