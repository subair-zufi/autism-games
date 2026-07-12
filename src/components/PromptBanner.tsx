import { useEffect } from 'react'
import { speak, speechAvailable } from '../services/speech'
import type { Lang } from '../i18n/strings'

export function PromptBanner({ text, lang = 'en', swatch }: { text: string; lang?: Lang; swatch?: string }) {
  useEffect(() => { speak(text, lang) }, [text, lang])
  return (
    <div className="prompt-banner">
      {swatch && <span className="prompt-swatch" style={{ background: swatch }} />}
      <span>{text}</span>
      {speechAvailable() && (
        <button aria-label="Say it again" onClick={() => speak(text, lang)}>🔊</button>
      )}
    </div>
  )
}
