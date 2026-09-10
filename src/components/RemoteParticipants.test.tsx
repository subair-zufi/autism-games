import { MemoryRouter } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RemoteParticipants } from './RemoteParticipants'
import { useAuth } from '../state/auth'
import type { Student } from '../services/analytics'

function student(id: string, full_name: string, extra: Partial<Student> = {}): Student {
  return {
    id,
    mentor_id: 'm1',
    full_name,
    date_of_birth: null,
    notes: null,
    avatar: null,
    gender: null,
    parent_guardian_name: null,
    parent_contact: null,
    autism_level: null,
    iq_score: null,
    rehabilitation_centre: null,
    participant_code: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    ...extra,
  }
}

const AARAV = student('s1', 'Aarav')
const MEERA = student('s2', 'Meera', { autism_level: 'Level 2' })

let confirmResult = true

beforeEach(() => {
  confirmResult = true
  vi.stubGlobal('confirm', () => confirmResult)
  useAuth.setState({
    isLoggedIn: true,
    students: [AARAV, MEERA],
    activeStudentId: 's1',
    loadStudents: vi.fn(async () => {}),
    addStudent: vi.fn(async () => student('s3', 'Ravi')),
    removeStudent: vi.fn(async () => {}),
  })
})

afterEach(() => vi.unstubAllGlobals())

function renderPanel(activeId: string | null = 's1') {
  const onSelect = vi.fn()
  render(
    <MemoryRouter>
      <RemoteParticipants activeId={activeId} onSelect={onSelect} />
    </MemoryRouter>,
  )
  return onSelect
}

describe('choosing who the session records against', () => {
  it('lists the mentor’s participants and the unrecorded option', () => {
    renderPanel()
    expect(screen.getByText('Aarav')).toBeInTheDocument()
    expect(screen.getByText('Meera')).toBeInTheDocument()
    expect(screen.getByText('Not recording')).toBeInTheDocument()
  })

  it('sends the choice to the headset', async () => {
    const onSelect = renderPanel()
    await userEvent.click(screen.getByText('Meera'))
    expect(onSelect).toHaveBeenCalledWith('s2')

    await userEvent.click(screen.getByText('Not recording'))
    expect(onSelect).toHaveBeenCalledWith(null)
  })
})

describe('adding a participant mid-session', () => {
  it('saves the name plus the fields the study groups by, and selects them', async () => {
    const onSelect = renderPanel()
    await userEvent.click(screen.getByText('＋ Add participant'))

    await userEvent.type(screen.getByLabelText('Full name'), 'Ravi')
    await userEvent.selectOptions(screen.getByLabelText('Gender'), 'Male')
    await userEvent.selectOptions(screen.getByLabelText('Autism level'), 'Level 1')
    await userEvent.click(screen.getByText('Add and select'))

    await waitFor(() =>
      expect(useAuth.getState().addStudent).toHaveBeenCalledWith({
        full_name: 'Ravi',
        date_of_birth: null,
        gender: 'Male',
        autism_level: 'Level 1',
      }),
    )
    // A child added while they are already in the headset is the one being run.
    expect(onSelect).toHaveBeenCalledWith('s3')
  })

  it('will not save an empty name', async () => {
    renderPanel()
    await userEvent.click(screen.getByText('＋ Add participant'))
    expect(screen.getByText('Add and select')).toBeDisabled()
  })

  it('says so when the server refuses, and keeps what was typed', async () => {
    useAuth.setState({
      addStudent: vi.fn(async () => {
        throw new Error('Network is down')
      }),
    })
    renderPanel()
    await userEvent.click(screen.getByText('＋ Add participant'))
    await userEvent.type(screen.getByLabelText('Full name'), 'Ravi')
    await userEvent.click(screen.getByText('Add and select'))

    await waitFor(() => expect(screen.getByText('Network is down')).toBeInTheDocument())
    expect(screen.getByLabelText('Full name')).toHaveValue('Ravi')
  })

  it('closes the form on cancel without saving', async () => {
    renderPanel()
    await userEvent.click(screen.getByText('＋ Add participant'))
    await userEvent.type(screen.getByLabelText('Full name'), 'Ravi')
    await userEvent.click(screen.getByText('Cancel'))

    expect(useAuth.getState().addStudent).not.toHaveBeenCalled()
    expect(screen.getByText('＋ Add participant')).toBeInTheDocument()
  })
})

describe('removing a participant', () => {
  it('asks first, then removes', async () => {
    renderPanel()
    await userEvent.click(screen.getByLabelText('Remove Meera'))
    await waitFor(() => expect(useAuth.getState().removeStudent).toHaveBeenCalledWith('s2'))
  })

  it('does nothing if the trainer changes their mind', async () => {
    confirmResult = false
    renderPanel()
    await userEvent.click(screen.getByLabelText('Remove Meera'))
    expect(useAuth.getState().removeStudent).not.toHaveBeenCalled()
  })

  it('stops the headset recording against someone who was just removed', async () => {
    const onSelect = renderPanel('s1')
    await userEvent.click(screen.getByLabelText('Remove Aarav'))
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(null))
  })

  it('leaves the recording alone when someone else is removed', async () => {
    const onSelect = renderPanel('s1')
    await userEvent.click(screen.getByLabelText('Remove Meera'))
    await waitFor(() => expect(useAuth.getState().removeStudent).toHaveBeenCalled())
    expect(onSelect).not.toHaveBeenCalled()
  })
})
