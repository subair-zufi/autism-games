import type { ComponentType } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Home } from './pages/Home'
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
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      {GAME_LIST.map((g) => {
        const Game = GAME_COMPONENTS[g.id]
        return (
          <Route key={g.id} path={g.path} element={Game ? <Game /> : <ComingSoon game={g} />} />
        )
      })}
    </Routes>
  )
}
