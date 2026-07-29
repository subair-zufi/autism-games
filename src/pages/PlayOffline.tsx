import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOffline } from '../state/offline'
import {
  downloadAll,
  estimateStorage,
  isFullyCached,
  loadManifest,
  type AssetManifest,
} from '../services/offlineCache'

type Phase = 'checking' | 'ready' | 'needs-download' | 'too-big' | 'no-cache' | 'downloading' | 'error'

export function PlayOffline() {
  const navigate = useNavigate()
  const setOfflineMode = useOffline((s) => s.setOfflineMode)
  const [phase, setPhase] = useState<Phase>('checking')
  const [manifest, setManifest] = useState<AssetManifest>([])
  const [pct, setPct] = useState(0)
  const [detail, setDetail] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const m = await loadManifest()
        if (cancelled) return
        setManifest(m)
        if (await isFullyCached(m)) return setPhase('ready')
        if (!navigator.onLine) return setPhase('no-cache')
        const est = await estimateStorage(m)
        if (cancelled) return
        if (!est.fits) {
          setDetail(`${mb(est.needed)} needed, ${mb(est.available)} free`)
          return setPhase('too-big')
        }
        setPhase('needs-download')
      } catch {
        if (!cancelled) setPhase('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function startDownload() {
    setPhase('downloading')
    try {
      await downloadAll(manifest, (done, total) => setPct(Math.round((done / total) * 100)))
      setPhase('ready')
    } catch {
      setPhase('error')
    }
  }

  function start() {
    setOfflineMode(true)
    navigate('/', { replace: true })
  }

  return (
    <div className="auth-page">
      <header className="auth-hero">
        <h1>Play Offline</h1>
        <p>Download the games once, then play with no internet.</p>
      </header>

      <div className="auth-form">
        {phase === 'checking' && <p>Checking your device…</p>}

        {phase === 'needs-download' && (
          <>
            <p>Ready to download the full game library for offline use.</p>
            <button className="btn-primary" onClick={startDownload}>Download games</button>
          </>
        )}

        {phase === 'downloading' && (
          <>
            <p>Downloading games… {pct}%</p>
            <progress value={pct} max={100} style={{ width: '100%' }} />
          </>
        )}

        {phase === 'ready' && (
          <>
            <p>Games are ready to play offline.</p>
            <button className="btn-primary" onClick={start}>Start</button>
          </>
        )}

        {phase === 'too-big' && (
          <p className="auth-error">Not enough storage on this device. {detail}</p>
        )}

        {phase === 'no-cache' && (
          <p className="auth-error">Connect to the internet once to download the games.</p>
        )}

        {phase === 'error' && (
          <>
            <p className="auth-error">Something went wrong preparing offline mode.</p>
            <button className="btn-primary" onClick={() => location.reload()}>Try again</button>
          </>
        )}
      </div>
    </div>
  )
}

function mb(bytes: number): string {
  return `${(bytes / 1e6).toFixed(0)} MB`
}
