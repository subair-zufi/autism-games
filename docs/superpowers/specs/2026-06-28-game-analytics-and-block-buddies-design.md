# Design: Game Analytics Wiring + Block Buddies Multi-Peer Redesign

Date: 2026-06-28

## Context

The repo contains the React/Vite game (`src/`) and a FastAPI + PostgreSQL analytics
server (`server/`). The server records per-player analytics and is documented in
`server/README.md`. **No analytics API is wired into the game yet.**

This spec covers two pieces of work:

1. **Part 3 — wire the analytics API into the game.** Login is optional; when a player
   is logged in every meaningful step is recorded, and when not logged in every server
   call is silently skipped (gameplay is never affected).
2. **Part 4 — redesign the "Block Buddies" game.** Replace the single robot opponent with
   several simulated peer "students", each with their own button. Only the logged-in
   child's actions are recorded. The longer, varied wait teaches the child patience.

Parts 1 (local DB + test) and 2 (Railway deploy) are already complete and out of scope here.

## Goals

- A drop-in analytics client and auth state that make server calls a no-op when logged out.
- Optional sign-up/login UI reachable from the Home screen.
- All 12 games instrumented with sessions + per-step events, done game-by-game.
- Block Buddies reworked into a multi-peer turn-taking game with single-player recording.

## Non-goals

- Networked / real-time multiplayer (Block Buddies peers are simulated, single device).
- Any change to the server API surface (the existing endpoints are sufficient).
- Offline event buffering / retry queues (the client already swallows failures; `events/batch`
  exists but is not required for this work).

---

## Part 3 — Analytics API wiring

### 3.1 Analytics client — `src/services/analytics.ts`

Copy `server/docs/frontend-analytics-client.ts` into `src/services/analytics.ts`. It already
implements the required behaviour:

- JWT persisted in `localStorage` (`ag_player_token`).
- `signup` (idempotent: creates the account **or** logs in) and explicit `login`.
- `startSession`, `endSession`, `recordStep` — all **resolve to no-ops when no token exists**.
- `recordStep` swallows network errors so analytics can never break gameplay.

Configuration: server URL via the Vite env var `VITE_ANALYTICS_API`.
- Add `.env.development` → `VITE_ANALYTICS_API=http://localhost:8000`.
- Add `.env.example` documenting `VITE_ANALYTICS_API` (production = the Railway URL).
- The deployed origin must be listed in the server's `CORS_ORIGINS`.

### 3.2 Auth state — `src/state/auth.ts`

A small zustand store wrapping the analytics client, so React components react to login state:

```
interface AuthState {
  user: PlayerUser | null
  isLoggedIn: boolean
  status: 'idle' | 'loading' | 'error'
  error: string | null
  hydrate: () => Promise<void>            // calls /me to restore session on load
  signup: (input: SignupInput) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}
```

- `hydrate()` is called once on app start (in `App.tsx` or `main.tsx`). If `/me` fails the
  token is cleared and the app stays in the logged-out (anonymous) state.
- `signup`/`login` set `user` on success; on `409` from signup the store surfaces a
  "wrong password" error so the UI can offer the explicit login path.

### 3.3 Login UI — button on Home + `/login` route

- **Home** (`src/pages/Home.tsx`): a small "Sign in" chip.
  - Logged out → navigates to `/login`.
  - Logged in → shows the player's `full_name` (or email) and a logout action.
- **`/login` route** (new `src/pages/Login.tsx`, registered in `src/App.tsx`):
  - One combined form: `email`, `password`, and optional `full_name`, `city`,
    `education_level`. (The other profile fields the server accepts are omitted from the
    form for simplicity but remain supported by the client.)
  - Primary "Continue" button calls `signup` (create-or-login).
  - On `409`, show "That email exists with a different password" and reveal a "Log in
    instead" action that calls `login`.
  - On success, navigate back to Home.
- Styling follows the existing kid-friendly UI in `src/styles/global.css` and the existing
  component patterns (e.g. `StartScreen`).

### 3.4 Per-game instrumentation — `useGameAnalytics(gameKey)`

A reusable hook `src/games/useGameAnalytics.ts`:

```
function useGameAnalytics(gameKey: GameId): {
  recordStep: (eventType: string, payload?: object,
               opts?: { stepIndex?: number; score?: number }) => void
  finishGame: (finalScore: number) => void
  resetSession: () => void   // for replays — forces a new session next step
}
```

Behaviour:
- Lazily calls `startSession(gameKey)` on the first `recordStep`/`finishGame` of a run and
  caches the returned `sessionId` (in a ref).
- `recordStep` forwards to `analytics.recordStep(gameKey, eventType, payload, { ...opts, sessionId })`.
- `finishGame(score)` records a `game_over` event with the score, then `endSession(sessionId, score)`,
  then clears the cached session id so the next run starts fresh.
- Every call is safe when logged out (the client no-ops). The hook never throws.

### 3.5 Event conventions

Per game, a small, consistent set of `event_type`s. Baseline for every game:
- `session_start` is implicit (the session row); no explicit event needed.
- `game_over` — recorded by `finishGame`, carries `score` and game-specific `payload`.

Each game additionally records its natural action(s), e.g.:
- A correct/incorrect answer: `answer` with `payload: { correct: boolean, ... }`.
- A round/level advance: `level` with `payload: { level: n }`.

The exact per-game event list is enumerated in the implementation plan. `payload` is
free-form JSON (server stores it as JSONB), so each game can attach relevant detail
(lane, emotion id, choice, etc.) without server changes.

### 3.6 Instrumentation scope

All 12 games are instrumented (`emotions`, `zebra`, `garden`, `balldrop`, `mirror`,
`blocks`, `museum`, `rightway`, `rulefixer`, `slider`, `knowemotion`, `identifyemotions`),
done one game at a time so each change is small and reviewable. Block Buddies is
instrumented as part of its Part 4 rework.

---

## Part 4 — Block Buddies multi-peer redesign

### 4.1 Concept

Replace the single robot with a small group of simulated peer "students". Turns rotate
round-robin through all players (peers + the real child). Peers auto-take their turn after
a delay; the child waits and taps **their own** button only on their turn. Tapping out of
turn triggers gentle "wait for your turn" coaching and costs a life. Only the child's
actions are recorded → single-student recording. The longer, varied wait is the patience
practice.

### 4.2 Players & turn order

- **Players per difficulty:** easy = 3 (child + 2 peers), medium = 4, hard = 5.
- **Turn order:** round-robin over all players for `rounds` full cycles. The child's slot
  within the rotation is **randomized each round**, so the wait varies (sometimes first,
  sometimes last).
- Peers have a name + emoji avatar (a fixed friendly roster, sliced to the player count).

### 4.3 Data model — `src/games/blocks/logic.ts`

- `PlayerId = 'child' | 'peer-1' | 'peer-2' | ...` (or a `kind: 'child' | 'peer'` + index).
- Config per difficulty: `{ players: number, rounds: number, peerTurnMs: number }`
  (replaces the current `robotTurnMs`; counts/rounds as above).
- `makeSequence(config, rng)` produces the full ordered list of turns: for each round, a
  randomized ordering of all players, each turn carrying the owning player and a block
  color/offset. The child appears once per round. Total blocks = `players * rounds`.
- Keep `BLOCK_H` / `blockY` helpers. Score helper: child's placed-block count.
- `logic.test.ts` updated: sequence length, one child turn per round, randomized slot,
  color/offset jitter — using a seeded `rng` (the existing pattern).

### 4.4 Game component — `src/games/blocks/BlockGame.tsx`

- State machine: `start | playing | over` (unchanged phases).
- Drives peer turns on a timer (`peerTurnMs`), like the current robot timer but for whichever
  peer is active; advances the turn index automatically.
- On the child's turn: their button is enabled; tapping places a block, advances the turn,
  records `place_block`.
- Out-of-turn tap: gentle coaching (`playGentle` + speak), lose a life, record `impatient_tap`.
  At 0 lives → game over.
- On completing all rounds → success → `finishGame(score)`.
- Renders a **row of player buttons** (avatar + name) under the scene. The active player's
  button is highlighted; peer buttons show an auto-press animation on their turn; only the
  child's button is interactive.
- Uses `useGameAnalytics('blocks')` for `place_block`, `impatient_tap`, and `game_over`
  (payload e.g. `{ players, childSlotPerRound }`).
- Reuses `ScoreBar`, `PromptBanner`, `GameOverDialog`, `WebGLGate`, `StartScreen`,
  `useScores`, `useSettings` as today.

### 4.5 Scene — `src/games/blocks/BlockScene.tsx`

- Render peer avatars (multiple) instead of the single robot, indicating whose turn it is
  (highlight / reach animation on the active player). The stacked tower rendering is
  preserved. Keep it lightweight (reuse existing primitives).

### 4.6 Recording (child only)

- `place_block` — child placed on their turn. `payload: { round, slot }`.
- `impatient_tap` — child tapped out of turn. `payload: { round, activePlayer }`.
- `game_over` — via `finishGame(score)`; `payload: { players, rounds, lives }`.
- All no-op when logged out.

---

## Testing

- **Server:** unchanged; existing suite stays green (`TEST_DATABASE_URL` against a test DB).
- **Block Buddies logic:** unit tests for `makeSequence` (length, one child turn/round,
  randomized child slot, deterministic with seeded rng) in `logic.test.ts`.
- **Analytics:** unit-test the `useGameAnalytics` lazy-session + no-op-when-logged-out
  behaviour (mock the analytics client). Keep the existing per-game logic tests passing.
- **Manual:** with a logged-in player, play a game and confirm rows appear in the DB
  (`game_sessions`, `game_events`); logged out, confirm no rows are created.

## Rollout / order of work

1. Analytics client + auth store + `.env` wiring.
2. Login UI (Home chip + `/login`).
3. `useGameAnalytics` hook + tests.
4. Instrument games one at a time.
5. Block Buddies rework (logic → component → scene → tests), instrumented as part of the rework.
