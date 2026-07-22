import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { Login } from './Login'

describe('Login offline entry', () => {
  it('shows a Play Offline link pointing at /play-offline', () => {
    render(<MemoryRouter><Login /></MemoryRouter>)
    const link = screen.getByRole('link', { name: /play offline/i })
    expect(link).toHaveAttribute('href', '/play-offline')
  })
})
