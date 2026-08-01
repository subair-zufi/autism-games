import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useVrGameOver, useVrGameOverPanel } from './gameOverPanel'
import { useSettings } from '../state/settings'

const base = {
  headline: 'Great playing! 🎉',
  score: 7,
  best: 12,
  stars: 2,
  lang: 'en' as const,
  gameId: 'museum360' as const,
  level: 'medium' as const,
}

beforeEach(() => {
  useVrGameOver.getState().hide()
  useSettings.getState().setDifficulty('museum360', 'easy')
  useSettings.getState().setDifficulty('park360', 'easy')
})

describe('useVrGameOverPanel', () => {
  it('publishes nothing while a round is still being played', () => {
    renderHook(() => useVrGameOverPanel({ ...base, over: false, onRestart: () => {} }))
    expect(useVrGameOver.getState().info).toBeNull()
  })

  it('publishes localized lines when the round finishes', () => {
    renderHook(() => useVrGameOverPanel({ ...base, over: true, onRestart: () => {} }))
    const info = useVrGameOver.getState().info!

    expect(info.headline).toBe('Great playing! 🎉')
    expect(info.stars).toBe(2)
    // built from the same keys the flat dialog uses
    expect(info.scoreLine).toContain('7')
    expect(info.bestLine).toContain('12')
    expect(info.labels.playAgain).toBeTruthy()
    expect(info.labels.chooseLevel).toBeTruthy()
    expect(info.labels.home).toBeTruthy()
    // the in-world picker mirrors the flat StartScreen: three levels, with the
    // game's current one marked
    expect(info.levels.map((l) => l.id)).toEqual(['easy', 'medium', 'hard'])
    expect(info.currentLevel).toBe('medium')
  })

  it('clears the panel when a new round starts', () => {
    const { rerender } = renderHook(
      (over: boolean) => useVrGameOverPanel({ ...base, over, onRestart: () => {} }),
      { initialProps: true },
    )
    expect(useVrGameOver.getState().info).not.toBeNull()

    rerender(false)
    expect(useVrGameOver.getState().info).toBeNull()
  })

  it('restarts through the current closure, never a stale one', () => {
    // the panel is published once, but `start` is redefined every render and
    // closes over the level config — firing an old one would replay the wrong
    // level
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(
      (onRestart: () => void) => useVrGameOverPanel({ ...base, over: true, onRestart }),
      { initialProps: first },
    )

    rerender(second)
    useVrGameOver.getState().info!.onPlay()

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('changes the level for that game only, without starting a round', () => {
    const start = vi.fn()
    renderHook(() => useVrGameOverPanel({ ...base, over: true, onRestart: start }))

    useVrGameOver.getState().info!.onSelectLevel('hard')

    expect(useSettings.getState().difficulty.museum360).toBe('hard')
    expect(useSettings.getState().difficulty.park360).toBe('easy')
    // selecting must not begin the round — `start` closes over the level from
    // the previous render, so it would run on the old one
    expect(start).not.toHaveBeenCalled()
  })

  it('does not leave a finished panel behind for the next game', () => {
    const { unmount } = renderHook(() =>
      useVrGameOverPanel({ ...base, over: true, onRestart: () => {} }),
    )
    expect(useVrGameOver.getState().info).not.toBeNull()

    unmount()
    expect(useVrGameOver.getState().info).toBeNull()
  })
})
