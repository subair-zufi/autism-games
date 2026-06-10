# Phase 1: Scaffold + Home Page + Shared Kit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A running Vite + React + TypeScript app with a home page (4 game cards + settings) and the shared kit (settings store, scores store, speech service, sounds service, shared UI components) that all four games will build on.

**Architecture:** Single-page app, React Router for navigation, zustand stores persisted to localStorage, Web Speech API wrapper with graceful fallback, WebAudio-synthesized sound effects (no audio files). Game routes are placeholders in this phase; each game is added as an isolated module in later phases.

**Tech Stack:** Vite, React 18, TypeScript, react-router-dom, zustand, three + @react-three/fiber + @react-three/drei (installed now, used from Phase 2), Vitest + jsdom.

**Spec:** `docs/superpowers/specs/2026-06-10-otist-games-design.md`

---

## File Structure

```
index.html
package.json / vite.config.ts / tsconfig.json
src/
  main.tsx                 — entry, router
  App.tsx                  — routes: /, /emotions, /zebra, /garden, /balldrop
  types.ts                 — GameId, Difficulty, GAME_LIST metadata
  styles/global.css        — calm palette, big touch targets, shared classes
  state/settings.ts        — zustand: voiceOn, soundOn, difficulty per game (persisted)
  state/scores.ts          — zustand: best score per game (persisted)
  services/speech.ts       — speak(text), speechAvailable(), respects voiceOn
  services/sounds.ts       — playSuccess/playGentle/playTap via WebAudio, respects soundOn
  components/PromptBanner.tsx   — instruction text + repeat-speech button
  components/ScoreBar.tsx       — score + lives display + home button (one top bar)
  components/GameOverDialog.tsx — friendly summary, play-again / home
  components/StartScreen.tsx    — game title + Easy/Medium/Hard picker + start
  components/ComingSoon.tsx     — placeholder for unbuilt game routes
  pages/Home.tsx           — 4 game cards + settings toggles
  state/settings.test.ts
  state/scores.test.ts
  services/speech.test.ts
```

### Task 1: Scaffold project

**Files:** Create Vite project in repo root.

- [ ] **Step 1:** Scaffold and install deps

```bash
npm create vite@latest . -- --template react-ts
npm install
npm install react-router-dom zustand three @react-three/fiber @react-three/drei
npm install -D vitest jsdom @types/three
```

- [ ] **Step 2:** Add to `package.json` scripts: `"test": "vitest run"`. Add to `vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom' },
})
```

- [ ] **Step 3:** Delete Vite demo cruft (`src/App.css`, `src/assets/react.svg`, demo content of `App.tsx`). Set `<title>Otist Games</title>` and `<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">` in `index.html`.

- [ ] **Step 4:** Verify: `npm run dev` serves a page; `npm run build` succeeds. Commit: `chore: scaffold vite react-ts app with deps`

### Task 2: Types + game metadata

**Files:** Create `src/types.ts`

- [ ] **Step 1:** Write the module

```ts
export type GameId = 'emotions' | 'zebra' | 'garden' | 'balldrop'
export type Difficulty = 'easy' | 'medium' | 'hard'

export interface GameMeta {
  id: GameId
  title: string
  icon: string // emoji
  path: string
  color: string // card accent
}

export const GAME_LIST: GameMeta[] = [
  { id: 'emotions', title: 'Feelings Faces', icon: '😊', path: '/emotions', color: '#f6c177' },
  { id: 'zebra',    title: 'Cross the Road', icon: '🚦', path: '/zebra',    color: '#9ccfd8' },
  { id: 'garden',   title: 'Garden Finder',  icon: '🦋', path: '/garden',   color: '#a3be8c' },
  { id: 'balldrop', title: 'Ball Drop',      icon: '🔴', path: '/balldrop', color: '#c4a7e7' },
]
```

- [ ] **Step 2:** Commit: `feat: game metadata types`

### Task 3: Settings store (TDD)

**Files:** Create `src/state/settings.ts`, `src/state/settings.test.ts`

- [ ] **Step 1:** Failing test

```ts
import { beforeEach, expect, test } from 'vitest'
import { useSettings } from './settings'

beforeEach(() => {
  localStorage.clear()
  useSettings.setState(useSettings.getInitialState())
})

test('defaults: voice on, sound on, easy difficulty everywhere', () => {
  const s = useSettings.getState()
  expect(s.voiceOn).toBe(true)
  expect(s.soundOn).toBe(true)
  expect(s.difficulty.emotions).toBe('easy')
})

test('setDifficulty updates one game only', () => {
  useSettings.getState().setDifficulty('zebra', 'hard')
  expect(useSettings.getState().difficulty.zebra).toBe('hard')
  expect(useSettings.getState().difficulty.garden).toBe('easy')
})

test('persists to localStorage', () => {
  useSettings.getState().setVoiceOn(false)
  expect(JSON.parse(localStorage.getItem('otist-settings')!).state.voiceOn).toBe(false)
})
```

- [ ] **Step 2:** Run `npm test -- settings` — expect FAIL (module missing).
- [ ] **Step 3:** Implement

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Difficulty, GameId } from '../types'

interface SettingsState {
  voiceOn: boolean
  soundOn: boolean
  difficulty: Record<GameId, Difficulty>
  setVoiceOn: (v: boolean) => void
  setSoundOn: (v: boolean) => void
  setDifficulty: (game: GameId, d: Difficulty) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      voiceOn: true,
      soundOn: true,
      difficulty: { emotions: 'easy', zebra: 'easy', garden: 'easy', balldrop: 'easy' },
      setVoiceOn: (voiceOn) => set({ voiceOn }),
      setSoundOn: (soundOn) => set({ soundOn }),
      setDifficulty: (game, d) =>
        set((s) => ({ difficulty: { ...s.difficulty, [game]: d } })),
    }),
    { name: 'otist-settings' },
  ),
)
```

- [ ] **Step 4:** Run `npm test -- settings` — expect PASS.
- [ ] **Step 5:** Commit: `feat: settings store with persistence`

### Task 4: Scores store (TDD)

**Files:** Create `src/state/scores.ts`, `src/state/scores.test.ts`

- [ ] **Step 1:** Failing test

```ts
import { beforeEach, expect, test } from 'vitest'
import { useScores } from './scores'

beforeEach(() => {
  localStorage.clear()
  useScores.setState(useScores.getInitialState())
})

test('best defaults to 0', () => {
  expect(useScores.getState().best.emotions).toBe(0)
})

test('reportScore keeps the maximum', () => {
  useScores.getState().reportScore('emotions', 5)
  useScores.getState().reportScore('emotions', 3)
  expect(useScores.getState().best.emotions).toBe(5)
})
```

- [ ] **Step 2:** Run `npm test -- scores` — expect FAIL.
- [ ] **Step 3:** Implement

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GameId } from '../types'

interface ScoresState {
  best: Record<GameId, number>
  reportScore: (game: GameId, score: number) => void
}

export const useScores = create<ScoresState>()(
  persist(
    (set) => ({
      best: { emotions: 0, zebra: 0, garden: 0, balldrop: 0 },
      reportScore: (game, score) =>
        set((s) => ({ best: { ...s.best, [game]: Math.max(s.best[game], score) } })),
    }),
    { name: 'otist-scores' },
  ),
)
```

- [ ] **Step 4:** Run `npm test -- scores` — expect PASS.
- [ ] **Step 5:** Commit: `feat: best-scores store`

### Task 5: Speech service (TDD)

**Files:** Create `src/services/speech.ts`, `src/services/speech.test.ts`

- [ ] **Step 1:** Failing test (jsdom has no speechSynthesis; we stub it)

```ts
import { beforeEach, expect, test, vi } from 'vitest'
import { speak, speechAvailable } from './speech'
import { useSettings } from '../state/settings'

beforeEach(() => {
  useSettings.setState(useSettings.getInitialState())
})

test('speechAvailable false when API missing', () => {
  expect(speechAvailable()).toBe(false)
})

test('speak uses speechSynthesis when available and voice is on', () => {
  const fake = { cancel: vi.fn(), speak: vi.fn() }
  vi.stubGlobal('speechSynthesis', fake)
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} })
  speak('hello')
  expect(fake.speak).toHaveBeenCalled()
  vi.unstubAllGlobals()
})

test('speak does nothing when voice is off', () => {
  const fake = { cancel: vi.fn(), speak: vi.fn() }
  vi.stubGlobal('speechSynthesis', fake)
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} })
  useSettings.getState().setVoiceOn(false)
  speak('hello')
  expect(fake.speak).not.toHaveBeenCalled()
  vi.unstubAllGlobals()
})
```

- [ ] **Step 2:** Run `npm test -- speech` — expect FAIL.
- [ ] **Step 3:** Implement

```ts
import { useSettings } from '../state/settings'

export function speechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/** Speak text aloud (cancels anything still talking). No-ops when
 *  unavailable or voice is muted, so callers never need to check. */
export function speak(text: string) {
  if (!speechAvailable() || !useSettings.getState().voiceOn) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 0.9 // slightly slow, clearer for students
  u.lang = 'en-US'
  window.speechSynthesis.speak(u)
}
```

- [ ] **Step 4:** Run `npm test -- speech` — expect PASS.
- [ ] **Step 5:** Commit: `feat: speech service with fallback`

### Task 6: Sounds service

**Files:** Create `src/services/sounds.ts` (WebAudio is impractical in jsdom — verified by play-testing)

- [ ] **Step 1:** Implement

```ts
import { useSettings } from '../state/settings'

let ctx: AudioContext | null = null
function audio(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null
  ctx ??= new AudioContext()
  return ctx
}

/** Soft sine tone; gentle attack/decay so nothing is ever startling. */
function tone(freq: number, startAt: number, duration: number, peak = 0.15) {
  const ac = audio()
  if (!ac || !useSettings.getState().soundOn) return
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  const t = ac.currentTime + startAt
  osc.frequency.value = freq
  osc.type = 'sine'
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(peak, t + 0.03)
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
  osc.connect(gain).connect(ac.destination)
  osc.start(t)
  osc.stop(t + duration)
}

export const playSuccess = () => { tone(523, 0, 0.25); tone(659, 0.12, 0.25); tone(784, 0.24, 0.35) }
export const playGentle  = () => { tone(330, 0, 0.3, 0.08) }
export const playTap     = () => { tone(440, 0, 0.08, 0.06) }
```

- [ ] **Step 2:** `npm run build` passes. Commit: `feat: webaudio sound effects`

### Task 7: Global styles

**Files:** Create `src/styles/global.css`, import from `src/main.tsx`

- [ ] **Step 1:** Calm palette, big touch targets:

```css
:root {
  --bg: #fdf6ec;
  --card: #ffffff;
  --ink: #3f3a55;
  --ink-soft: #7a7494;
  --accent: #7fb6a4;
  --radius: 24px;
  font-family: 'Comic Sans MS', 'Chalkboard SE', 'Segoe UI', system-ui, sans-serif;
}
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body, #root { margin: 0; height: 100%; }
body { background: var(--bg); color: var(--ink); user-select: none; }
button { font: inherit; cursor: pointer; border: none; border-radius: var(--radius); }
.big-btn {
  min-height: 72px; min-width: 120px; padding: 14px 28px; font-size: 1.4rem;
  background: var(--accent); color: #fff;
  box-shadow: 0 6px 0 rgba(0,0,0,0.12); transition: transform 0.1s;
}
.big-btn:active { transform: translateY(3px); box-shadow: 0 3px 0 rgba(0,0,0,0.12); }
```

(Plus classes added alongside each component as built — keep all shared styling in this one file.)

- [ ] **Step 2:** Commit: `feat: global calm styles`

### Task 8: Shared UI components

**Files:** Create `src/components/ScoreBar.tsx`, `PromptBanner.tsx`, `GameOverDialog.tsx`, `StartScreen.tsx`, `ComingSoon.tsx` (presentational; verified by play-testing on Home + placeholder pages)

- [ ] **Step 1:** `ScoreBar` — one fixed top bar: home link (always visible), star score, heart lives.

```tsx
import { Link } from 'react-router-dom'

export function ScoreBar(props: { score: number; lives?: number; maxLives?: number }) {
  return (
    <div className="score-bar">
      <Link to="/" className="home-btn" aria-label="Home">🏠</Link>
      <span className="score">⭐ {props.score}</span>
      {props.lives !== undefined && (
        <span className="lives">
          {Array.from({ length: props.maxLives ?? 3 }, (_, i) => (
            <span key={i} style={{ opacity: i < props.lives! ? 1 : 0.25 }}>❤️</span>
          ))}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 2:** `PromptBanner` — instruction text, speaks on mount/change, repeat button hidden if speech unavailable.

```tsx
import { useEffect } from 'react'
import { speak, speechAvailable } from '../services/speech'

export function PromptBanner({ text }: { text: string }) {
  useEffect(() => { speak(text) }, [text])
  return (
    <div className="prompt-banner">
      <span>{text}</span>
      {speechAvailable() && (
        <button aria-label="Say it again" onClick={() => speak(text)}>🔊</button>
      )}
    </div>
  )
}
```

- [ ] **Step 3:** `StartScreen` — title, icon, Easy/Medium/Hard picker bound to settings store, big Start button calling `onStart()`.

```tsx
import { useSettings } from '../state/settings'
import type { Difficulty, GameMeta } from '../types'

const LEVELS: { id: Difficulty; label: string }[] = [
  { id: 'easy', label: 'Easy' }, { id: 'medium', label: 'Medium' }, { id: 'hard', label: 'Hard' },
]

export function StartScreen({ game, onStart }: { game: GameMeta; onStart: () => void }) {
  const difficulty = useSettings((s) => s.difficulty[game.id])
  const setDifficulty = useSettings((s) => s.setDifficulty)
  return (
    <div className="start-screen">
      <div className="start-icon">{game.icon}</div>
      <h1>{game.title}</h1>
      <div className="level-row">
        {LEVELS.map((l) => (
          <button key={l.id}
            className={difficulty === l.id ? 'level-btn selected' : 'level-btn'}
            onClick={() => setDifficulty(game.id, l.id)}>{l.label}</button>
        ))}
      </div>
      <button className="big-btn" onClick={onStart}>▶ Play</button>
    </div>
  )
}
```

- [ ] **Step 4:** `GameOverDialog` — friendly tone, never "you lost": "Great playing! You earned N stars." Shows best score, Play Again + Home buttons.

```tsx
import { Link } from 'react-router-dom'

export function GameOverDialog(props: { score: number; best: number; onRestart: () => void }) {
  return (
    <div className="overlay">
      <div className="dialog">
        <h2>Great playing! 🎉</h2>
        <p className="dialog-score">You earned ⭐ {props.score}</p>
        <p className="dialog-best">Your best: {props.best}</p>
        <button className="big-btn" onClick={props.onRestart}>Play again</button>
        <Link to="/" className="big-btn home-link">🏠 Home</Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 5:** `ComingSoon` — icon + "This game is coming soon!" + home button (used by unbuilt routes).
- [ ] **Step 6:** Add matching classes to `global.css` (score-bar fixed top, prompt-banner rounded card, overlay/dialog centered, level-btn pill with `.selected` accent).
- [ ] **Step 7:** `npm run build` + `npm test` pass. Commit: `feat: shared UI components`

### Task 9: Home page + routing

**Files:** Create `src/pages/Home.tsx`; rewrite `src/App.tsx`, `src/main.tsx`

- [ ] **Step 1:** `Home` — heading, 4 cards from `GAME_LIST` (icon, title, best score from scores store, link to path; gentle CSS 3D tilt on hover/press), settings row with voice 🔊 and sound 🎵 toggle buttons bound to settings store.
- [ ] **Step 2:** `App.tsx` routes: `/` → Home; each game path → `<ComingSoon game={meta}/>` for now.

```tsx
import { Route, Routes } from 'react-router-dom'
import { Home } from './pages/Home'
import { ComingSoon } from './components/ComingSoon'
import { GAME_LIST } from './types'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      {GAME_LIST.map((g) => (
        <Route key={g.id} path={g.path} element={<ComingSoon game={g} />} />
      ))}
    </Routes>
  )
}
```

`main.tsx` wraps `<App/>` in `<HashRouter>` (hash routing → works when opened from a local static server without URL rewrites) and imports `styles/global.css`.

- [ ] **Step 3:** Play-test: home renders 4 cards, toggles persist across reload, cards navigate to Coming Soon pages, home button returns.
- [ ] **Step 4:** `npm run build` + `npm test` pass. Commit: `feat: home page and routing`

## Self-review notes

- Spec coverage for Phase 1 scope (spec §1, §2, §3, §5, §7 fallbacks): all mapped to tasks 1–9. Games (§4) are Phases 2–5 with their own plans.
- WebGL-unavailable message (spec §7) is deferred to Phase 2 when the first Canvas appears — noted here so it isn't lost.
- Types/names consistent: `useSettings`, `useScores`, `speak`, `speechAvailable`, `playSuccess/playGentle/playTap`, `GAME_LIST`.
