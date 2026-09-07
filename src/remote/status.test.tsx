import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ScoreBar } from '../components/ScoreBar'
import { GameOverDialog } from '../components/GameOverDialog'
import { PromptBanner } from '../components/PromptBanner'
import { emitRemoteIntent, useRemoteIntent } from './intents'
import { readGameReport, resetGameReport, useRemoteReport } from './status'

vi.mock('../services/speech', () => ({
  speak: () => {},
  speechAvailable: () => false,
}))

afterEach(() => resetGameReport())

function Reporter({ report }: { report: Parameters<typeof useRemoteReport>[0] }) {
  useRemoteReport(report)
  return null
}

describe('what the trainer’s phone is told', () => {
  it('merges what several components report at once', () => {
    render(
      <>
        <Reporter report={{ phase: 'playing', score: 4 }} />
        <Reporter report={{ prompt: 'Who feels happy?' }} />
      </>,
    )
    expect(readGameReport()).toEqual({ phase: 'playing', score: 4, prompt: 'Who feels happy?' })
  })

  it('lets a later screen win — a result panel over a running game', () => {
    render(
      <>
        <Reporter report={{ phase: 'playing', score: 4 }} />
        <Reporter report={{ phase: 'over' }} />
      </>,
    )
    expect(readGameReport().phase).toBe('over')
    expect(readGameReport().score).toBe(4)
  })

  it('takes away only its own fields when it unmounts', () => {
    const { rerender } = render(
      <>
        <Reporter report={{ phase: 'playing', score: 4 }} />
        <Reporter report={{ prompt: 'Look around' }} />
      </>,
    )
    rerender(<Reporter report={{ phase: 'playing', score: 4 }} />)
    expect(readGameReport()).toEqual({ phase: 'playing', score: 4 })
  })

  it('follows changing values without remounting', () => {
    const { rerender } = render(<Reporter report={{ phase: 'playing', score: 1 }} />)
    rerender(<Reporter report={{ phase: 'playing', score: 9 }} />)
    expect(readGameReport().score).toBe(9)
  })
})

describe('the real shared components report themselves', () => {
  it('ScoreBar means a round is running, and carries the score', () => {
    render(
      <MemoryRouter>
        <ScoreBar score={7} progress="2 / 5" />
      </MemoryRouter>,
    )
    expect(readGameReport()).toMatchObject({ phase: 'playing', score: 7, progress: '2 / 5' })
  })

  it('ScoreBar builds a progress line from a goal when the game gives one', () => {
    render(
      <MemoryRouter>
        <ScoreBar score={3} goal={5} />
      </MemoryRouter>,
    )
    expect(readGameReport().progress).toBe('3 / 5')
  })

  it('PromptBanner passes on what the child was just asked', () => {
    render(<PromptBanner text="Find the happy face" />)
    expect(readGameReport().prompt).toBe('Find the happy face')
  })

  it('a finished round reads as over, not as still playing', () => {
    render(
      <MemoryRouter>
        <ScoreBar score={7} />
        <GameOverDialog score={7} best={9} onRestart={() => {}} />
      </MemoryRouter>,
    )
    expect(readGameReport().phase).toBe('over')
  })
})

describe('remote presses land on the screen that is up', () => {
  it('runs the same handler the child’s own button runs', async () => {
    const restart = vi.fn()
    render(
      <MemoryRouter>
        <GameOverDialog score={1} best={1} onRestart={restart} />
      </MemoryRouter>,
    )
    expect(emitRemoteIntent('restart')).toBe(1)
    expect(restart).toHaveBeenCalledTimes(1)

    // …and it is the same button, not a parallel path.
    await userEvent.click(screen.getByText('Play again'))
    expect(restart).toHaveBeenCalledTimes(2)
  })

  it('reaches nobody once the screen is gone', () => {
    const restart = vi.fn()
    const { unmount } = render(
      <MemoryRouter>
        <GameOverDialog score={1} best={1} onRestart={restart} />
      </MemoryRouter>,
    )
    unmount()
    expect(emitRemoteIntent('restart')).toBe(0)
    expect(restart).not.toHaveBeenCalled()
  })

  it('always runs the current handler, not the one from the first render', async () => {
    function Counter() {
      const [n, setN] = useState(0)
      useRemoteIntent('play', () => seen.push(n))
      return <button onClick={() => setN(n + 1)}>bump</button>
    }
    const seen: number[] = []
    render(<Counter />)
    await userEvent.click(screen.getByText('bump'))
    emitRemoteIntent('play')
    expect(seen).toEqual([1])
  })

  it('survives a handler that throws', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    function Boom() {
      useRemoteIntent('play', () => {
        throw new Error('nope')
      })
      return null
    }
    render(
      <>
        <Boom />
        <Boom />
      </>,
    )
    expect(() => emitRemoteIntent('play')).not.toThrow()
  })
})
