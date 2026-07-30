/**
 * Height-adapting the in-world HUD — the pure part, so the maths is testable
 * without a headset.
 *
 * Every 360 game lays its HUD out in absolute world Y: Museum 360's score panel
 * sits at y = 4.35, Emotion Room's at 3.5, and so on. Those numbers were tuned
 * against the flat camera each scene declares (`EYE_Y`, 1.5–1.7 m — an adult
 * sitting at a desk).
 *
 * Inside a headset that camera height does not apply. `@pmndrs/xr` requests a
 * `local-floor` reference space, so the camera rides at the WEARER'S real eye
 * height above the actual floor. A 7–10 year old stands around 1.10–1.30 m at
 * the eyes (less if seated), i.e. 0.2–0.6 m below what every panel position
 * assumes — and because the angle is measured over a fixed panel distance, the
 * shortfall turns straight into extra neck extension. It bites hardest in the
 * two games whose HUD is closest: Emotion Room (z ≈ −4.2) and Emotion Cinema
 * (z ≈ −4.3), whose score panels already sit near 25–27° up for a 1.5 m eye and
 * pass 29–30° for a small child. Sustained upward gaze past ~20–25° is the
 * uncomfortable direction; downward is the restful one.
 *
 * The fix is to slide the WHOLE HUD group vertically by the difference between
 * the wearer's real eye height and the height the layout was drawn for. Every
 * panel keeps its tuned position relative to every other, and relative to the
 * eye — the geometry the designer actually chose — instead of relative to a
 * floor the child is much closer to. Only the HUD moves: the exhibits, players
 * and big screen are world furniture, and a short child looking up at a big
 * screen is just what a big screen is like.
 */

/**
 * Plausible eye heights above the floor, seated child to tall standing adult.
 * A reading outside this is a bad pose sample (an uninitialised camera reads
 * ~0), not a real wearer.
 */
export const MIN_EYE_Y = 0.7
export const MAX_EYE_Y = 2.1

/**
 * How far to slide a HUD laid out for `designEyeY` when the wearer's eyes are
 * actually at `actualEyeY`. Negative moves the HUD down, which is the usual
 * direction — the wearer is nearly always shorter than the desk-height camera
 * the scenes declare.
 *
 * Returns 0 for any reading that isn't a believable eye height, which leaves
 * the HUD exactly where it sits today. Failing back to the shipped layout is
 * always safe; flinging the panels somewhere unreachable is not.
 */
export function hudEyeOffset(actualEyeY: number, designEyeY: number): number {
  if (!Number.isFinite(actualEyeY)) return 0
  if (actualEyeY < MIN_EYE_Y || actualEyeY > MAX_EYE_Y) return 0
  return actualEyeY - designEyeY
}

/**
 * Seconds to wait after the HUD mounts before sampling the head pose.
 *
 * The first frames of a session can still carry a stale or default pose, and
 * the sample is latched, so reading too early would pin the HUD at the wrong
 * height for the whole session.
 */
export const HUD_SETTLE_S = 0.5
