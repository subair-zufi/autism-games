import type { ComponentType, ReactNode } from 'react'
import { Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { CompleteProfile } from './pages/CompleteProfile'
import { Participants } from './pages/Participants'
import { ParticipantForm } from './pages/ParticipantForm'
import { Progress } from './pages/Progress'
import { Cohort } from './pages/Cohort'
import { Profile } from './pages/Profile'
import { GameDetail } from './pages/GameDetail'
import { ComingSoon } from './components/ComingSoon'
import { GAME_LIST, type GameId } from './types'
import { useAuth } from './state/auth'
import { useOffline } from './state/offline'
import { installVisibilityTracking } from './services/visibility'
import { PlayOffline } from './pages/PlayOffline'

/**
 * Every game is loaded on demand rather than imported up front.
 *
 * Statically imported, all sixteen games — and with them the whole of three.js
 * and react-three — landed in one bundle the browser had to download, parse and
 * compile before it could paint the participant list, let alone respond to a
 * tap on it. On a headset that is a long, silent wait in which the app looks
 * ready and ignores presses, which is most of what "choosing a game is slow"
 * was. Splitting them means the mentor screens carry only their own code, and
 * each game's scene is fetched when it is actually opened.
 *
 * The service worker precaches every chunk (see `injectManifest.globPatterns`
 * in vite.config.ts), so a game opened offline still loads from cache — this
 * costs nothing on a disconnected headset.
 */
const GAME_COMPONENTS: Partial<Record<GameId, ComponentType>> = {
  emotionrecognition: lazy(() =>
    import('./games/emotionrecognition/EmotionRecognitionGame').then((m) => ({ default: m.EmotionRecognitionGame })),
  ),
  emotionrecognition360: lazy(() =>
    import('./games/emotionrecognition360/EmotionRecognition360Game').then((m) => ({ default: m.EmotionRecognition360Game })),
  ),
  blocks: lazy(() => import('./games/blocks/BlockGame').then((m) => ({ default: m.BlockGame }))),
  playroom360: lazy(() =>
    import('./games/playroom360/Playroom360Game').then((m) => ({ default: m.Playroom360Game })),
  ),
  rollback: lazy(() => import('./games/rollback/RollBackGame').then((m) => ({ default: m.RollBackGame }))),
  football360: lazy(() =>
    import('./games/football360/Football360Game').then((m) => ({ default: m.Football360Game })),
  ),
  museum: lazy(() => import('./games/museum/MuseumGame').then((m) => ({ default: m.MuseumGame }))),
  museum360: lazy(() => import('./games/museum360/Museum360Game').then((m) => ({ default: m.Museum360Game }))),
  rightway: lazy(() => import('./games/rightway/RightWayGame').then((m) => ({ default: m.RightWayGame }))),
  rightway360: lazy(() =>
    import('./games/rightway360/RightWay360Game').then((m) => ({ default: m.RightWay360Game })),
  ),
  rulefixer: lazy(() => import('./games/rulefixer/RuleFixerGame').then((m) => ({ default: m.RuleFixerGame }))),
  identifyemotions: lazy(() =>
    import('./games/identifyemotions/IdentifyEmotionsGame').then((m) => ({ default: m.IdentifyEmotionsGame })),
  ),
  identifyemotions360: lazy(() =>
    import('./games/identifyemotions360/IdentifyEmotions360Game').then((m) => ({ default: m.IdentifyEmotions360Game })),
  ),
  calmcrew: lazy(() => import('./games/calmcrew/CalmCrewGame').then((m) => ({ default: m.CalmCrewGame }))),
  discovery: lazy(() => import('./games/discovery/DiscoveryGame').then((m) => ({ default: m.DiscoveryGame }))),
  park360: lazy(() => import('./games/park360/Park360Game').then((m) => ({ default: m.Park360Game }))),
}

/** Gate a route behind a logged-in mentor OR active offline mode. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const isLoggedIn = useAuth((s) => s.isLoggedIn)
  const offlineMode = useOffline((s) => s.offlineMode)
  const location = useLocation()
  if (!isLoggedIn && !offlineMode)
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <>{children}</>
}

export default function App() {
  useEffect(() => {
    useAuth.getState().hydrate()
    // Watch for the page going out of sight, so every trial can record how
    // much of itself the child was not present for (services/visibility.ts).
    installVisibilityTracking()
  }, [])

  return (
    <Suspense fallback={<GameLoading />}>
      <Routes>
        {/* Public auth screens */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/play-offline" element={<PlayOffline />} />

        {/* Full-screen authed screens (own header, no tab bar) */}
        <Route path="/complete-profile" element={<RequireAuth><CompleteProfile /></RequireAuth>} />
        <Route path="/game/:gameId" element={<RequireAuth><GameDetail /></RequireAuth>} />

        {/* Tab-shell screens */}
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route path="/" element={<Home />} />
          <Route path="/participants" element={<Participants />} />
          <Route path="/participants/new" element={<ParticipantForm />} />
          <Route path="/participants/:id/edit" element={<ParticipantForm />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/cohort" element={<Cohort />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        {/* Game scenes (kid-facing, full-screen) */}
        {GAME_LIST.map((g) => {
          const Game = GAME_COMPONENTS[g.id]
          return (
            <Route
              key={g.id}
              path={g.path}
              element={<RequireAuth>{Game ? <Game /> : <ComingSoon game={g} />}</RequireAuth>}
            />
          )
        })}
      </Routes>
    </Suspense>
  )
}

/**
 * Shown while a game's code is being fetched. Only the game routes are lazy, so
 * this never appears on the mentor screens — and it gives the child something
 * that is plainly "getting ready" rather than a blank screen.
 */
function GameLoading() {
  return (
    <div className="game-loading">
      <span className="spinner" aria-hidden />
      <p>Getting the game ready…</p>
    </div>
  )
}
