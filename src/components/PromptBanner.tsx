import { useEffect } from 'react'
import { speak, speechAvailable } from '../services/speech'

export function PromptBanner({ text, swatch }: { text: string; swatch?: string }) {
  useEffect(() => { speak(text) }, [text])
  return (
    <div className="prompt-banner">
      {swatch && <span className="prompt-swatch" style={{ background: swatch }} />}
      <span>{text}</span>
      {speechAvailable() && (
        <button aria-label="Say it again" onClick={() => speak(text)}>🔊</button>
      )}
    </div>
  )
}
