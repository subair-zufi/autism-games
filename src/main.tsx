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

// Register the offline service worker (production build only; disabled in dev
// via VitePWA devOptions so HMR isn't affected).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // The new worker calls skipWaiting and claims this page as soon as it
  // installs, which swaps the cached assets under a page still running the old
  // bundle. Reload once when that happens so the tab ends up wholly on the new
  // build — without it a facilitator has to know to force-close the headset
  // browser to pick up a fix.
  const hadController = !!navigator.serviceWorker.controller
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // first-ever registration also fires this; only an *update* needs a reload
    if (!hadController || reloading) return
    reloading = true
    window.location.reload()
  })

  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((reg) => reg.update())
      .catch(() => {})
  })
}
