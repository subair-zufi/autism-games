import type { Difficulty } from '../../types'

/**
 * Park 360 — *initiating* joint attention (IJA), immersive.
 *
 * The exact game design of Look What I Found! (see discovery/logic.ts) lifted
 * into a first-person 360° park: the child stands on the lawn and turns the
 * view (a real head turn in VR) to spot the surprise, taps it (the "point")
 * and taps the friend (the "hey, look!") — the same two-tap IJA loop, same
 * measurement (a share is `spontaneous` iff un-nudged; latency runs from
 * surprise onset to the friend tap), same fading scaffold across difficulty
 * (big surprises + quick nudges on easy → tiny surprises + no nudges on hard).
 *
 * The one deliberate 360 change is ergonomic, not behavioural: every playable
 * thing — surprise spots, the friend, the HUD — lives in the FRONT half-circle
 * (±FRONT_HALF_ARC), so following the game is a comfortable head turn along
 * the lawn, never a body spin to search behind you (Quest pilot feedback on
 * Museum 360). Trees and sky still wrap the full 360° so the park feels real
 * when the child does look around.
 */

/**
 * The ten surprises — every one a living thing a child already knows and likes.
 *
 * They replace a set that mixed animals with abstractions (a gem, a rainbow).
 * The task is to SHOW something to a friend, and a child shows a rabbit or a
 * peacock with far more of the shared delight this game exists to produce than
 * they show a floating crystal. Ten rather than six also means a child playing
 * all three levels in one session meets far fewer repeats.
 *
 * Kerala-familiar on purpose, since that is where this deploys: a parrot, a
 * peacock and a squirrel are everyday garden sights there, not exotica.
 */
export type DiscoveryId =
  | 'butterfly'
  | 'bunny'
  | 'parrot'
  | 'sunflower'
  | 'puppy'
  | 'kitten'
  | 'squirrel'
  | 'duckling'
  | 'ladybird'
  | 'peacock'

export const DISCOVERIES: DiscoveryId[] = [
  'butterfly',
  'bunny',
  'parrot',
  'sunflower',
  'puppy',
  'kitten',
  'squirrel',
  'duckling',
  'ladybird',
  'peacock',
]

/** half-width of the playable arc: nothing interactive sits beyond ±this */
export const FRONT_HALF_ARC_DEG = 55

/** A place on the lawn a surprise can appear. */
export interface Spot {
  /** signed bearing from straight-ahead, degrees left(−)/right(+) */
  bearingDeg: number
  /** distance from the child (the child never moves) */
  radius: number
}

/**
 * Where a surprise can appear — nine spots, held SEPARATELY from what appears
 * in them.
 *
 * They used to be one and the same: each surprise owned a bearing, so the bird
 * was always dead ahead at 6.2 m and the bunny always 18° to the left. A child
 * only has to notice that once and the search stops being a search — they learn
 * where to look from what they heard, and attention-getting turns into recall.
 * Ten surprises across nine spots gives ninety combinations instead of six
 * fixed ones, so where to look can only ever be found by looking.
 *
 * Every spot also has to stay clear of the FRIEND, and by more than it first
 * looks. The friend's widest part is not their body (7.5° at 4.6 m) but the
 * name plate floating over their head, which is 1.1 m across — 13.6°. Add the
 * widest a surprise ever gets (16.4° for a big-saliency one at the nearest
 * spot) and a surprise needs 17° of bearing clearance before it stops
 * overlapping them on screen. A first pass used a flat 10° rule and put a spot
 * at +25°, where the easy-tier butterfly sat squarely across the friend's name
 * tag — findable, but ambiguous with the very person the child is meant to
 * turn and show it to, which is the other half of the two-tap loop.
 *
 * With the friend at +40° that caps the usable right side at about +23°, and
 * the arc only reaches +55°, so there is nothing beyond them either. The spread
 * is therefore still left-leaning — less so than the old set, where five of six
 * surprises sat at negative bearings, but the lawn's right-hand side belongs to
 * the friend and cannot be shared. Balancing it properly means moving or
 * alternating the friend, which changes the turn-to-friend cost the study
 * records, so it is left as a separate decision.
 */
/** How many places a surprise can appear in any one session. */
export const SPOT_COUNT = 9

/** Widest a surprise ever gets from the child: the normalised half-extent
 *  (`NOMINAL_HALF`) at the largest saliency, seen from the nearest spot. */
export const MAX_SURPRISE_HALF_DEG = 12.2
/** The friend's floating name plate, their widest part, as a half-angle. */
export const FRIEND_HALF_DEG = 6.8
/** Bearing a surprise must keep from the friend: both their half-widths. */
export const FRIEND_CLEARANCE_DEG = MAX_SURPRISE_HALF_DEG + FRIEND_HALF_DEG

/** Distances the spots cycle through, so the row is never a flat arc. Every
 *  one stays INSIDE the fence (see FENCE_R): a surprise beyond it was being
 *  cut in half by the rails. */
const SPOT_RADII = [4.8, 5.8, 4.5, 5.6, 4.9, 5.9, 5.2, 5.7, 5.4]

/**
 * Lay the surprise spots out around wherever the friend happens to be today.
 *
 * They used to be a fixed list that dodged one fixed friend, which left them
 * permanently bunched to the left. Deriving them instead means the surprises
 * always fill whichever side of the lawn the friend is NOT on — so when the
 * friend moves (see `FRIEND_SPOTS`) the search area moves with them, and
 * across sessions the child turns left to find as often as right.
 *
 * The friend always kneels toward one edge of the arc, so the band their
 * clearance zone eats is at one end and what remains is a single stretch. The
 * spots then spread evenly across it, which is the property that matters: no
 * part of the child's search space over- or under-sampled.
 */
export function spotsFor(friendBearingDeg: number): Spot[] {
  // The friend's clearance zone splits the arc in two. Take the WIDER side and
  // leave the sliver on their far side alone: a surprise out there would sit
  // beyond the friend from the child's point of view, so finding it would mean
  // looking straight past the person they are about to show it to.
  const leftWidth = friendBearingDeg - FRIEND_CLEARANCE_DEG - -FRONT_HALF_ARC_DEG
  const rightWidth = FRONT_HALF_ARC_DEG - (friendBearingDeg + FRIEND_CLEARANCE_DEG)
  const useRight = rightWidth >= leftWidth
  const lo = useRight ? friendBearingDeg + FRIEND_CLEARANCE_DEG : -FRONT_HALF_ARC_DEG
  const hi = useRight ? FRONT_HALF_ARC_DEG : friendBearingDeg - FRIEND_CLEARANCE_DEG
  const step = (hi - lo) / (SPOT_COUNT - 1)
  return Array.from({ length: SPOT_COUNT }, (_, i) => ({
    bearingDeg: Math.round(lo + i * step),
    radius: SPOT_RADII[i % SPOT_RADII.length],
  }))
}

/**
 * Where the friend kneels at their flowerbed — chosen per LEVEL, and varied
 * within each level across sessions.
 *
 * They used to stand at +40° in every round of every session of every level.
 * That makes the friend-directed head turn a constant: the child learns one
 * movement and repeats it, and "turn to your friend" stops being an act of
 * seeking somebody out. It also means the analysis cannot tell the cost of
 * turning to the friend apart from the habit of turning right.
 *
 * So the levels place them differently, and the placement itself is part of
 * the fading scaffold the rest of this file already builds:
 *
 *  - easy   — always on the LEFT, and the nearer of the two spots. The child's
 *             first experience of showing somebody something is the shortest,
 *             most forgiving turn, toward a friend who is always where they
 *             were last time.
 *  - medium — always on the RIGHT. A mirror of what easy taught, so a child
 *             cannot carry the direction over and must read the scene afresh.
 *  - hard   — EITHER side, and furthest out. The child has to find their friend
 *             before they can show them anything, which is the last piece of
 *             scaffolding left to remove.
 *
 * Two spots per level rather than one so that the position is not a landmark
 * to be memorised even within a level; which of them is used is drawn once per
 * session, and recorded on every step so analysis can model the turn.
 */
export interface FriendSpot {
  bearingDeg: number
  radius: number
}

export const FRIEND_SPOTS: Record<Difficulty, FriendSpot[]> = {
  easy: [
    { bearingDeg: -28, radius: 4.2 },
    { bearingDeg: -41, radius: 4.7 },
    { bearingDeg: -54, radius: 5.2 },
  ],
  medium: [
    { bearingDeg: 28, radius: 4.2 },
    { bearingDeg: 41, radius: 4.7 },
    { bearingDeg: 54, radius: 5.2 },
  ],
  hard: [
    { bearingDeg: -54, radius: 5.2 },
    { bearingDeg: -41, radius: 4.7 },
    { bearingDeg: -28, radius: 4.2 },
    { bearingDeg: 28, radius: 4.2 },
    { bearingDeg: 41, radius: 4.7 },
    { bearingDeg: 54, radius: 5.2 },
  ],
}

/**
 * The smallest move between two of a level's spots that still reads as the
 * friend being somewhere ELSE.
 *
 * A first attempt gave each level two spots 7° apart. The code did exactly what
 * it said — easy drew left, medium drew right — but 7° at four metres is about
 * a shoulder's width, so from inside the headset the friend was in the same
 * place every single session and the variation may as well not have existed.
 * Spots are now 13° apart across a 26° spread, which is an unmistakably
 * different patch of lawn.
 */
export const MIN_FRIEND_SPREAD_DEG = 12

/** Draw this session's friend spot for `difficulty`. */
/**
 * Draw this session's friend spot, given where they were last session.
 *
 * Not a fresh uniform draw. Hard holds three spots on each side, and drawing
 * independently every session meant a one-in-eight chance of three lefts in a
 * row and a one-in-sixteen chance of four — which is exactly what came back
 * from play: "the hard level is on the left only". Reloading the page between
 * plays makes it worse, because every draw is then independent of every other.
 * Random and varied are not the same thing, and the child only experiences the
 * sequence they actually got.
 *
 * So the side ALTERNATES wherever a level has both, and the position never
 * repeats. Strict alternation is predictable in principle, but no child is
 * modelling it, and it guarantees what matters twice over: they meet their
 * friend on both sides, and the study gets left/right exposure counterbalanced
 * rather than left to chance — the same reasoning that put the emotion games'
 * answer bearings on a shuffled cycle instead of an independent draw.
 *
 * `last` is the previous session's spot, or null for a child's first ever go.
 */
export function pickFriendSpot(
  difficulty: Difficulty,
  last: FriendSpot | null = null,
  rng: () => number = Math.random,
): FriendSpot {
  const all = FRIEND_SPOTS[difficulty]
  if (!last) return all[Math.floor(rng() * all.length)]
  // never the same patch of lawn twice running
  const moved = all.filter((s) => s.bearingDeg !== last.bearingDeg)
  // and where the level has both sides, always the other one: which way they
  // had to turn is the thing a child actually notices
  const swapped = moved.filter((s) => Math.sign(s.bearingDeg) !== Math.sign(last.bearingDeg))
  const pool = swapped.length > 0 ? swapped : moved
  return pool[Math.floor(rng() * pool.length)]
}

/**
 * Where the friend was last session, per level, remembered across reloads.
 *
 * It has to outlive the page: a facilitator restarting the headset browser
 * between runs is the normal case, not the exception, and an in-memory cycle
 * would start afresh each time and hand back the same independent draw this
 * exists to avoid. Kept beside the picker rather than in the settings store
 * because it is this game's bookkeeping, not a choice anybody made about the
 * child. Every read and write is guarded: a private window, cleared site data
 * or a thrown accessor just means the next draw is a free one.
 */
const LAST_FRIEND_KEY = 'park360-last-friend'

export function rememberedFriendSpot(difficulty: Difficulty): FriendSpot | null {
  try {
    const raw = localStorage.getItem(`${LAST_FRIEND_KEY}-${difficulty}`)
    if (!raw) return null
    const bearing = Number(raw)
    return FRIEND_SPOTS[difficulty].find((s) => s.bearingDeg === bearing) ?? null
  } catch {
    return null
  }
}

export function rememberFriendSpot(difficulty: Difficulty, spot: FriendSpot): void {
  try {
    localStorage.setItem(`${LAST_FRIEND_KEY}-${difficulty}`, String(spot.bearingDeg))
  } catch {
    /* no storage: the next session simply draws freely */
  }
}

/** Convert a bearing to floor coordinates (bearing 0 = forward, toward -z). */
export function bearingToXZ(bearingRad: number, radius: number): [number, number] {
  return [Math.sin(bearingRad) * radius, -Math.cos(bearingRad) * radius]
}

/* ---- scenery, and why none of it stands in the child's way ---------------
 *
 * These live here, beside the spot layout they have to keep clear of, because
 * the two are one problem — exactly as the avatar's geometry sits beside the
 * pedestal row in Museum 360. Keeping them here also makes "the play area stays
 * clear" a property a test can hold, rather than something that has to be
 * noticed in a screenshot.
 *
 * The tree ring used to run the whole way round at 13-19 m, which put four
 * crowns INSIDE the play arc, at +15, +48, -20 and -52 degrees. A surprise
 * never vanished behind one — it is metres nearer — but a small animal against
 * two metres of dark green crown is a figure with no ground, and the subtle
 * tier is exactly where that costs a child the find.
 *
 * The bushes were worse. Two sat at -47 and +29 degrees at 4.7 m and 5.3 m,
 * NEARER than several surprise spots, so they did not merely clutter the
 * background: they stood in front of the surprise and hid it outright.
 */

/** Nothing decorative stands within this many degrees of straight ahead. */
export const SCENERY_FRONT_CLEAR_DEG = 78

/** The tree line: wrapping the back, leaving the whole front open. */
export const TREE_PLACEMENTS: Array<{ bearingDeg: number; radius: number; scale: number }> =
  Array.from({ length: 10 }, (_, i) => ({
    bearingDeg:
      SCENERY_FRONT_CLEAR_DEG + (i * (360 - 2 * SCENERY_FRONT_CLEAR_DEG)) / 9,
    radius: 15 + (i % 3) * 2.5,
    scale: 1.6 + (i % 2) * 0.5,
  }))

/** Bushes, flanking and behind the child rather than among the surprises. */
export const BUSH_PLACEMENTS: Array<{ bearingDeg: number; radius: number }> = [
  { bearingDeg: -82, radius: 5.2 },
  { bearingDeg: 86, radius: 5.6 },
  { bearingDeg: 128, radius: 4.8 },
  { bearingDeg: -134, radius: 5.0 },
]

/** The picket fence, set clear of the furthest surprise spot so its rails
 *  never cut across one (it used to sit inside the spot range). */
export const FENCE_RADIUS = 7.6

/** Floor [x, z] of anything placed on the lawn by bearing and distance. */
export function placeOnLawn(at: { bearingDeg: number; radius: number }): [number, number] {
  return bearingToXZ((at.bearingDeg * Math.PI) / 180, at.radius)
}


/** How loudly the surprise announces itself when it appears. */
export type Saliency = 'big' | 'medium' | 'subtle'

export interface DiscoveryConfig {
  saliency: Saliency
  /**
   * ms after the surprise appears before a helper nudge fires (and repeats).
   * `null` = no nudges ever — success must be fully self-initiated.
   */
  nudgeAfterMs: number | null
  /** how far the friend has turned away from the play area (radians) */
  awayYaw: number
  /** completed shares needed to win a session */
  goal: number
}

export const CONFIG: Record<Difficulty, DiscoveryConfig> = {
  easy: { saliency: 'big', nudgeAfterMs: 4000, awayYaw: 0.9, goal: 5 },
  medium: { saliency: 'medium', nudgeAfterMs: 8000, awayYaw: 1.7, goal: 6 },
  hard: { saliency: 'subtle', nudgeAfterMs: null, awayYaw: 2.6, goal: 8 },
}

/**
 * On Hard (never nudged — success must be fully self-initiated) a child who
 * never acts produces no telemetry at all for that round, the single most
 * clinically interesting case (a non-initiating child). After this long with
 * no share, the round logs a one-off `no_share` timeout event without ending
 * or resetting the round — the child can still complete it any time after.
 */
export const NO_SHARE_TIMEOUT_MS = 20000

/**
 * Child-facing points. Spontaneous (un-nudged) shares earn more than prompted
 * ones; prompted shares are still rewarded, never punished.
 */
export const POINTS = { spontaneous: 10, prompted: 5, streakBonus: 2 }
/** consecutive spontaneous shares needed before the streak bonus kicks in */
export const STREAK_LEN = 3

export function pointsFor(spontaneous: boolean, streakAfterThis: number): number {
  if (!spontaneous) return POINTS.prompted
  return POINTS.spontaneous + (streakAfterThis >= STREAK_LEN ? POINTS.streakBonus : 0)
}

/**
 * Stars reward *spontaneous* shares (the game never fails — a nudged share
 * still completes the round). 3 stars ≥80% spontaneous, 2 ≥50%, else 1 —
 * every finished session earns at least one.
 */
export function starsFor(spontaneousShares: number, goal: number): number {
  const ratio = goal > 0 ? spontaneousShares / goal : 0
  if (ratio >= 0.8) return 3
  if (ratio >= 0.5) return 2
  return 1
}

export interface Round {
  discovery: DiscoveryId
  /** index into `SPOTS` — drawn independently of the surprise itself */
  spot: number
}

/**
 * Deal the next round: a surprise, and somewhere for it to appear.
 *
 * The two are drawn independently, and neither repeats the round before — so
 * the child can never predict where to look from what they just saw, and never
 * sees the same thing twice running. Passing the whole previous round (rather
 * than just the previous surprise) is what lets the spot avoid repeating too.
 */
export function makeRound(prev: Round | null, rng: () => number = Math.random): Round {
  const things = DISCOVERIES.filter((d) => d !== prev?.discovery)
  const spots = Array.from({ length: SPOT_COUNT }, (_, i) => i).filter((i) => i !== prev?.spot)
  return {
    discovery: things[Math.floor(rng() * things.length)],
    spot: spots[Math.floor(rng() * spots.length)],
  }
}

/** ms the calm empty park lingers before the next surprise pops (randomised). */
export function spawnDelayMs(rng: () => number = Math.random): number {
  return 900 + Math.round(rng() * 1600)
}

/** Visual appearance for the 3D friend avatar — same body plan as Roll-Back Buddy. */
export interface Look {
  skin: string
  hair: string
  shirt: string
  pants: string
  longHair: boolean
}

export interface Friend {
  /** Malayalam name (shown when the app language is Malayalam). */
  name: string
  /** Romanized name for English. */
  nameEn: string
  look: Look
}

/** Same trio of Kerala playmates as Roll-Back Buddy, so faces feel familiar. */
export const FRIENDS: Friend[] = [
  { name: 'അമ്മു', nameEn: 'Ammu', look: { skin: '#f4c9a3', hair: '#2b2118', shirt: '#e2554c', pants: '#3f5aa9', longHair: true } },
  { name: 'അപ്പു', nameEn: 'Appu', look: { skin: '#d9a066', hair: '#171311', shirt: '#5aa9e6', pants: '#444c55', longHair: false } },
  { name: 'മീനു', nameEn: 'Meenu', look: { skin: '#c68642', hair: '#1c1713', shirt: '#7ac74f', pants: '#7a4a8a', longHair: true } },
]

export function pickFriend(rng: () => number = Math.random): Friend {
  return FRIENDS[Math.floor(rng() * FRIENDS.length)]
}

/**
 * How far the pointer travelled between press and release, in screen pixels —
 * used to ignore "taps" that were really look-around drags. Screen events
 * (r3f) report this as `delta`; XR controller/hand events (pmndrs/
 * pointer-events) *throw* on accessing it, so those count as clean taps —
 * correct, since in VR the head does the looking and no drag exists.
 */
export function dragDistance(e: { delta?: number }): number {
  try {
    return e.delta ?? 0
  } catch {
    return 0
  }
}

/**
 * The last look-around drag, measured by the scene's own controls. Taps are
 * ignored right after a drag — independent of which event system delivered
 * the click, since the XR layer forwards a second copy of every screen event
 * whose drag distance is unreadable (see dragDistance). Lives here (not in
 * the scene file) so hot reload never duplicates it and the guard is
 * unit-testable.
 */
export const lookDrag = { px: 0, endedAt: 0 }

/** whether a click arriving now is just the tail end of a look-around drag */
export function isDragTail(now: number = Date.now()): boolean {
  return lookDrag.px > 8 && now - lookDrag.endedAt < 700
}
