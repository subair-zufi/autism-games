import type { ComponentType, ReactNode } from 'react'
import { useEffect } from 'react'
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
import { EmotionRecognitionGame } from './games/emotionrecognition/EmotionRecognitionGame'
import { EmotionRecognition360Game } from './games/emotionrecognition360/EmotionRecognition360Game'
import { BlockGame } from './games/blocks/BlockGame'
import { Playroom360Game } from './games/playroom360/Playroom360Game'
import { RollBackGame } from './games/rollback/RollBackGame'
import { Football360Game } from './games/football360/Football360Game'
import { MuseumGame } from './games/museum/MuseumGame'
import { Museum360Game } from './games/museum360/Museum360Game'
import { RightWayGame } from './games/rightway/RightWayGame'
import { RightWay360Game } from './games/rightway360/RightWay360Game'
import { RuleFixerGame } from './games/rulefixer/RuleFixerGame'
import { IdentifyEmotionsGame } from './games/identifyemotions/IdentifyEmotionsGame'
import { IdentifyEmotions360Game } from './games/identifyemotions360/IdentifyEmotions360Game'
import { CalmCrewGame } from './games/calmcrew/CalmCrewGame'
import { DiscoveryGame } from './games/discovery/DiscoveryGame'
import { Park360Game } from './games/park360/Park360Game'
import { useAuth } from './state/auth'
import { useOffline } from './state/offline'
import { PlayOffline } from './pages/PlayOffline'

const GAME_COMPONENTS: Partial<Record<GameId, ComponentType>> = {
  emotionrecognition: EmotionRecognitionGame,
  emotionrecognition360: EmotionRecognition360Game,
  blocks: BlockGame,
  playroom360: Playroom360Game,
  rollback: RollBackGame,
  football360: Football360Game,
  museum: MuseumGame,
  museum360: Museum360Game,
  rightway: RightWayGame,
  rightway360: RightWay360Game,
  rulefixer: RuleFixerGame,
  identifyemotions: IdentifyEmotionsGame,
  identifyemotions360: IdentifyEmotions360Game,
  calmcrew: CalmCrewGame,
  discovery: DiscoveryGame,
  park360: Park360Game,
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
  }, [])

  return (
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
  )
}
