import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PlayOffline } from './PlayOffline'
import { useOffline } from '../state/offline'
import * as cache from '../services/offlineCache'

const manifest = [{ url: 'videos/a.mp4', bytes: 100 }]

beforeEach(() => {
  vi.restoreAllMocks()
  useOffline.setState({ offlineMode: false })
  vi.spyOn(cache, 'loadManifest').mockResolvedValue(manifest as any)
})

function renderPage() {
  return render(<MemoryRouter><PlayOffline /></MemoryRouter>)
}

describe('PlayOffline', () => {
  it('shows the Start button immediately when already fully cached', async () => {
    vi.spyOn(cache, 'isFullyCached').mockResolvedValue(true)
    renderPage()
    expect(await screen.findByRole('button', { name: /start/i })).toBeInTheDocument()
  })

  it('offers download when not cached, then downloads and shows Start', async () => {
    vi.spyOn(cache, 'isFullyCached').mockResolvedValue(false)
    vi.spyOn(cache, 'estimateStorage').mockResolvedValue({ needed: 100, available: 1e9, fits: true })
    vi.spyOn(cache, 'downloadAll').mockImplementation(async (_m, onProgress) => {
      onProgress(100, 100)
    })
    renderPage()
    const dl = await screen.findByRole('button', { name: /download/i })
    await userEvent.click(dl)
    expect(await screen.findByRole('button', { name: /start/i })).toBeInTheDocument()
  })

  it('warns when storage will not fit', async () => {
    vi.spyOn(cache, 'isFullyCached').mockResolvedValue(false)
    vi.spyOn(cache, 'estimateStorage').mockResolvedValue({ needed: 3e8, available: 1e7, fits: false })
    renderPage()
    expect(await screen.findByText(/not enough storage/i)).toBeInTheDocument()
  })

  it('Start enables offline mode', async () => {
    vi.spyOn(cache, 'isFullyCached').mockResolvedValue(true)
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /start/i }))
    await waitFor(() => expect(useOffline.getState().offlineMode).toBe(true))
  })
})
