import { useEffect, useMemo, useState } from 'react'
import { analytics, type SessionExperience, type SessionExperienceInput } from '../services/analytics'

/**
 * The end-of-session user-experience record, on the trainer's phone.
 *
 * This is the instrument behind the user-experience objective, and it lives
 * here rather than on paper for one reason: recorded on the console it arrives
 * already carrying the child and the date, so it lines up with that session's
 * telemetry without anybody re-typing a participant code into a spreadsheet.
 *
 * Eleven questions in three parts. Part A the child answers, pictorially, with
 * the trainer reading the question aloud and turning the phone to them. Part B
 * is the trainer's own ratings, anchored so two trainers agree. Part C is what
 * they would otherwise have written in a margin.
 *
 * Every scale runs 1 (low) to 5 (high) — comfort included — so a rater cannot
 * invert one by accident and every item plots the same way up.
 */

/** 1 = not at all … 5 = very much. Drawn rather than imported so the form needs
 *  no asset, prints the same on any phone, and cannot silently fail to load. */
function Face({ value, size = 34 }: { value: number; size?: number }) {
  // Mouth curve: -8 (frown) … +8 (smile), flat at 3.
  const curve = [-8, -4, 0, 5, 8][value - 1] ?? 0
  const mouth =
    curve === 0
      ? 'M 9 21 L 23 21'
      : `M 9 ${21 - curve / 2} Q 16 ${21 + curve * 1.5} 23 ${21 - curve / 2}`
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="11" cy="13" r="1.9" fill="currentColor" />
      <circle cx="21" cy="13" r="1.9" fill="currentColor" />
      <path d={mouth} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

const FACE_LABELS = ['not at all', 'a little', 'OK', 'quite', 'very much']

function FaceScale({
  name,
  legend,
  malayalam,
  value,
  onChange,
}: {
  /** Short handle for the question, so the two face scales on this form do not
   *  present five identically-named buttons each to a screen reader. */
  name: string
  legend: string
  malayalam: string
  value: number | null
  onChange: (v: number) => void
}) {
  return (
    <fieldset className="sx-item">
      <legend>
        {legend}
        <span className="sx-ml">{malayalam}</span>
      </legend>
      <div className="sx-faces">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={value === n ? 'sx-face on' : 'sx-face'}
            aria-pressed={value === n}
            aria-label={`${name}: ${n} — ${FACE_LABELS[n - 1]}`}
            onClick={() => onChange(n)}
          >
            <Face value={n} />
            <span className="sx-face-n">{n}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}

/** The behavioural anchors from the rating guide, shown where the trainer
 *  rates rather than on a sheet they have to remember. */
const TRAINER_ITEMS: {
  key: keyof SessionExperienceInput
  label: string
  malayalam: string
  low: string
  high: string
}[] = [
  {
    key: 'rated_engagement',
    label: 'Engagement — how involved was the child?',
    malayalam: 'ശ്രദ്ധ — കുട്ടി എത്രത്തോളം കളിയിൽ മുഴുകി?',
    low: 'mostly off-task',
    high: 'absorbed throughout',
  },
  {
    key: 'rated_independence',
    label: 'Independence — how little help was needed?',
    malayalam: 'സ്വാശ്രയത്വം — എത്ര കുറച്ച് സഹായം മതിയായിരുന്നു?',
    low: 'constant hands-on help',
    high: 'no help at all',
  },
  {
    key: 'rated_comfort',
    label: 'Comfort — how comfortable did the child seem?',
    malayalam: 'സൗകര്യം — കുട്ടി എത്ര സുഖത്തിലായിരുന്നു?',
    low: 'clear distress',
    high: 'fully comfortable',
  },
  {
    key: 'rated_enjoyment',
    label: 'Enjoyment — how much positive response did you see?',
    malayalam: 'സന്തോഷം — എത്ര സന്തോഷ പ്രതികരണം കണ്ടു?',
    low: 'none seen',
    high: 'frequent',
  },
  {
    key: 'rated_willingness',
    label: 'Willingness — would the child have carried on?',
    malayalam: 'താൽപര്യം — കുട്ടി തുടരുമായിരുന്നോ?',
    low: 'wanted to stop',
    high: 'clearly wanted more',
  },
]

function RatingRow({
  label,
  malayalam,
  low,
  high,
  value,
  onChange,
}: {
  label: string
  malayalam: string
  low: string
  high: string
  value: number | null
  onChange: (v: number) => void
}) {
  return (
    <fieldset className="sx-item">
      <legend>
        {label}
        <span className="sx-ml">{malayalam}</span>
      </legend>
      <div className="sx-rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={value === n ? 'sx-num on' : 'sx-num'}
            aria-pressed={value === n}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="sx-anchors">
        <span>1 · {low}</span>
        <span>5 · {high}</span>
      </p>
    </fieldset>
  )
}

function todayISO(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function SessionExperienceForm({
  studentId,
  studentName,
  gamesPlayed = [],
  onDone,
}: {
  studentId: string
  studentName: string
  gamesPlayed?: string[]
  onDone?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<SessionExperienceInput>(() => ({
    student_id: studentId,
    visit_date: todayISO(),
  }))
  const [history, setHistory] = useState<SessionExperience[]>([])
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  // Reset when the console switches child, so one child's answers can never be
  // saved against another.
  useEffect(() => {
    setForm({ student_id: studentId, visit_date: todayISO() })
    setResult(null)
  }, [studentId])

  useEffect(() => {
    if (!open) return
    let live = true
    void analytics.listSessionExperience(studentId).then((rows) => {
      if (live) setHistory(rows)
    })
    return () => {
      live = false
    }
  }, [open, studentId])

  const last = useMemo(
    () => history.filter((r) => !r.is_second_rating).slice(-1)[0] ?? null,
    [history],
  )

  const set = <K extends keyof SessionExperienceInput>(key: K, value: SessionExperienceInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  async function save() {
    setSaving(true)
    setResult(null)
    const { saved, queued } = await analytics.submitSessionExperience({
      ...form,
      games_played: gamesPlayed.length ? gamesPlayed : form.games_played,
    })
    setSaving(false)
    setResult(
      saved && !queued
        ? 'Saved.'
        : queued
          ? 'Saved on this device — it will sync when the connection is back.'
          : 'Not saved. Sign in on this device and try again.',
    )
    if (saved && !queued) onDone?.()
  }

  if (!open) {
    return (
      <section className="rc-section">
        <button className="rc-btn go sx-open" type="button" onClick={() => setOpen(true)}>
          📝 End-of-session record
        </button>
        <p className="rc-hint">
          The eleven questions, for {studentName}. Fill it in as the headset comes off.
        </p>
      </section>
    )
  }

  return (
    <section className="rc-section sx">
      <h2>End-of-session record · {studentName}</h2>

      <label className="field sx-date">
        <span>Date of this session</span>
        <input
          type="date"
          value={form.visit_date}
          onChange={(e) => set('visit_date', e.target.value)}
        />
      </label>

      <h3>Part A — ask the child</h3>
      <p className="rc-hint">Read each question aloud and turn the phone to the child.</p>

      <FaceScale
        name="fun"
        legend="1. How much fun was it today?"
        malayalam="ഇന്ന് എത്ര രസമായിരുന്നു?"
        value={form.child_fun ?? null}
        onChange={(v) => set('child_fun', v)}
      />
      <FaceScale
        name="feeling"
        legend="2. How well do you feel now?"
        malayalam="ഇപ്പോൾ നിനക്ക് എങ്ങനെയുണ്ട്?"
        value={form.child_feeling ?? null}
        onChange={(v) => set('child_feeling', v)}
      />

      {(form.child_feeling === 1 || form.child_feeling === 2) && (
        <p className="rc-alert">
          Stop rule — end the session now, take the headset off, and write the reason below.
          A stopped session is a finding, not a failure.
        </p>
      )}

      <fieldset className="sx-item">
        <legend>
          3. Do you want to play again next time?
          <span className="sx-ml">അടുത്ത തവണയും കളിക്കണോ?</span>
        </legend>
        <div className="sx-rating">
          {(['no', 'maybe', 'yes'] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={form.child_play_again === v ? 'sx-word on' : 'sx-word'}
              aria-pressed={form.child_play_again === v}
              onClick={() => set('child_play_again', v)}
            >
              {v === 'no' ? 'No' : v === 'maybe' ? 'Maybe' : 'Yes'}
            </button>
          ))}
        </div>
      </fieldset>

      <h3>Part B — your ratings</h3>
      {TRAINER_ITEMS.map((item) => (
        <RatingRow
          key={item.key}
          label={item.label}
          malayalam={item.malayalam}
          low={item.low}
          high={item.high}
          value={(form[item.key] as number | null | undefined) ?? null}
          onChange={(v) => set(item.key, v as SessionExperienceInput[typeof item.key])}
        />
      ))}

      <h3>Part C — in your own words</h3>

      <label className="field">
        <span>9. What went well today?</span>
        <textarea
          rows={2}
          value={form.went_well ?? ''}
          onChange={(e) => set('went_well', e.target.value)}
        />
      </label>
      <label className="field">
        <span>10. What was difficult today?</span>
        <textarea
          rows={2}
          value={form.was_difficult ?? ''}
          onChange={(e) => set('was_difficult', e.target.value)}
        />
      </label>

      {last && (
        <p className="sx-last">
          <strong>Last session ({last.visit_date}):</strong>{' '}
          {last.different_from_last || last.went_well || 'no note recorded'}
        </p>
      )}
      <label className="field">
        <span>11. Anything different from the last session?</span>
        <textarea
          rows={2}
          value={form.different_from_last ?? ''}
          onChange={(e) => set('different_from_last', e.target.value)}
        />
      </label>

      <label className="sx-check">
        <input
          type="checkbox"
          checked={form.stopped_early ?? false}
          onChange={(e) => set('stopped_early', e.target.checked)}
        />
        <span>The session stopped early</span>
      </label>
      {form.stopped_early && (
        <label className="field">
          <span>Why did it stop?</span>
          <textarea
            rows={2}
            value={form.stop_reason ?? ''}
            onChange={(e) => set('stop_reason', e.target.value)}
          />
        </label>
      )}

      <label className="sx-check">
        <input
          type="checkbox"
          checked={form.is_second_rating ?? false}
          onChange={(e) => {
            set('is_second_rating', e.target.checked)
            if (!e.target.checked) set('rater_id', '')
          }}
        />
        <span>This is an independent second rating (reliability subsample)</span>
      </label>
      {form.is_second_rating && (
        <label className="field">
          <span>Your rater id</span>
          <input
            value={form.rater_id ?? ''}
            onChange={(e) => set('rater_id', e.target.value)}
            placeholder="e.g. coder-2"
          />
        </label>
      )}

      <div className="rc-actions">
        <button className="rc-btn go" type="button" disabled={saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save record'}
        </button>
        <button className="rc-btn" type="button" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      {result && <p className="rc-note">{result}</p>}
    </section>
  )
}
