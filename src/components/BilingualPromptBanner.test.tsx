import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BilingualPromptBanner } from './BilingualPromptBanner'
import { readGameReport, resetGameReport } from '../remote/status'

vi.mock('../services/speech', () => ({
  speak: () => {},
  speechAvailable: () => true,
}))

afterEach(() => resetGameReport())

describe('the question band under a game', () => {
  it('shows the question and tells the trainer’s phone what it says', () => {
    render(
      <BilingualPromptBanner lines={[{ lang: 'en', text: 'Who feels happy?' }]} lang="en" />,
    )
    expect(screen.getByText('Who feels happy?')).toBeInTheDocument()
    expect(readGameReport().prompt).toBe('Who feels happy?')
  })

  it('reports the question in the language the child is being asked in', () => {
    render(
      <BilingualPromptBanner
        lines={[{ lang: 'ml', text: 'ആർക്കാണ് സന്തോഷം?' }]}
        lang="ml"
      />,
    )
    expect(readGameReport().prompt).toBe('ആർക്കാണ് സന്തോഷം?')
  })

  it('replays the question when asked', async () => {
    const onSpeak = vi.fn()
    render(
      <BilingualPromptBanner
        lines={[{ lang: 'en', text: 'Who feels sad?' }]}
        lang="en"
        onSpeak={onSpeak}
      />,
    )
    await userEvent.click(screen.getByRole('button'))
    expect(onSpeak).toHaveBeenCalledTimes(1)
  })

  it('leaves the replay button out when the game is not offering one', () => {
    render(<BilingualPromptBanner lines={[{ lang: 'en', text: 'Watch' }]} lang="en" />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('stops reporting once the question is off screen', () => {
    const { unmount } = render(
      <BilingualPromptBanner lines={[{ lang: 'en', text: 'Who feels angry?' }]} lang="en" />,
    )
    unmount()
    expect(readGameReport().prompt).toBeUndefined()
  })
})

describe('no game keeps its own copy of the question band', () => {
  it('is how the trainer’s phone ends up showing the question for every game', () => {
    // Seven games had their own copy of this markup, and only the ones using a
    // shared component were reporting the question to the console — so the
    // trainer could see it in some games and not others. A new game that
    // copy-pastes the markup would quietly drop off their screen again.
    const offenders: string[] = []
    for (const file of tsxFiles('src/games')) {
      if (readFileSync(file, 'utf8').includes('prompt-banner er-prompt')) offenders.push(file)
    }
    expect(offenders).toEqual([])
  })
})

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return tsxFiles(path)
    return entry.name.endsWith('.tsx') ? [path] : []
  })
}
