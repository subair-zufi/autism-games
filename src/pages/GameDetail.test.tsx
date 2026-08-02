import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../services/analytics', () => ({
  analytics: {
    getProgress: vi.fn(async () => []),
  },
}))
vi.mock('../services/sounds', () => ({ playTap: vi.fn() }))

import { useAuth } from '../state/auth'
import { GameDetail } from './GameDetail'

function renderCalmCrew() {
  return render(
    <MemoryRouter initialEntries={['/games/calmcrew']}>
      <Routes>
        <Route path="/games/:gameId" element={<GameDetail />} />
        <Route path="/calm-crew" element={<div>navigated-to-game</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('GameDetail unrecorded-play guard', () => {
  beforeEach(() => {
    useAuth.setState({ students: [], activeStudentId: null })
  })

  it('never lets the ordinary Play button fall through unrecorded on a repeat tap', () => {
    renderCalmCrew()
    const playBtn = screen.getByRole('button', { name: /play/i })
    fireEvent.click(playBtn) // reveals the guard
    fireEvent.click(playBtn) // repeat tap on the SAME button must not bypass it
    fireEvent.click(playBtn)
    expect(screen.queryByText('navigated-to-game')).toBeNull()
    expect(screen.getByText('No participant selected')).toBeInTheDocument()
  })

  it('only the explicit "Play without recording" button proceeds unrecorded', () => {
    renderCalmCrew()
    fireEvent.click(screen.getByRole('button', { name: /play/i }))
    fireEvent.click(screen.getByRole('button', { name: /play without recording/i }))
    expect(screen.getByText('navigated-to-game')).toBeInTheDocument()
  })
})
