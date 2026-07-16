import type { Difficulty } from '../../types'
import type { Behavior } from '../rightway/logic'

/**
 * Right or Wrong 360 ("Schoolyard 360") — the immersive copy of Right or Wrong.
 *
 * Everything about the measurement is REUSED unchanged from the flat game:
 * the 80-item bank, the tier recipe per level (clear/subtle), the 5-construct ×
 * 2-valence composition, chance = 1/2 and the per-construct / per-valence
 * tallies. Only the presentation is immersive: instead of a frozen card
 * picture, the two kids ACT OUT the behaviour a few metres in front of the
 * child — the snatch lunges, the walk-past actually walks past, the queue-cut
 * runs to the front — so the scene itself carries the meaning of the sentence
 * rather than a generic tableau (the design brief for this port).
 *
 * The one new measure (shared with the other 360 games): each trial the little
 * scene plays at a sampled bearing across the front arc, so the child turns
 * the view — a head turn in VR — to find where it is happening. The signed
 * bearing is recorded on every answer.
 */
export {
  ACTIVITY_COUNT,
  BEHAVIORS,
  CHANCE,
  CONSTRUCTS,
  LEVEL_TIERS,
  MASTERY_THRESHOLD,
  PASS_THRESHOLD,
  buildLevel,
  scoreLevel,
  tallyByConstruct,
  tallyByValence,
  type Behavior,
  type BiText,
  type Construct,
  type LevelSummary,
  type Pose,
  type SceneCue,
  type Tier,
} from '../rightway/logic'

import { BEHAVIORS } from '../rightway/logic'

/* ---- acted-out staging ------------------------------------------------------
 * The flat game freezes a pose; here every behaviour is performed as a short
 * looping animation so the child can literally SEE the behaviour the narrator
 * describes. Each behaviour maps to one of these performances (the scene file
 * owns the keyframes):
 *
 *   greet       actor waves hello, friend waves back
 *   politeTalk  actor speaks kindly (pulsing heart), friend nods
 *   shout       actor leans in with an angry burst, friend flinches back
 *   offer       actor holds the toy out; it glides across; friend reaches
 *   grab        actor lunges and yanks the toy from the friend's hands
 *   hold        actor hugs the toy to their chest while the friend waits
 *   holdTurn    like hold, but the actor also turns away from the friend
 *   turnAway    the friend waves; the actor pivots away from them
 *   walkPast    the actor walks right across, head down, past the waving friend
 *   gentleTap   actor steps up and taps the friend's shoulder; friend turns
 *   crowd       actor steps in until the faces almost touch; friend leans back
 *   leanOver    friend is crouched over their work; actor bends right over them
 *   queueWait   a queue; the actor stands calmly at the back
 *   queueCut    the actor runs from the side straight to the front of the queue
 *   queueHog    the actor stays at the front, clutching the turn, queue waiting
 *   usherFirst  the actor waves the friend ahead of them ("you go first")
 *   pushThrough the actor barges between the queued kids (bump star)
 *   apologize   bump star, then the actor bows with hands together
 *   bumpWalkOff bump star, then the actor just walks away
 */
export type Performance =
  | 'greet'
  | 'politeTalk'
  | 'shout'
  | 'offer'
  | 'grab'
  | 'hold'
  | 'holdTurn'
  | 'turnAway'
  | 'walkPast'
  | 'gentleTap'
  | 'crowd'
  | 'leanOver'
  | 'queueWait'
  | 'queueCut'
  | 'queueHog'
  | 'usherFirst'
  | 'pushThrough'
  | 'apologize'
  | 'bumpWalkOff'

/** Behaviours whose cue combination alone would stage the wrong action —
 *  e.g. `walkpast` carries the same `turnAway` cue as `ignore`, but the text
 *  says Ravi *walks past*, so the actor must actually walk. */
const OVERRIDES: Record<string, Performance> = {
  walkpast: 'walkPast', // "walks right past his friend … says nothing"
  spillgo: 'walkPast', // "spills water … and just walks off"
  tap: 'gentleTap', // "taps her friend gently on the shoulder"
  leanover: 'leanOver', // "leans right over Meera's drawing"
  crowdbook: 'leanOver', // "leans in so close over Sana's book"
  letsmall: 'usherFirst', // "lets a smaller boy take his turn … before her"
  passturn: 'usherFirst', // "climbs down so the next child can go"
  taplong: 'queueHog', // "stays at the water tap a long, long time"
}

/**
 * Which performance acts out a behaviour. Derived from the flat game's scene
 * cues (they were authored to make the picture match the sentence) in priority
 * order, with per-id overrides where the cues alone under-tell the story.
 * Total: every one of the 80 banked behaviours resolves (see logic.test.ts).
 */
export function performanceFor(b: Behavior): Performance {
  const override = OVERRIDES[b.id]
  if (override) return override
  const { scene, pose } = b
  if (scene.bump) {
    if (scene.line) return 'pushThrough'
    return scene.turnAway ? 'bumpWalkOff' : 'apologize'
  }
  if (scene.toy === 'grab') return 'grab'
  if (scene.toy === 'offer') return 'offer'
  if (scene.toy === 'hold') {
    if (scene.line) return 'queueHog'
    return scene.turnAway ? 'holdTurn' : 'hold'
  }
  if (scene.turnAway) return 'turnAway'
  if (pose.close) return 'crowd'
  if (scene.line) return (pose.lean ?? 0) >= 0.35 ? 'queueCut' : 'queueWait'
  if ((pose.lean ?? 0) >= 0.3) return 'shout'
  if (scene.polite) return 'politeTalk'
  return 'greet'
}

/** Everything the scene needs to stage one behaviour. */
export interface Staging {
  performance: Performance
  /** show the waiting queue of kids (from the flat scene's `line` cue) */
  line: boolean
  /** show the toy the exchange is about */
  toy: boolean
  /** show the kind-words heart over the actor (flat scene's `polite` cue) */
  heart: boolean
  /** the behaviour's emoji, shown in a speech bubble over the actor so the
   *  specific object/action of the sentence (🍪, 🖍️, 🚰…) is visible */
  bubble: string
}

export function stagingFor(b: Behavior): Staging {
  return {
    performance: performanceFor(b),
    line: !!b.scene.line,
    toy: !!b.scene.toy,
    heart: !!b.scene.polite,
    bubble: b.bubble,
  }
}

/* ---- where the scene plays --------------------------------------------------
 * The little scene is staged at a sampled bearing across the front arc, so
 * finding it is a comfortable head turn, never a spin (same comfort rule as
 * Park 360). Bearings are dealt in shuffled cycles so a session sweeps the
 * whole arc instead of favouring one side.
 */
export const STAGE_BEARINGS_DEG = [-50, -25, 0, 25, 50]
/** nothing playable ever sits further out than this (front arc guard) */
export const FRONT_ARC_DEG = 55
/** how far away the two kids perform (metres) */
export const STAGE_RADIUS = 4.2

/** One stage bearing per trial, dealt in shuffled cycles over the arc. */
export function stageBearings(count: number, rng: () => number = Math.random): number[] {
  const out: number[] = []
  while (out.length < count) {
    const cycle = [...STAGE_BEARINGS_DEG]
    for (let i = cycle.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[cycle[i], cycle[j]] = [cycle[j], cycle[i]]
    }
    // avoid the same spot twice in a row across the cycle seam
    if (out.length > 0 && cycle[0] === out[out.length - 1]) {
      ;[cycle[0], cycle[1]] = [cycle[1], cycle[0]]
    }
    out.push(...cycle)
  }
  return out.slice(0, count)
}

/** Convert a bearing to floor coordinates (bearing 0 = forward, toward -z). */
export function bearingToXZ(bearingRad: number, radius: number): [number, number] {
  return [Math.sin(bearingRad) * radius, -Math.cos(bearingRad) * radius]
}

/** Floor [x, z] of the stage centre for a bearing in degrees. */
export function stagePosition(bearingDeg: number): [number, number] {
  return bearingToXZ((bearingDeg * Math.PI) / 180, STAGE_RADIUS)
}

/* ---- the two judgment cards -------------------------------------------------
 * The response set stays the flat game's two symmetric thumbs — chance 1/2 at
 * every level, and neither card looks like "the right answer". The cards hang
 * below the stage (nearer the child, so they project beneath the actors) and
 * follow the stage's bearing, so the child never has to look away from the
 * scene to answer.
 */
export const CARD_RADIUS = 2.4
export const CARD_Y = 0.8
/** angular offset of the two cards either side of the stage bearing */
export const CARD_SPREAD_DEG = 13

export function cardBearingDeg(i: number, stageDeg: number): number {
  return stageDeg + (i === 0 ? -CARD_SPREAD_DEG : CARD_SPREAD_DEG)
}

export function cardPosition(i: number, stageDeg: number): [number, number] {
  return bearingToXZ((cardBearingDeg(i, stageDeg) * Math.PI) / 180, CARD_RADIUS)
}

/* ---- child-facing score ------------------------------------------------------
 * The flat game deliberately shows no running tally (watching it move is extra
 * corrective feedback); the same rule holds here — points are only revealed on
 * the game-over screen.
 */
export const POINTS_PER_CORRECT = 10

export function pointsFor(correct: boolean): number {
  return correct ? POINTS_PER_CORRECT : 0
}

/** Stars reward session accuracy: 3 ≥80%, 2 ≥50%, else 1 — finishing always earns one. */
export function starsFor(correct: number, total: number): number {
  const ratio = total > 0 ? correct / total : 0
  if (ratio >= 0.8) return 3
  if (ratio >= 0.5) return 2
  return 1
}

/* ---- look-around drag guards (same as the other 360 games) ----------------- */

/**
 * How far the pointer travelled between press and release, in screen pixels —
 * used to ignore "taps" that were really look-around drags. Screen events
 * (r3f) report this as `delta`; XR controller/hand events (pmndrs/
 * pointer-events) *throw* on accessing it, so those count as clean taps.
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
 * ignored right after a drag. Lives here (not in the scene file) so hot reload
 * never duplicates it and the guard is unit-testable.
 */
export const lookDrag = { px: 0, endedAt: 0 }

/** whether a click arriving now is just the tail end of a look-around drag */
export function isDragTail(now: number = Date.now()): boolean {
  return lookDrag.px > 8 && now - lookDrag.endedAt < 700
}

/** Sanity hook for tests: every banked behaviour must stage something. */
export function allPerformances(): Map<string, Performance> {
  return new Map(BEHAVIORS.map((b) => [b.id, performanceFor(b)]))
}

/** Trials per session at each difficulty — same 10 as the flat game. */
export function sessionLength(_difficulty: Difficulty): number {
  return 10
}
