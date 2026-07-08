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
import { Profile } from './pages/Profile'
import { GameDetail } from './pages/GameDetail'
import { ComingSoon } from './components/ComingSoon'
import { GAME_LIST, type GameId } from './types'
import { EmotionRecognitionGame } from './games/emotionrecognition/EmotionRecognitionGame'
import { BallDropGame } from './games/balldrop/BallDropGame'
import { GardenGame } from './games/garden/GardenGame'
import { ZebraGame } from './games/zebra/ZebraGame'
import { MirrorGame } from './games/mirror/MirrorGame'
import { BlockGame } from './games/blocks/BlockGame'
import { MuseumGame } from './games/museum/MuseumGame'
import { RightWayGame } from './games/rightway/RightWayGame'
import { RuleFixerGame } from './games/rulefixer/RuleFixerGame'
import { SliderGame } from './games/slider/SliderGame'
import { IdentifyEmotionsGame } from './games/identifyemotions/IdentifyEmotionsGame'
import { useAuth } from './state/auth'

const GAME_COMPONENTS: Partial<Record<GameId, ComponentType>> = {
  emotionrecognition: EmotionRecognitionGame,
  balldrop: BallDropGame,
  garden: GardenGame,
  zebra: ZebraGame,
  mirror: MirrorGame,
  blocks: BlockGame,
  museum: MuseumGame,
  rightway: RightWayGame,
  rulefixer: RuleFixerGame,
  slider: SliderGame,
  identifyemotions: IdentifyEmotionsGame,
}

/** Gate a route behind a logged-in mentor; bounce to /login otherwise. */
function RequireAuth({ children }: { children: ReactNode }) {
  const isLoggedIn = useAuth((s) => s.isLoggedIn)
  const location = useLocation()
  if (!isLoggedIn) return <Navigate to="/login" replace state={{ from: location.pathname }} />
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
