import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
// Bundled font so the mentor UI renders identically on Mac and Windows
// (otherwise Windows falls to Segoe UI and macOS to SF Pro).
import '@fontsource-variable/inter'
import './styles/global.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <App />
      </HashRouter>
    </ErrorBoundary>
  </StrictMode>,
)
