import { useSettings } from '../state/settings'

let ctx: AudioContext | null = null
function audio(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null
  ctx ??= new AudioContext()
  return ctx
}

/** Soft sine tone; gentle attack/decay so nothing is ever startling. */
function tone(freq: number, startAt: number, duration: number, peak = 0.15) {
  const ac = audio()
  if (!ac || !useSettings.getState().soundOn) return
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  const t = ac.currentTime + startAt
  osc.frequency.value = freq
  osc.type = 'sine'
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(peak, t + 0.03)
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
  osc.connect(gain).connect(ac.destination)
  osc.start(t)
  osc.stop(t + duration)
}

export const playSuccess = () => { tone(523, 0, 0.25); tone(659, 0.12, 0.25); tone(784, 0.24, 0.35) }
export const playGentle = () => { tone(330, 0, 0.3, 0.08) }
export const playTap = () => { tone(440, 0, 0.08, 0.06) }
