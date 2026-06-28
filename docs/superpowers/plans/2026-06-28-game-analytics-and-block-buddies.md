# Game Analytics Wiring + Block Buddies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the optional analytics API into all 12 games and rebuild "Block Buddies" as a multi-peer turn-taking game, recording only the logged-in child.

**Architecture:** A no-op-when-logged-out analytics client (`src/services/analytics.ts`) is wrapped by a zustand auth store (`src/state/auth.ts`) for the UI and a `useGameAnalytics(gameKey)` hook for games. Games call `recordStep`/`finishGame` unconditionally; the client silently skips when there is no token. Block Buddies replaces the single robot with N simulated peers, each with a button; only the child's button is interactive and only the child's actions are recorded.

**Tech Stack:** React 19, TypeScript, Vite, Zustand, React Router (HashRouter), Vitest, react-three-fiber/three (3D scenes), FastAPI server (unchanged).

## Global Constraints

- Login is OPTIONAL. Every analytics call MUST be a silent no-op when no token exists; gameplay MUST never depend on or be broken by the network.
- Server URL comes from the Vite env var `VITE_ANALYTICS_API` (empty string = same origin).
- Do NOT change the server API surface; the existing endpoints are sufficient.
- Token storage key is `ag_player_token` in `localStorage` (matches the server's client doc).
- Follow existing game patterns: every game has `start()`, action handlers, and calls `reportScore(gameId, score)` at game over. Reuse `ScoreBar`, `PromptBanner`, `GameOverDialog`, `WebGLGate`, `StartScreen`, `useScores`, `useSettings`.
- Tests run with Vitest: `npm test` (alias for `vitest run`). Run a single file with `npx vitest run <path>`.
- `event_type` and `game_key` are <= 80 chars (server limit). `game_key` MUST equal the `GameId`.

---

## File Structure

- Create `src/services/analytics.ts` — analytics client (copied from `server/docs/frontend-analytics-client.ts`), exports `analytics`, `SignupInput`, `PlayerUser`.
- Create `src/state/auth.ts` — zustand auth store wrapping the client.
- Create `src/pages/Login.tsx` — login/sign-up page.
- Modify `src/App.tsx` — register `/login` route, hydrate auth on mount.
- Modify `src/pages/Home.tsx` — "Sign in"/player chip.
- Create `src/games/useGameAnalytics.ts` — per-game hook.
- Create `src/games/useGameAnalytics.test.ts` — hook tests.
- Modify each `src/games/<game>/<Game>.tsx` — instrument start/action/over.
- Modify `src/games/blocks/logic.ts` + `logic.test.ts` — multi-peer turn model.
- Modify `src/games/blocks/BlockGame.tsx` — multi-peer state machine + player buttons.
- Modify `src/games/blocks/BlockScene.tsx` — render peer avatars.
- Modify `src/styles/global.css` — styles for login chip/page and player buttons.
- Create `.env.development`, `.env.example` (repo root) — `VITE_ANALYTICS_API`.

---

## Task 1: Analytics client

**Files:**
- Create: `src/services/analytics.ts`
- Create: `.env.development`, `.env.example` (repo root)

**Interfaces:**
- Produces: `analytics` singleton with: `get isLoggedIn(): boolean`, `signup(input: SignupInput): Promise<AuthResponse>`, `login(email, password): Promise<AuthResponse>`, `me(): Promise<PlayerUser | null>`, `logout(): void`, `startSession(gameKey: string): Promise<string | null>`, `endSession(sessionId: string, finalScore?: number): Promise<void>`, `recordStep(gameKey: string, eventType: string, payload?: Record<string, unknown>, opts?: { stepIndex?: number; score?: number; sessionId?: string }): Promise<void>`.
- Produces types: `SignupInput`, `PlayerUser`, `AuthResponse`.

- [ ] **Step 1: Copy the ready-made client.**

Copy the full contents of `server/docs/frontend-analytics-client.ts` into a new file `src/services/analytics.ts` verbatim. It already implements every method above with the no-op-when-logged-out behaviour and error-swallowing in `recordStep`. Export the types by changing the two interface lines so they are exported:

```ts
export interface AuthResponse {
  access_token: string;
  token_type: string;
  created: boolean;
  user: PlayerUser;
}
```

(`SignupInput` and `PlayerUser` are already exported in the source file.)

- [ ] **Step 2: Add env files.**

Create `.env.development` (repo root):

```
VITE_ANALYTICS_API=http://localhost:8000
```

Create `.env.example` (repo root):

```
# Base URL of the analytics server. Leave empty for same-origin.
# Local dev: http://localhost:8000   Production: your Railway URL.
VITE_ANALYTICS_API=
```

- [ ] **Step 3: Verify it type-checks.**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Commit.**

```bash
git add src/services/analytics.ts .env.development .env.example
git commit -m "feat: add analytics client + VITE_ANALYTICS_API config"
```

---

## Task 2: Auth store

**Files:**
- Create: `src/state/auth.ts`
- Test: `src/state/auth.test.ts`

**Interfaces:**
- Consumes: `analytics`, `SignupInput`, `PlayerUser` from `src/services/analytics.ts`.
- Produces: `useAuth` zustand store with state `{ user: PlayerUser | null; isLoggedIn: boolean; status: 'idle' | 'loading' | 'error'; error: string | null }` and actions `hydrate(): Promise<void>`, `signup(input: SignupInput): Promise<boolean>`, `login(email: string, password: string): Promise<boolean>`, `logout(): void`. `signup`/`login` return `true` on success, `false` on failure (and set `error`).

- [ ] **Step 1: Write the failing test.**

Create `src/state/auth.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../services/analytics', () => {
  const user = { id: '1', email: 'a@b.com', full_name: 'Kid', city: null, education_level: null }
  return {
    analytics: {
      isLoggedIn: false,
      signup: vi.fn(async () => ({ access_token: 't', token_type: 'bearer', created: true, user })),
      login: vi.fn(async () => ({ access_token: 't', token_type: 'bearer', created: false, user })),
      me: vi.fn(async () => null),
      logout: vi.fn(),
    },
  }
})

import { useAuth } from './auth'
import { analytics } from '../services/analytics'

describe('useAuth', () => {
  beforeEach(() => {
    useAuth.setState({ user: null, isLoggedIn: false, status: 'idle', error: null })
    vi.clearAllMocks()
  })

  it('signup sets the user and logged-in state', async () => {
    const ok = await useAuth.getState().signup({ email: 'a@b.com', password: 'secret123' })
    expect(ok).toBe(true)
    expect(useAuth.getState().isLoggedIn).toBe(true)
    expect(useAuth.getState().user?.email).toBe('a@b.com')
  })

  it('signup surfaces an error and returns false on failure', async () => {
    ;(analytics.signup as any).mockRejectedValueOnce(new Error('That email already exists'))
    const ok = await useAuth.getState().signup({ email: 'a@b.com', password: 'wrong' })
    expect(ok).toBe(false)
    expect(useAuth.getState().isLoggedIn).toBe(false)
    expect(useAuth.getState().error).toMatch(/already exists/)
  })

  it('logout clears the user', () => {
    useAuth.setState({ user: { id: '1', email: 'a@b.com' } as any, isLoggedIn: true })
    useAuth.getState().logout()
    expect(analytics.logout).toHaveBeenCalled()
    expect(useAuth.getState().isLoggedIn).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails.**

Run: `npx vitest run src/state/auth.test.ts`
Expected: FAIL ("Cannot find module './auth'").

- [ ] **Step 3: Implement the store.**

Create `src/state/auth.ts`:

```ts
import { create } from 'zustand'
import { analytics, type PlayerUser, type SignupInput } from '../services/analytics'

interface AuthState {
  user: PlayerUser | null
  isLoggedIn: boolean
  status: 'idle' | 'loading' | 'error'
  error: string | null
  hydrate: () => Promise<void>
  signup: (input: SignupInput) => Promise<boolean>
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
}

export const useAuth = create<AuthState>()((set) => ({
  user: null,
  isLoggedIn: analytics.isLoggedIn,
  status: 'idle',
  error: null,

  hydrate: async () => {
    if (!analytics.isLoggedIn) return
    const user = await analytics.me()
    set({ user, isLoggedIn: !!user })
  },

  signup: async (input) => {
    set({ status: 'loading', error: null })
    try {
      const res = await analytics.signup(input)
      set({ user: res.user, isLoggedIn: true, status: 'idle' })
      return true
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : 'Sign-in failed' })
      return false
    }
  },

  login: async (email, password) => {
    set({ status: 'loading', error: null })
    try {
      const res = await analytics.login(email, password)
      set({ user: res.user, isLoggedIn: true, status: 'idle' })
      return true
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : 'Login failed' })
      return false
    }
  },

  logout: () => {
    analytics.logout()
    set({ user: null, isLoggedIn: false, status: 'idle', error: null })
  },
}))
```

- [ ] **Step 4: Run tests to verify they pass.**

Run: `npx vitest run src/state/auth.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit.**

```bash
git add src/state/auth.ts src/state/auth.test.ts
git commit -m "feat: add auth store wrapping the analytics client"
```

---

## Task 3: Login page + route + hydrate on startup

**Files:**
- Create: `src/pages/Login.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `useAuth` from `src/state/auth.ts`.
- Produces: a `/login` route component; `App` calls `useAuth.getState().hydrate()` once on mount.

- [ ] **Step 1: Create the Login page.**

Create `src/pages/Login.tsx`:

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/auth'

export function Login() {
  const navigate = useNavigate()
  const signup = useAuth((s) => s.signup)
  const login = useAuth((s) => s.login)
  const status = useAuth((s) => s.status)
  const error = useAuth((s) => s.error)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [city, setCity] = useState('')
  const [education, setEducation] = useState('')
  // After a 409 we offer an explicit "log in instead" action.
  const [showLogin, setShowLogin] = useState(false)

  async function onContinue(e: React.FormEvent) {
    e.preventDefault()
    const ok = await signup({
      email,
      password,
      full_name: fullName || undefined,
      city: city || undefined,
      education_level: education || undefined,
    })
    if (ok) navigate('/')
    else setShowLogin(true)
  }

  async function onLogin() {
    const ok = await login(email, password)
    if (ok) navigate('/')
  }

  const busy = status === 'loading'

  return (
    <div className="login-page">
      <button className="back-btn" onClick={() => navigate('/')}>← Back</button>
      <h1>Sign in</h1>
      <p className="login-sub">Signing in saves your progress. It's optional — you can play without it.</p>
      <form className="login-form" onSubmit={onContinue}>
        <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <label>Name (optional)<input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} /></label>
        <label>City (optional)<input type="text" value={city} onChange={(e) => setCity(e.target.value)} /></label>
        <label>Education (optional)<input type="text" value={education} onChange={(e) => setEducation(e.target.value)} /></label>
        {error && <p className="login-error">{error}</p>}
        <button className="login-submit" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : 'Continue'}
        </button>
        {showLogin && (
          <button className="login-alt" type="button" disabled={busy} onClick={onLogin}>
            Log in instead (this email already exists)
          </button>
        )}
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Register the route and hydrate on mount.**

Modify `src/App.tsx`. Add the import and a `useEffect`, and the `/login` route. The new `App` body:

```tsx
import { useEffect } from 'react'
// ...existing imports...
import { Login } from './pages/Login'
import { useAuth } from './state/auth'

// ...GAME_COMPONENTS unchanged...

export default function App() {
  useEffect(() => {
    useAuth.getState().hydrate()
  }, [])

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      {GAME_LIST.map((g) => {
        const Game = GAME_COMPONENTS[g.id]
        return (
          <Route key={g.id} path={g.path} element={Game ? <Game /> : <ComingSoon game={g} />} />
        )
      })}
    </Routes>
  )
}
```

- [ ] **Step 3: Add styles.**

Append to `src/styles/global.css`:

```css
/* --- Auth: login page + Home chip --- */
.login-page { max-width: 420px; margin: 0 auto; padding: 24px 16px; }
.login-page h1 { margin: 8px 0; }
.login-sub { color: #555; margin-bottom: 16px; }
.login-form { display: flex; flex-direction: column; gap: 12px; }
.login-form label { display: flex; flex-direction: column; gap: 4px; font-weight: 600; }
.login-form input { padding: 10px; border: 2px solid #ccc; border-radius: 10px; font-size: 16px; }
.login-error { color: #c0392b; font-weight: 600; }
.login-submit { padding: 12px; border: none; border-radius: 12px; background: #5aa9e6; color: #fff; font-size: 18px; font-weight: 700; cursor: pointer; }
.login-submit:disabled { opacity: .6; }
.login-alt { padding: 10px; border: 2px solid #5aa9e6; border-radius: 12px; background: #fff; color: #5aa9e6; font-weight: 700; cursor: pointer; }
.auth-chip { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 999px; border: 2px solid #5aa9e6; background: #fff; color: #2b6cb0; font-weight: 700; cursor: pointer; text-decoration: none; }
```

- [ ] **Step 4: Verify build.**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 5: Commit.**

```bash
git add src/pages/Login.tsx src/App.tsx src/styles/global.css
git commit -m "feat: add /login page, route, and auth hydrate on startup"
```

---

## Task 4: Home sign-in chip

**Files:**
- Modify: `src/pages/Home.tsx`

**Interfaces:**
- Consumes: `useAuth`.

- [ ] **Step 1: Add the chip.**

Modify `src/pages/Home.tsx`: import `useAuth` and add a chip in the header. Add imports:

```tsx
import { Link } from 'react-router-dom'
import { useAuth } from '../state/auth'
```

Inside `Home`, read auth state:

```tsx
  const isLoggedIn = useAuth((s) => s.isLoggedIn)
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
```

Replace the `<header>` block with:

```tsx
      <header className="home-header">
        <h1>Autism Games</h1>
        <p>Pick a game to play!</p>
        {isLoggedIn ? (
          <span className="auth-chip">
            👋 {user?.full_name || user?.email}
            <button className="link-btn" onClick={() => logout()}>Log out</button>
          </span>
        ) : (
          <Link to="/login" className="auth-chip" onClick={() => playTap()}>🔑 Sign in</Link>
        )}
      </header>
```

Append to `src/styles/global.css`:

```css
.link-btn { background: none; border: none; color: #2b6cb0; text-decoration: underline; cursor: pointer; font-weight: 700; padding: 0 0 0 4px; }
```

- [ ] **Step 2: Verify build.**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit.**

```bash
git add src/pages/Home.tsx src/styles/global.css
git commit -m "feat: add sign-in/player chip to Home"
```

---

## Task 5: useGameAnalytics hook

**Files:**
- Create: `src/games/useGameAnalytics.ts`
- Test: `src/games/useGameAnalytics.test.ts`

**Interfaces:**
- Consumes: `analytics` from `src/services/analytics.ts`, `GameId` from `src/types.ts`.
- Produces: `useGameAnalytics(gameKey: GameId): { recordStep: (eventType: string, payload?: Record<string, unknown>, opts?: { stepIndex?: number; score?: number }) => void; finishGame: (finalScore: number) => void; resetSession: () => void }`.

Behaviour: lazily `startSession` on the first `recordStep`/`finishGame` per run; cache `sessionId` in a ref; `finishGame` records a `game_over` event then `endSession(sessionId, score)` then clears the cached id; `resetSession` clears the cached id so the next call starts a new session. All calls are no-ops when logged out (the client handles that) and never throw.

- [ ] **Step 1: Write the failing test.**

Create `src/games/useGameAnalytics.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../services/analytics', () => ({
  analytics: {
    startSession: vi.fn(async () => 'sess-1'),
    endSession: vi.fn(async () => {}),
    recordStep: vi.fn(async () => {}),
  },
}))

import { useGameAnalytics } from './useGameAnalytics'
import { analytics } from '../services/analytics'

describe('useGameAnalytics', () => {
  beforeEach(() => vi.clearAllMocks())

  it('starts a session lazily on the first recordStep, then reuses it', async () => {
    const { result } = renderHook(() => useGameAnalytics('emotions'))
    await act(async () => { result.current.recordStep('answer', { correct: true }) })
    await act(async () => { result.current.recordStep('answer', { correct: false }) })
    expect(analytics.startSession).toHaveBeenCalledTimes(1)
    expect(analytics.recordStep).toHaveBeenCalledTimes(2)
    expect((analytics.recordStep as any).mock.calls[1][3]).toMatchObject({ sessionId: 'sess-1' })
  })

  it('finishGame records game_over and ends the session', async () => {
    const { result } = renderHook(() => useGameAnalytics('blocks'))
    await act(async () => { result.current.finishGame(7) })
    expect(analytics.recordStep).toHaveBeenCalledWith('blocks', 'game_over', undefined, expect.objectContaining({ score: 7 }))
    expect(analytics.endSession).toHaveBeenCalledWith('sess-1', 7)
  })
})
```

- [ ] **Step 2: Add the test dependency if missing.**

Run: `npx vitest run src/games/useGameAnalytics.test.ts`
If it fails with "Cannot find package '@testing-library/react'", install it:

```bash
npm install -D @testing-library/react
```

Then re-run; expected: FAIL ("Cannot find module './useGameAnalytics'").

- [ ] **Step 3: Implement the hook.**

Create `src/games/useGameAnalytics.ts`:

```ts
import { useCallback, useRef } from 'react'
import { analytics } from '../services/analytics'
import type { GameId } from '../types'

export function useGameAnalytics(gameKey: GameId) {
  const sessionId = useRef<string | null>(null)
  const starting = useRef<Promise<string | null> | null>(null)

  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (sessionId.current) return sessionId.current
    if (!starting.current) starting.current = analytics.startSession(gameKey)
    const id = await starting.current
    sessionId.current = id
    return id
  }, [gameKey])

  const recordStep = useCallback(
    (eventType: string, payload?: Record<string, unknown>, opts?: { stepIndex?: number; score?: number }) => {
      void ensureSession().then((id) =>
        analytics.recordStep(gameKey, eventType, payload, { ...opts, sessionId: id ?? undefined }),
      )
    },
    [gameKey, ensureSession],
  )

  const finishGame = useCallback(
    (finalScore: number) => {
      void ensureSession().then(async (id) => {
        await analytics.recordStep(gameKey, 'game_over', undefined, { score: finalScore, sessionId: id ?? undefined })
        if (id) await analytics.endSession(id, finalScore)
        sessionId.current = null
        starting.current = null
      })
    },
    [gameKey, ensureSession],
  )

  const resetSession = useCallback(() => {
    sessionId.current = null
    starting.current = null
  }, [])

  return { recordStep, finishGame, resetSession }
}
```

- [ ] **Step 4: Run tests to verify they pass.**

Run: `npx vitest run src/games/useGameAnalytics.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit.**

```bash
git add src/games/useGameAnalytics.ts src/games/useGameAnalytics.test.ts package.json package-lock.json
git commit -m "feat: add useGameAnalytics hook (lazy session + game_over)"
```

---

## Tasks 6–8: Instrument the games

For every game, the instrumentation follows the SAME three edits. Add to the game component:

1. Import + instantiate the hook (top of component):
   ```tsx
   import { useGameAnalytics } from '../useGameAnalytics'
   // inside the component, with the other hooks:
   const { recordStep, finishGame, resetSession } = useGameAnalytics('<gameId>')
   ```
2. In `start()`: call `resetSession()` as the first line (so a replay opens a new session).
3. At each **action** handler, after the existing success/failure branch logic, call `recordStep('answer', { correct: <bool>, ...detail })`.
4. At **every** place the game currently calls `reportScore('<gameId>', <score>)` (game over), add `finishGame(<sameScore>)` immediately after it.

`recordStep`/`finishGame` are fire-and-forget and no-op when logged out, so placement only needs to be at the logical moment — never wrap game logic in `await`.

The exact `<gameId>`, action event name, and payload per game are below. Group the work into three commits (Tasks 6/7/8) of four games each.

### Task 6: emotions, balldrop, garden, zebra

**Files:** `src/games/emotions/EmotionsGame.tsx`, `src/games/balldrop/BallDropGame.tsx`, `src/games/garden/GardenGame.tsx`, `src/games/zebra/ZebraGame.tsx`

- [ ] **Step 1: emotions** — `useGameAnalytics('emotions')`.
  - In `pick(id)`: in the correct branch (`id === round.target`) after `setScore((s) => s + 1)` add:
    ```tsx
    recordStep('answer', { correct: true, target: round.target, score: score + 1 }, { score: score + 1 })
    ```
    In the wrong branch after `setLives(next)` add:
    ```tsx
    recordStep('answer', { correct: false, target: round.target, picked: id })
    ```
    In the wrong branch, after the existing `reportScore('emotions', score)` add `finishGame(score)`.
  - In `start()` add `resetSession()` as the first line.

- [ ] **Step 2: balldrop** — `useGameAnalytics('balldrop')`.
  - In `handleLand(box)` correct branch after `setScore(nextScore)` add:
    ```tsx
    recordStep('answer', { correct: true, target, box, score: nextScore }, { score: nextScore })
    ```
    After the `reportScore('balldrop', nextScore)` line add `finishGame(nextScore)`.
  - In the wrong branch after `setLives(next)` add:
    ```tsx
    recordStep('answer', { correct: false, target, box })
    ```
    After the wrong-branch `reportScore('balldrop', score)` add `finishGame(score)`.
  - In `start()` add `resetSession()` as the first line.

- [ ] **Step 3: garden, zebra** — read each component, then apply the same pattern.
  - Use `useGameAnalytics('garden')` / `useGameAnalytics('zebra')`.
  - `resetSession()` at the top of `start()`.
  - At each scoring action, `recordStep('answer', { correct, ...gameDetail, score })`. Pick `...gameDetail` from that game's locals (e.g. the target/choice values it already has).
  - After every `reportScore('garden', s)` / `reportScore('zebra', s)`, add `finishGame(s)` with the same score expression.

- [ ] **Step 4: Verify build + tests.**

Run: `npx tsc -b && npm test`
Expected: tsc clean; existing game logic tests still pass.

- [ ] **Step 5: Commit.**

```bash
git add src/games/emotions src/games/balldrop src/games/garden src/games/zebra
git commit -m "feat: record analytics events in emotions/balldrop/garden/zebra"
```

### Task 7: mirror, museum, rightway, rulefixer

**Files:** the four `<Game>.tsx` under `src/games/mirror`, `src/games/museum`, `src/games/rightway`, `src/games/rulefixer`.

- [ ] **Step 1–4:** For each game, read the component, then apply the standard pattern: `useGameAnalytics('<id>')`, `resetSession()` first line of `start()`, `recordStep('answer', { correct, ...detail, score })` at each scoring action, and `finishGame(<score>)` after every `reportScore('<id>', <score>)`. Use the exact `GameId` for each (`mirror`, `museum`, `rightway`, `rulefixer`).

- [ ] **Step 5: Verify + commit.**

```bash
npx tsc -b && npm test
git add src/games/mirror src/games/museum src/games/rightway src/games/rulefixer
git commit -m "feat: record analytics events in mirror/museum/rightway/rulefixer"
```

### Task 8: slider, knowemotion, identifyemotions

**Files:** the three `<Game>.tsx` under `src/games/slider`, `src/games/knowemotion`, `src/games/identifyemotions`.

- [ ] **Step 1–4:** Apply the standard pattern with `GameId`s `slider`, `knowemotion`, `identifyemotions`. Same three edits: hook, `resetSession()` in `start()`, `recordStep('answer', {...})` per action, `finishGame()` after each `reportScore`.

- [ ] **Step 5: Verify + commit.**

```bash
npx tsc -b && npm test
git add src/games/slider src/games/knowemotion src/games/identifyemotions
git commit -m "feat: record analytics events in slider/knowemotion/identifyemotions"
```

> Note: `blocks` is intentionally NOT in Tasks 6–8 — it is instrumented as part of its rework in Task 11.

---

## Task 9: Block Buddies — multi-peer turn model (logic)

**Files:**
- Modify: `src/games/blocks/logic.ts`
- Modify: `src/games/blocks/logic.test.ts`

**Interfaces:**
- Produces:
  - `interface Player { id: string; kind: 'child' | 'peer'; name: string; emoji: string }`
  - `interface BlockConfig { players: number; rounds: number; peerTurnMs: number }`
  - `const CONFIG: Record<Difficulty, BlockConfig>`
  - `interface TurnSpec { playerIndex: number; kind: 'child' | 'peer'; color: string; offset: number }`
  - `function buildPlayers(count: number): Player[]` (index 0 is always the child)
  - `function makeSequence(config: BlockConfig, players: Player[], rng?: () => number): TurnSpec[]`
  - Keep `BLOCK_H`, `blockY`, `BLOCK_COLORS`.

- [ ] **Step 1: Write the failing tests.**

Replace the body of `src/games/blocks/logic.test.ts` with tests for the new model (keep any unrelated existing tests that still apply):

```ts
import { describe, it, expect } from 'vitest'
import { CONFIG, buildPlayers, makeSequence, blockY, BLOCK_H } from './logic'

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

describe('blocks logic (multi-peer)', () => {
  it('buildPlayers puts the child first and fills peers', () => {
    const players = buildPlayers(4)
    expect(players).toHaveLength(4)
    expect(players[0].kind).toBe('child')
    expect(players.slice(1).every((p) => p.kind === 'peer')).toBe(true)
  })

  it('makeSequence has players*rounds turns', () => {
    const cfg = CONFIG.medium
    const seq = makeSequence(cfg, buildPlayers(cfg.players), seeded(1))
    expect(seq).toHaveLength(cfg.players * cfg.rounds)
  })

  it('the child takes exactly one turn per round', () => {
    const cfg = CONFIG.hard
    const players = buildPlayers(cfg.players)
    const seq = makeSequence(cfg, players, seeded(2))
    for (let r = 0; r < cfg.rounds; r++) {
      const round = seq.slice(r * cfg.players, (r + 1) * cfg.players)
      expect(round.filter((t) => t.kind === 'child')).toHaveLength(1)
      // every player appears exactly once per round
      const idxs = round.map((t) => t.playerIndex).sort()
      expect(idxs).toEqual([...Array(cfg.players).keys()])
    }
  })

  it('the child slot varies across rounds (not always first)', () => {
    const cfg = CONFIG.hard
    const players = buildPlayers(cfg.players)
    const seq = makeSequence(cfg, players, seeded(3))
    const childSlots: number[] = []
    for (let r = 0; r < cfg.rounds; r++) {
      const round = seq.slice(r * cfg.players, (r + 1) * cfg.players)
      childSlots.push(round.findIndex((t) => t.kind === 'child'))
    }
    expect(new Set(childSlots).size).toBeGreaterThan(1)
  })

  it('blockY stacks by BLOCK_H', () => {
    expect(blockY(0)).toBeCloseTo(BLOCK_H / 2)
    expect(blockY(2)).toBeCloseTo(BLOCK_H / 2 + 2 * BLOCK_H)
  })
})
```

- [ ] **Step 2: Run to verify failure.**

Run: `npx vitest run src/games/blocks/logic.test.ts`
Expected: FAIL (new exports missing).

- [ ] **Step 3: Implement the new logic.**

Replace `src/games/blocks/logic.ts` with:

```ts
import type { Difficulty } from '../../types'

export interface Player {
  id: string
  kind: 'child' | 'peer'
  name: string
  emoji: string
}

export interface BlockConfig {
  /** total players in the rotation, including the child */
  players: number
  /** how many full rounds (the child gets one turn per round) */
  rounds: number
  /** how long a peer "thinks" before placing, in ms */
  peerTurnMs: number
}

export const CONFIG: Record<Difficulty, BlockConfig> = {
  easy: { players: 3, rounds: 5, peerTurnMs: 1300 },
  medium: { players: 4, rounds: 7, peerTurnMs: 1800 },
  hard: { players: 5, rounds: 10, peerTurnMs: 2400 },
}

export const BLOCK_COLORS = ['#e2554c', '#f5c542', '#5aa9e6', '#7ac74f', '#b06fd6', '#f08a3c']

/** Friendly peer roster (sliced to the player count). */
const PEER_ROSTER: ReadonlyArray<{ name: string; emoji: string }> = [
  { name: 'Mia', emoji: '🧒' },
  { name: 'Leo', emoji: '👦' },
  { name: 'Ava', emoji: '👧' },
  { name: 'Sam', emoji: '🧑' },
  { name: 'Zoe', emoji: '👶' },
]

export interface TurnSpec {
  playerIndex: number
  kind: 'child' | 'peer'
  color: string
  offset: number
}

/** Build the player list; index 0 is always the child. */
export function buildPlayers(count: number): Player[] {
  const players: Player[] = [{ id: 'child', kind: 'child', name: 'You', emoji: '🙂' }]
  for (let i = 0; i < count - 1; i++) {
    const p = PEER_ROSTER[i % PEER_ROSTER.length]
    players.push({ id: `peer-${i + 1}`, kind: 'peer', name: p.name, emoji: p.emoji })
  }
  return players
}

function shuffled(n: number, rng: () => number): number[] {
  const arr = [...Array(n).keys()]
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Build the full turn sequence: for each round, a randomized ordering of all
 * players. The child appears exactly once per round, at a varying slot.
 */
export function makeSequence(
  config: BlockConfig,
  players: Player[],
  rng: () => number = Math.random,
): TurnSpec[] {
  const seq: TurnSpec[] = []
  for (let r = 0; r < config.rounds; r++) {
    for (const playerIndex of shuffled(players.length, rng)) {
      seq.push({
        playerIndex,
        kind: players[playerIndex].kind,
        color: BLOCK_COLORS[Math.floor(rng() * BLOCK_COLORS.length)],
        offset: (rng() - 0.5) * 0.14,
      })
    }
  }
  return seq
}

export const BLOCK_H = 0.42
export function blockY(index: number): number {
  return BLOCK_H / 2 + index * BLOCK_H
}
```

- [ ] **Step 4: Run tests to verify they pass.**

Run: `npx vitest run src/games/blocks/logic.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/games/blocks/logic.ts src/games/blocks/logic.test.ts
git commit -m "feat: multi-peer turn model for Block Buddies"
```

---

## Task 10: Block Buddies — scene (peer avatars)

**Files:**
- Modify: `src/games/blocks/BlockScene.tsx`

**Interfaces:**
- Consumes: `TurnSpec`, `Player`, `blockY`, `BLOCK_H` from `./logic`.
- Produces: `<BlockScene placed={TurnSpec[]} players={Player[]} activeIndex={number} reaching={boolean} />` — renders the stacked tower from `placed` and a row of peer avatars highlighting `activeIndex`.

- [ ] **Step 1: Read the current scene** to reuse its tower-rendering primitives. Keep the stacked-block rendering driven by `placed` (now `TurnSpec[]`; use `placed.length` and each item's `color`/`offset`). Replace the single robot with avatars for each player, highlighting the player at `activeIndex` (e.g. scale/emissive bump or a "reaching" pose when `reaching` is true). Keep it lightweight using the existing three primitives.

- [ ] **Step 2: Verify build.**

Run: `npx tsc -b`
Expected: no errors (the component prop change will be consumed in Task 11).

- [ ] **Step 3: Commit.**

```bash
git add src/games/blocks/BlockScene.tsx
git commit -m "feat: render peer avatars in Block Buddies scene"
```

---

## Task 11: Block Buddies — game component (state machine + buttons + analytics)

**Files:**
- Modify: `src/games/blocks/BlockGame.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `CONFIG`, `buildPlayers`, `makeSequence`, `TurnSpec`, `Player` from `./logic`; `BlockScene` from `./BlockScene`; `useGameAnalytics` from `../useGameAnalytics`.

- [ ] **Step 1: Replace the component.**

Replace `src/games/blocks/BlockGame.tsx` with:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { GAME_LIST } from '../../types'
import { useSettings } from '../../state/settings'
import { useScores } from '../../state/scores'
import { StartScreen } from '../../components/StartScreen'
import { ScoreBar } from '../../components/ScoreBar'
import { PromptBanner } from '../../components/PromptBanner'
import { GameOverDialog } from '../../components/GameOverDialog'
import { WebGLGate } from '../../components/WebGLGate'
import { speak } from '../../services/speech'
import { playGentle, playSuccess } from '../../services/sounds'
import { CONFIG, buildPlayers, makeSequence, type Player, type TurnSpec } from './logic'
import { BlockScene } from './BlockScene'
import { useGameAnalytics } from '../useGameAnalytics'

const META = GAME_LIST.find((g) => g.id === 'blocks')!
const MAX_LIVES = 3

export function BlockGame() {
  const difficulty = useSettings((s) => s.difficulty.blocks)
  const best = useScores((s) => s.best.blocks)
  const reportScore = useScores((s) => s.reportScore)
  const config = CONFIG[difficulty]
  const { recordStep, finishGame, resetSession } = useGameAnalytics('blocks')

  const [phase, setPhase] = useState<'start' | 'playing' | 'over'>('start')
  const [players, setPlayers] = useState<Player[]>([])
  const [sequence, setSequence] = useState<TurnSpec[]>([])
  const [index, setIndex] = useState(0) // turns completed
  const [lives, setLives] = useState(MAX_LIVES)
  const [reaching, setReaching] = useState(false)

  const turn = index < sequence.length ? sequence[index] : null
  const activeIndex = turn ? turn.playerIndex : -1
  const isChildTurn = turn?.kind === 'child'
  const score = useMemo(
    () => sequence.slice(0, index).filter((t) => t.kind === 'child').length,
    [sequence, index],
  )

  function start() {
    resetSession()
    const ps = buildPlayers(config.players)
    setPlayers(ps)
    setSequence(makeSequence(config, ps))
    setIndex(0)
    setLives(MAX_LIVES)
    setReaching(false)
    setPhase('playing')
  }

  // Peer turns drive themselves on a timer; the child waits for their button.
  useEffect(() => {
    if (phase !== 'playing') return
    if (turn === null) {
      const finalScore = sequence.filter((t) => t.kind === 'child').length
      reportScore('blocks', finalScore)
      finishGame(finalScore)
      speak('You built the whole tower together! Great team work!')
      playSuccess()
      setPhase('over')
      return
    }
    if (turn.kind === 'peer') {
      const peer = players[turn.playerIndex]
      speak(`${peer.name} is building. Wait for your turn.`)
      const t1 = setTimeout(() => setReaching(true), config.peerTurnMs * 0.55)
      const t2 = setTimeout(() => {
        setReaching(false)
        setIndex((i) => i + 1)
      }, config.peerTurnMs)
      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
      }
    }
    // child's turn: wait for the button
  }, [index, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // current round number (0-based) for analytics payloads
  const round = Math.floor(index / config.players)

  function place() {
    if (phase !== 'playing' || turn === null) return
    if (turn.kind === 'child') {
      playSuccess()
      speak('Nice block!')
      recordStep('place_block', { round, slot: index % config.players }, { score: score + 1 })
      setIndex((i) => i + 1)
    } else {
      // grabbed during a peer's turn — gently coach patience
      playGentle()
      speak('Almost! Wait a moment for your turn.')
      recordStep('impatient_tap', { round, activePlayer: players[turn.playerIndex]?.id })
      const next = lives - 1
      setLives(next)
      if (next <= 0) {
        reportScore('blocks', score)
        finishGame(score)
        setPhase('over')
      }
    }
  }

  if (phase === 'start') return <StartScreen game={META} onStart={start} />

  const promptText = isChildTurn
    ? 'Your turn — place a block!'
    : `${players[activeIndex]?.name ?? 'A friend'} is building. Wait for your turn.`

  return (
    <WebGLGate>
      <div className="game-page">
        <ScoreBar score={score} goal={config.rounds} lives={lives} maxLives={MAX_LIVES} />
        <div className="game-canvas">
          <BlockScene placed={sequence.slice(0, index)} players={players} activeIndex={activeIndex} reaching={reaching} />
        </div>
        <div className="game-bottom">
          <PromptBanner text={promptText} />
          <div className="player-btn-row">
            {players.map((p, i) => {
              const active = i === activeIndex
              if (p.kind === 'child') {
                return (
                  <button
                    key={p.id}
                    className={isChildTurn ? 'player-btn child ready' : 'player-btn child wait'}
                    onClick={place}
                  >
                    <span className="player-emoji">{p.emoji}</span>
                    <span>{isChildTurn ? '🧱 Place' : '⏳ Wait'}</span>
                  </button>
                )
              }
              return (
                <div key={p.id} className={active ? 'player-btn peer active' : 'player-btn peer'}>
                  <span className="player-emoji">{p.emoji}</span>
                  <span>{p.name}</span>
                </div>
              )
            })}
          </div>
        </div>
        {phase === 'over' && (
          <GameOverDialog score={score} best={Math.max(best, score)} onRestart={start} />
        )}
      </div>
    </WebGLGate>
  )
}
```

- [ ] **Step 2: Add styles.**

Append to `src/styles/global.css`:

```css
.player-btn-row { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 8px; }
.player-btn { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 76px; padding: 10px; border-radius: 14px; border: 2px solid #ddd; background: #f6f6f6; font-weight: 700; }
.player-emoji { font-size: 26px; }
.player-btn.peer.active { border-color: #f5c542; background: #fff8e1; box-shadow: 0 0 0 3px #f5c54255; }
.player-btn.child { cursor: pointer; }
.player-btn.child.ready { border-color: #7ac74f; background: #eafce0; }
.player-btn.child.wait { opacity: .7; }
```

- [ ] **Step 3: Verify build + tests.**

Run: `npx tsc -b && npm test`
Expected: tsc clean; all tests pass (blocks logic + others).

- [ ] **Step 4: Manual verification.**

Start the analytics server (`cd server && ./.venv/bin/uvicorn app.main:app --reload`) and the game (`npm run dev`). Sign in, play Block Buddies, and confirm:
- Peers auto-take turns; only the child's button is tappable.
- Out-of-turn taps coach patience and cost a life.
- Rows appear in the DB: `psql autism_games -c "select event_type, count(*) from game_events group by 1;"` shows `place_block`, `impatient_tap`, `game_over`.
- Logged out: no new rows are created.

- [ ] **Step 5: Commit.**

```bash
git add src/games/blocks/BlockGame.tsx src/styles/global.css
git commit -m "feat: Block Buddies multi-peer turn-taking + analytics"
```

---

## Task 12: Final verification

- [ ] **Step 1: Full check.**

Run: `npx tsc -b && npm test && npm run build`
Expected: type-check clean, all tests pass, production build succeeds.

- [ ] **Step 2: Commit any lockfile/build config changes if present, otherwise done.**

---

## Self-Review (completed by plan author)

- **Spec coverage:** 3.1 client → Task 1; 3.2 auth store → Task 2; 3.3 login UI → Tasks 3–4; 3.4 hook → Task 5; 3.5/3.6 instrumentation → Tasks 6–8 (+ blocks in 11); 4.2/4.3 turn model → Task 9; 4.5 scene → Task 10; 4.4/4.6 component + recording → Task 11; testing → tasks' test steps + Task 12.
- **Types consistent:** `useGameAnalytics` signature, `analytics` methods, and blocks `TurnSpec`/`Player`/`buildPlayers`/`makeSequence` names match across tasks.
- **No placeholders in infra/blocks tasks.** Tasks 6–8 deliberately reuse one documented edit pattern with per-game `GameId`/event/payload values rather than repeating full files; the pattern and exact calls are spelled out so a reviewer can apply and reject per game.
