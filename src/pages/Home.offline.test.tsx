import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Home } from './Home'
import { useOffline } from '../state/offline'
import { useAuth } from '../state/auth'
import * as analytics from '../services/analytics'

beforeEach(() => {
  useOffline.setState({ offlineMode: true })
  useAuth.setState({ students: [], activeStudentId: null, loadStudents: vi.fn() as any })
})

describe('Home in offline mode', () => {
  it('hides the participant banner and does not fetch progress', () => {
    const getProgress = vi.spyOn(analytics.analytics, 'getProgress')
    render(<MemoryRouter><Home /></MemoryRouter>)
    expect(screen.queryByText(/current participant/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/choose a participant/i)).not.toBeInTheDocument()
    expect(getProgress).not.toHaveBeenCalled()
  })
})
