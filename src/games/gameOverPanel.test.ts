import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useVrGameOver, useVrGameOverPanel } from './gameOverPanel'

const base = {
  headline: 'Great playing! 🎉',
  score: 7,
  best: 12,
  stars: 2,
  lang: 'en' as const,
}

beforeEach(() => useVrGameOver.getState().hide())

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
    expect(info.playAgainLabel).toBeTruthy()
    expect(info.finishLabel).toBeTruthy()
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
    useVrGameOver.getState().info!.onRestart()

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
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
