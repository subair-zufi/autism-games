import type { Student } from '../services/analytics'

/** Whole years between a date-of-birth string (YYYY-MM-DD) and now, or null. */
export function ageFromDob(dob: string | null): number | null {
  if (!dob) return null
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age >= 0 ? age : null
}

/** "9 yrs" / "9 yrs · Male" style meta line for a participant. */
export function participantMeta(s: Student): string {
  const age = ageFromDob(s.date_of_birth)
  return [age != null ? `${age} yrs` : null, s.gender].filter(Boolean).join(' · ')
}

/** Initials for the avatar circle fallback. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}
