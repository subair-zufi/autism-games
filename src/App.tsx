import type { ComponentType } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Home } from './pages/Home'
import { ComingSoon } from './components/ComingSoon'
import { GAME_LIST, type GameId } from './types'
import { EmotionsGame } from './games/emotions/EmotionsGame'
import { BallDropGame } from './games/balldrop/BallDropGame'

const GAME_COMPONENTS: Partial<Record<GameId, ComponentType>> = {
  emotions: EmotionsGame,
  balldrop: BallDropGame,
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
