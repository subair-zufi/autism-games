/** A thin progress bar. Colour shifts with completion (matches the design:
 *  grey/blue for low-mid, green when nearly done). */
export function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  const tone = pct >= 75 ? 'high' : pct > 0 ? 'mid' : 'zero'
  return (
    <div className={`pbar pbar-${tone}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <span className="pbar-fill" style={{ width: `${pct}%` }} />
    </div>
  )
}
