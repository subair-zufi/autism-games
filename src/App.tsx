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
