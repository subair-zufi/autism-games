import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../services/analytics', () => ({
  analytics: {
    listStudents: vi.fn(async () => []),
    setActiveStudent: vi.fn(),
    get activeStudentId() {
      return null
    },
  },
}))

import { useAuth } from '../state/auth'
import { Participants } from './Participants'

const student = (id: string, full_name: string) => ({
  id,
  mentor_id: 'm',
  full_name,
  date_of_birth: null,
  notes: null,
  avatar: null,
  is_active: true,
  created_at: 'now',
})

describe('Participants select button', () => {
  beforeEach(() => {
    useAuth.setState({
      students: [student('s1', 'Ada'), student('s2', 'Bea')] as any,
      activeStudentId: 's1',
    })
  })

  it('disables the already-active participant\'s button so a stray tap cannot deselect them', () => {
    render(
      <MemoryRouter>
        <Participants />
      </MemoryRouter>,
    )
    const selected = screen.getByRole('button', { name: 'Selected' })
    expect(selected).toBeDisabled()
    fireEvent.click(selected)
    expect(useAuth.getState().activeStudentId).toBe('s1')
  })

  it('selecting a different participant switches the active id, never to null', () => {
    render(
      <MemoryRouter>
        <Participants />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    expect(useAuth.getState().activeStudentId).toBe('s2')
  })
})
