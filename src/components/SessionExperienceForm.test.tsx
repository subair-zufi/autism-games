import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

type Sent = Record<string, unknown>

const submit = vi.fn<(input: Sent) => Promise<{ saved: boolean; queued: boolean }>>(async () => ({
  saved: true,
  queued: false,
}))
const list = vi.fn<(studentId: string) => Promise<unknown[]>>(async () => [])

vi.mock('../services/analytics', () => ({
  analytics: {
    submitSessionExperience: (input: Sent) => submit(input),
    listSessionExperience: (studentId: string) => list(studentId),
  },
}))

import { SessionExperienceForm } from './SessionExperienceForm'

function open(props: Partial<Parameters<typeof SessionExperienceForm>[0]> = {}) {
  render(
    <SessionExperienceForm studentId="s-1" studentName="Asha" gamesPlayed={['museum360']} {...props} />,
  )
  fireEvent.click(screen.getByRole('button', { name: /end-of-session record/i }))
}

describe('SessionExperienceForm', () => {
  beforeEach(() => {
    submit.mockClear()
    submit.mockResolvedValue({ saved: true, queued: false })
    list.mockClear()
    list.mockResolvedValue([])
  })

  it('stays collapsed until the trainer opens it, so it cannot be tapped mid-session', () => {
    render(<SessionExperienceForm studentId="s-1" studentName="Asha" />)
    expect(screen.queryByText(/how much fun/i)).not.toBeInTheDocument()
  })

  it('asks all eleven questions', () => {
    open()
    expect(screen.getByText(/how much fun was it today/i)).toBeInTheDocument()
    expect(screen.getByText(/how well do you feel now/i)).toBeInTheDocument()
    expect(screen.getByText(/play again next time/i)).toBeInTheDocument()
    for (const item of [/^Engagement —/, /^Independence —/, /^Comfort —/, /^Enjoyment —/, /^Willingness —/]) {
      expect(screen.getByText(item)).toBeInTheDocument()
    }
    expect(screen.getByText(/what went well today/i)).toBeInTheDocument()
    expect(screen.getByText(/what was difficult today/i)).toBeInTheDocument()
    expect(screen.getByText(/different from the last session/i)).toBeInTheDocument()
  })

  it('sends the answers with the child and the games the visit covered', async () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: /^fun: 5 — very much$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Yes$/ }))
    fireEvent.click(screen.getByRole('button', { name: /save record/i }))

    await waitFor(() => expect(submit).toHaveBeenCalled())
    const sent = submit.mock.calls[0][0]
    expect(sent.student_id).toBe('s-1')
    expect(sent.child_fun).toBe(5)
    expect(sent.child_play_again).toBe('yes')
    expect(sent.games_played).toEqual(['museum360'])
    expect(sent.visit_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('shows the stop rule the moment the child reports feeling unwell', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: /^feeling: 2 — a little$/i }))
    expect(screen.getByText(/stop rule/i)).toBeInTheDocument()
  })

  it('tells the trainer when a record is only saved on the device', async () => {
    submit.mockResolvedValue({ saved: false, queued: true })
    open()
    fireEvent.click(screen.getByRole('button', { name: /save record/i }))

    await waitFor(() =>
      expect(screen.getByText(/saved on this device/i)).toBeInTheDocument(),
    )
  })

  it('saves a stopped session, which is a finding rather than a gap', async () => {
    open()
    fireEvent.click(screen.getByLabelText(/the session stopped early/i))
    fireEvent.change(screen.getByLabelText(/why did it stop/i), {
      target: { value: 'Took the headset off at eight minutes.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save record/i }))

    await waitFor(() => expect(submit).toHaveBeenCalled())
    const sent = submit.mock.calls[0][0]
    expect(sent.stopped_early).toBe(true)
    expect(sent.stop_reason).toMatch(/eight minutes/)
  })

  it('shows what was written last time, so the change question can be answered', async () => {
    list.mockResolvedValue([
      { id: '1', visit_date: '2026-09-01', is_second_rating: false, different_from_last: 'Needed two prompts.' },
    ])
    open()
    await waitFor(() => expect(screen.getByText(/needed two prompts/i)).toBeInTheDocument())
  })

  it('marks an independent second rating separately, for reliability', async () => {
    open()
    fireEvent.click(screen.getByLabelText(/independent second rating/i))
    fireEvent.change(screen.getByLabelText(/your rater id/i), { target: { value: 'coder-2' } })
    fireEvent.click(screen.getByRole('button', { name: /save record/i }))

    await waitFor(() => expect(submit).toHaveBeenCalled())
    const sent = submit.mock.calls[0][0]
    expect(sent.is_second_rating).toBe(true)
    expect(sent.rater_id).toBe('coder-2')
  })
})
