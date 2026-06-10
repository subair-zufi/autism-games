import { useEffect } from 'react'
import { speak, speechAvailable } from '../services/speech'

export function PromptBanner({ text }: { text: string }) {
  useEffect(() => { speak(text) }, [text])
  return (
    <div className="prompt-banner">
      <span>{text}</span>
      {speechAvailable() && (
        <button aria-label="Say it again" onClick={() => speak(text)}>🔊</button>
      )}
    </div>
  )
}
