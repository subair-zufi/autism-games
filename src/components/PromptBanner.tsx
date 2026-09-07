import { useEffect } from 'react'
import { speak, speechAvailable } from '../services/speech'
import { t, type Lang } from '../i18n/strings'
import { useRemoteReport } from '../remote/status'

export function PromptBanner({ text, lang = 'en', swatch }: { text: string; lang?: Lang; swatch?: string }) {
  useEffect(() => { speak(text, lang) }, [text, lang])
  // The trainer coaching over the child's shoulder needs to know what was
  // asked — they cannot hear the headset's voice line.
  useRemoteReport({ prompt: text })
  return (
    <div className="prompt-banner">
      {swatch && <span className="prompt-swatch" style={{ background: swatch }} />}
      <span>{text}</span>
      {speechAvailable() && (
        <button aria-label={t('sayAgain', lang)} onClick={() => speak(text, lang)}>🔊</button>
      )}
    </div>
  )
}
