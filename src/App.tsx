import type { ComponentType } from 'react'
import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { ComingSoon } from './components/ComingSoon'
import { GAME_LIST, type GameId } from './types'
import { EmotionsGame } from './games/emotions/EmotionsGame'
import { BallDropGame } from './games/balldrop/BallDropGame'
import { GardenGame } from './games/garden/GardenGame'
import { ZebraGame } from './games/zebra/ZebraGame'
import { MirrorGame } from './games/mirror/MirrorGame'
import { BlockGame } from './games/blocks/BlockGame'
import { MuseumGame } from './games/museum/MuseumGame'
import { RightWayGame } from './games/rightway/RightWayGame'
import { RuleFixerGame } from './games/rulefixer/RuleFixerGame'
import { SliderGame } from './games/slider/SliderGame'
import { KnowEmotionGame } from './games/knowemotion/KnowEmotionGame'
import { IdentifyEmotionsGame } from './games/identifyemotions/IdentifyEmotionsGame'
import { useAuth } from './state/auth'

const GAME_COMPONENTS: Partial<Record<GameId, ComponentType>> = {
  emotions: EmotionsGame,
  balldrop: BallDropGame,
  garden: GardenGame,
  zebra: ZebraGame,
  mirror: MirrorGame,
  blocks: BlockGame,
  museum: MuseumGame,
  rightway: RightWayGame,
  rulefixer: RuleFixerGame,
  slider: SliderGame,
  knowemotion: KnowEmotionGame,
  identifyemotions: IdentifyEmotionsGame,
}

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
