# Expert Review — Joint Attention VR pair (Museum 360 · Park 360)

**Date:** 2026-11-15 · **Reviewed against:** `claude/compassionate-ride-yy7uea` @ `61e36f8`
**Lenses:** VR game development · UI/UX · autism accessibility · pedagogy & measurement
**Companion to:** `docs/vr-games-expert-review.md` (2026-07-16). That review's items are mostly
shipped; this is a fresh pass on the two joint-attention games only.

| | Museum 360 (`museum360`) | Park 360 (`park360`) |
|---|---|---|
| Construct | Joint attention — **responding** (RJA) | Joint attention — **initiating** (IJA) |
| Loop | Follow a fading point/gaze cue to one of 3–5 exhibits | Spot a surprise, tap it, tap the friend |
| Files | `src/games/museum360/` | `src/games/park360/` |

## Method

- Full read of both games (`logic.ts`, `*Game.tsx`, `*Scene.tsx`, `strings.ts`, `xrStore.ts`)
  plus the shared VR layer: `headAim.ts`, `HeadSelect.tsx`, `oneEuro.ts`, `confirmTracking.ts`,
  `headTracking.ts`, `hudAnchor.ts`, `VRHudAnchor.tsx`, `VRStarBurst.tsx`, `VRQuitButton.tsx`,
  `Instanced.tsx`, `xrInput.ts`, `exitVr.ts`, `vrPractice/`, `useGameAnalytics.ts`,
  `progression.ts`, `state/settings.ts`, `services/{sounds,speech}.ts`.
- `npx tsc -b` → clean. `npx vitest run` → **487/487 pass, 55 files**.
- Both games rendered in headless Chromium with the WebGL context instrumented to count
  real `drawElements`/`drawArrays` calls and shader compiles per frame.
- One reproduction test written and executed for finding **C1** (see below), plus the proposed
  fix applied and re-verified. Both were reverted; the working tree is unchanged.

> **Caveat on the screenshots.** The headless renderer is SwiftShader (software). A control
> scene — pure three.js, no app code — reproduced a depth artifact in which a large ground disc
> swallows nearby geometry below the horizon. Anything I say about the **lower half** of the
> field of view is therefore unverified; only the angular arithmetic is load-bearing there.

---

## 1. Strengths

**Construct fidelity is the best I have seen in a VR autism intervention of this size.**

- Museum 360's prompt hierarchy (`pulse → hover → distal → gaze`) fades *within* a session on a
  3-success streak and backs off one rung on error (`fadedTier`/`supportedTier`) — textbook
  least-to-most prompting, and the fading is a recorded variable, not a hidden heuristic.
- Gaze trials are scheduled evenly, never on trial 1, and a missed gaze trial falls back to the
  hand for the retry (`trialCue`). This is a proper RJA probe schedule, not a difficulty knob.
- The attention bid is **contingent**: the avatar holds eye contact with the child until their
  head is within `EYE_CONTACT_TOL_DEG` (15°), with a 6 s fallback so a round cannot stall
  (`Museum360Scene.tsx` `HelperFigure`). Contingency is the defining property of a
  joint-attention bid, and most VR implementations fake it with a timer.
- Park 360 scores a share as `spontaneous` **iff** `nudgeCount === 0`, and prices prompted
  shares at half. The friend celebrates *the act of showing*, not the object — the correct
  construct distinction between sharing and requesting, and it is implemented deliberately.
- Errorless economy throughout: wrong taps are gently corrected, never end a round, and every
  finished session earns ≥1 star (`starsFor`).

**The gaze-dwell accessibility work is genuinely best-practice.**

- Two-stage arm → confirm (`headAim.ts`) is the standard Midas-touch fix and is well argued.
- Dwell progress **drains** instead of resetting, with a grace window (`CONFIRM_GRACE_MS`), so a
  postural tremor no longer deletes a child's accumulated dwell. The code comment explaining why
  — children who found the target and still could not answer — is exactly the right analysis.
- A One-Euro filter smooths the **ray only**, never the rendered camera (`HeadSelect.tsx`).
  Smoothing the view would invite simulator sickness; this is the correct call and it is
  explicitly reasoned about.
- Three dwell profiles per child, changeable live from the trainer's phone, and
  **recorded on every step** — because response latency is bounded below by dwell time, pooling
  profiles would be invalid. `confirmTracking.ts` separates the motor confirmation cost from the
  attention measure (`dwellArmToConfirmMs`, `dwellArmedNoConfirm`, `dwellConfirmedBy`). That is
  research-grade instrument design, not UX polish.
- The facilitator can release a choice the child armed but cannot confirm — and that trial's
  motor-cost field is deliberately left **null** rather than contaminated.

**VR comfort and safety are handled correctly.**

- The camera **never translates** in either game. No locomotion, no teleport, no vection — the
  single largest cause of VR sickness is designed out, not mitigated. `teleportPointer: false`.
- Everything interactive lives in the front arc (Museum ±32.8° of child heading, Park ±55°), so
  play is a head turn, never a body spin.
- Damped look controls (`k = min(1, dt*9)`), pitch clamped to roughly −29°…+24°.
- `frameRate: 'low'` deliberately requests the headset's **lowest** refresh rate rather than its
  highest, with a clear-eyed comment about reprojection making input sampling feel late. This is
  an unusually mature decision.
- `foveation: 1` pinned so a browser update cannot move the frame budget under the study.
- `FLAT_SCREEN_DPR` capped at 1.5 for the pre-VR flat view on the headset browser.
- `VRHudAnchor` slides the HUD to the wearer's **real** eye height (a 7–10 year-old sits
  0.2–0.6 m below the authored camera), with a floor so panels never sink through the floor.
  Sustained upward gaze is the uncomfortable direction and the code says so.
- `exitVr.ts` waits for the flat page to be visible *and painting* before navigating, after a
  real incident where children were stranded in the Quest home environment.
- `VRQuitButton` is **controller-only, never gaze** — after a child's gaze drifted onto it and
  quit the game. The one control where accidental selection is unrecoverable, correctly hardened.

**Performance is already good — measured, not assumed.**

| Scene | Draw calls / frame | Shader compiles during play |
|---|---|---|
| Museum 360 (easy and hard) | **86** | 0 |
| Park 360 (easy and hard) | **42** | 0 |

The `Instanced` helper replaced 97 sign blocks and 89 park props with 1 and 8 batches. Zero
shader compiles during play means the per-round exhibit remount causes **no** mid-session
pipeline hitch. **Do not spend effort reducing draw calls** — see §4.7 for the real lever.

**Sensory design holds up to a formal audit.**

- Nothing flashes near the photosensitive-epilepsy threshold. The fastest periodic visual is the
  star-burst wobble at `sin(dt*11)` ≈ **1.75 Hz**; the pulse rings run at ~0.5 Hz, the butterfly
  flaps at ~1.1 Hz. All well under 3 Hz, and none is a luminance flash.
- Audio is soft sine tones with a 30 ms attack ramp and an exponential decay (`sounds.ts`), peak
  gain 0.15. No sudden onsets, no percussive transients.
- Palettes are matte and low-contrast for the environment, saturated only for the *targets* —
  correct figure-ground separation for the task.
- One language is rendered and spoken at a time; TTS rate is slowed to 0.9.

---

## 2. Critical issues

### C1 — Park 360 keeps running after the child leaves it `[CONFIRMED BY TEST]`

**`src/games/park360/Park360Game.tsx:336`** schedules the next round with an untracked timer:

```tsx
setTimeout(() => beginRound(round.discovery), 2000)   // return value discarded
```

`clearTimers()` (the unmount cleanup, line 103) only clears `spawnTimer`, `nudgeTimer` and
`noShareTimer`. If the game unmounts during the 2 s celebration — the child or trainer presses
Quit (`VRQuitButton` → `exitVrToHome` → hash navigation), or the trainer sends the child to the
next game from the phone remote (`remote/commands.ts`) — this timer survives and restarts the
whole machine on a dead component:

```
unmount → clearTimers() (all three refs already null)
        → 2 s timer fires → beginRound() → spawnTimer set (uncleanable: cleanup already ran)
        → recordStep('event_ready')  +  beginHeadWindow()
        → armNudge() → fireNudge() → playGentle() + speak() + recordStep('nudge') → armNudge() …
```

`fireNudge` re-arms itself, so this **never stops** until the tab is reloaded.

I reproduced this with a test harness that stubs the 3D scene and the analytics hook. After
unmount, with 60 s of virtual time:

```
expected [] , received
[ "event_ready", "nudge", "nudge", "nudge", "nudge", "nudge", "nudge", "nudge",
  "nudge", "nudge", "nudge", "nudge", "nudge", "nudge", "nudge" ]
```

Consequences, in severity order:

1. **A chime and a spoken nudge fire every 4 s (easy) or 8 s (medium), forever** — on the Home
   screen, or over the top of the *next* game the child is playing. For a sound-sensitive child
   in a headset, unexplained recurring speech is exactly the wrong failure mode.
2. **Analytics contamination.** `useGameAnalytics.recordStep` has no unmount guard, and
   `ensureSession()` will open a **brand-new `park360` session** (because `finishGame` was never
   reached) and keep posting `nudge` steps into it. Your dataset acquires phantom Park 360
   sessions with nudges and no shares — which is precisely the signature of a non-initiating
   child, the clinically most interesting case. This is a data-integrity bug, not just a leak.
3. An unbounded self-rescheduling timer for the lifetime of the tab.

Fix in §4.1. Verified: with the patch applied the same test passes.

### C2 — Park 360 cuts off its own payoff line on the final share

`completeShare` (`Park360Game.tsx:305`, `:329`):

```tsx
say('sayWow', { label: discoveryLabel(round.discovery, lang) })   // "Wow! A Butterfly! Thanks…"
praise()
if (nextShared >= cfg.goal) {
  …
  say('sayWin')      // speak() calls speechSynthesis.cancel() first
```

`speak()` begins with `window.speechSynthesis.cancel()` (`services/speech.ts:36`). The two calls
are in the same synchronous block, so on the **last** share of every session the child hears
*"Wow! A Butt—"* clipped mid-word and replaced by the win line. The shared-affect moment the
whole game exists to deliver is the one that gets destroyed.

### C3 — Two voices talk at once on every correct answer (both games)

`praise()` plays a **pre-recorded WebAudio clip**; `say()` uses **speechSynthesis**. They are
different subsystems, so they do not cancel each other — they overlap:

- `Museum360Game.tsx:210-231` — `playSuccess()` (3-note chord) + `praise()` ("Great job!") +
  `say('sayCorrect')` ("Yes! The Butterfly!"), all started within the same tick.
- `Park360Game.tsx:300-306` — same pattern.

Three concurrent audio streams, one of which is two human voices speaking different words
simultaneously. For auditory-hypersensitive children this is a startle/overload risk; for
children with receptive-language difficulty it makes the label — the one piece of vocabulary
teaching in the game — unintelligible. Sequence them (§4.3).

### C4 — Museum 360 Hard: adjacent hit boxes overlap, and options are unequally salient

The exhibits sit on an arc centred on the **avatar**, so their distance from the **child**
varies. Computed from `slotPosition`/`slotHeadingDeg` with the shipped
`boxGeometry args={[1, 1.2, 1]}` tap target:

| n | i | dist (m) | heading | hit box | gap to neighbour |
|---|---|---|---|---|---|
| 5 | 0 | 4.98 | −32.8° | **11.5°** | — |
| 5 | 1 | 3.74 | −22.6° | **15.2°** | **10.2°** |
| 5 | 2 | 3.20 | 0.0° | **17.8°** | 22.6° |
| 5 | 3 | 3.74 | +22.6° | 15.2° | 22.6° |
| 5 | 4 | 4.98 | +32.8° | 11.5° | **10.2°** |

Two separate problems fall out:

1. **Hit boxes overlap by ~3.1°** on both outer pairs. Exhibit 0 spans [−38.6°, −27.1°];
   exhibit 1 spans [−30.2°, −15.0°]. In the shared band the raycaster returns the **nearer**
   object — exhibit 1. So a child who looks squarely at the inner quarter of the outermost
   exhibit selects its neighbour. That is logged as
   `errorType: 'adjacent'` — indistinguishable from "followed the cue's direction but not far
   enough", which is a *behavioural* category in your error taxonomy. **The primary dependent
   variable absorbs a geometry defect, at the hardest level, on the trials that matter most.**
   The screenshot corroborates it: at n=5 the outermost exhibit is visibly part-occluded by its
   neighbour.
2. **Unequal target salience.** The centre option subtends 17.8° and the outermost 11.5° — a
   **55% apparent-size advantage** for the centre. In a forced-choice task, a larger, nearer,
   easier-to-hit option pulls errors toward itself. Your `adjacent`/`far` taxonomy will read that
   pull as cue-following behaviour. This is a confound in the Museum 360 accuracy measure
   independent of the overlap.

**Resolved (2026-11-15), but only half of it.** The overlap is fixed by clamping each
exhibit's tap/gaze volume to the gap it actually has (§4.4). The salience asymmetry is **left
standing**: the change that would also have fixed it — scaling the models themselves to a
constant angle — flattens the row's depth cues, which the child uses to work out which exhibit
the avatar's pointing vector lands on. That is a study-design trade, not a bug fix, so it is
the researcher's call. If you want it, the equal-angular-size variant is a two-line change on
top of what shipped; if you don't, note the 55% centre-option advantage as a limitation.

### C5 — Museum 360 has no timer cleanup at all

`Museum360Game.tsx` has no unmount effect. The 1 000 ms next-round timer (`:234`) and the
1 200 ms game-over timer (`:228`) both survive unmount. Milder than C1 — no audio, no analytics,
no self-rescheduling chain — but it is the same class of defect and should be fixed together.

### C6 — Park 360 Hard leaves a non-initiating child with no path forward

`CONFIG.hard.nudgeAfterMs === null`, so no nudge ever fires. `NO_SHARE_TIMEOUT_MS` (20 s) logs
one `no_share` event and sets `noShareLogged = true`; nothing re-arms, and the round waits
**indefinitely**. The child who most needs a scaffold — the one who does not spontaneously
initiate — gets silence, no progress, and (on a Quest, alone in a headset) no way to understand
why. The 2026-07 review raised this and the fix added *logging*, not a route out.

This is a clinical-safety and engagement issue, not only a measurement one.

---

## 3. Design & UX recommendations

**D1 — Ship a sensory profile. This is the biggest gap.** `state/settings.ts` exposes
`voiceOn`/`soundOn` as **booleans only**. There is no volume, no speech rate, no brightness, no
stimulation level. `prefers-reduced-motion` appears **once** in 1 100 lines of CSS (the Football
win-pop) and in **zero** of the 13 `useFrame` animation loops across the two scenes. So a
therapist with a hypersensitive child has exactly one lever: mute everything, which also removes
the task's spoken instruction.

Concretely, the scenes animate continuously and unconditionally: exhibits spin at
`dt * 0.4` rad/s forever, bob on a sine, pulse rings throb, the butterfly flaps at ~1.1 Hz, the
friend sways and hops, and `VRStarBurst` pops a **~24°-wide** `toneMapped={false}` yellow star
2.6 m in front of wherever the child is looking on **every** correct answer, unavoidable by
definition (it is anchored to the current gaze). None of that can be turned down.

Add `sensoryLevel: 'full' | 'calm' | 'minimal'` and `volume: number` to settings, wire them into
the existing trainer-remote patch channel (`remote/commands.ts` already passes `voiceOn`,
`soundOn`, `language`, `inputMethod`, `dwellProfile` live — add these two), and consume them in
`sounds.ts` and the scene loops (§4.5). This also closes item 12 (U3) from the 2026-07 review.

**D2 — Museum 360's gaze cue may be below legibility threshold.** The helper stands at
`AVATAR_Z = −7.4` on a 1.0 m podium. From the child:

- head sphere (r = 0.3) at 7.47 m → **4.6°** across
- eye whites (0.15 m) → **1.15°**; pupils (0.08 m) → **0.61°**
- a full 40° head turn moves the nose/eyes laterally by ~0.19 m → **~1.5° of apparent shift**

On the `gaze` rung the body only swings `0.35 × yawToAim`, by design — so the child is asked to
read a ~1.5° head-orientation change on a 4.6° face at 7.5 m. The pupils do not rotate (they are
fixed spheres in the head), so head pose is the entire signal. The 2026-07 review flagged this
same legibility class for Football's `orient` cue at 5.2 m; Museum's gaze cue is **further away
and is the sole cue on Hard**.

Cheapest fixes, in order: scale the avatar up ~1.4× (it is a stylised figure, nobody will object);
or move `AVATAR_Z` to ~−6.0 and re-tune `OBJECT_RADIUS`; or add rotating eyeballs so the pupils
carry the cue too. **Pilot this on-device before the next data collection** — if the gaze rung is
below threshold, Hard-level gaze trials are measuring visual acuity, not joint attention.

**D3 — The MUSEUM sign competes with the helper's face.** The sign (6.2 m wide, dark crimson,
gold pixel letters, `emissiveIntensity 0.3`) hangs at bearing 0, directly above the avatar — the
one place the child must look to read the cue. A high-contrast novel text banner immediately
above the social cue is a predictable attention magnet. Move it to ~180° (behind the child, where
it still sells the room), or desaturate it substantially.

**D4 — Midas-touch risk in Museum 360's dwell confirm.** Museum and Park both use
`confirmSide="on"`, which parks the ✓ chip on the gaze ray, so *resting the gaze is the answer*.
Total commit time = `ARM_MS` (320 ms) + the profile's dwell:

| Profile | Time resting on an option before it is answered |
|---|---|
| standard | 1.92 s |
| extended | 1.42 s |
| **high-support** | **1.02 s** |

For Park 360 this is right — there is only one surprise and one friend. For **Museum 360 it is a
real risk**: finding the target among 5 exhibits requires *scanning*, and a child who pauses one
second on a wrong exhibit while deliberating has answered it. On `high-support` — the profile
given to the children with the least head control, i.e. the ones most likely to pause — one
second is a plausible deliberation. The code's own doc correctly identifies "looking at the
options is the task" as the trigger for `confirmSide="below"` and applies that to the emotion
games; Museum 360 Hard arguably meets the same criterion.

Suggestion: keep `"on"` for easy/medium (where the cue removes the search), and use `"above"` on
hard — it keeps the two-stage separation without the sustained neck flexion of `"below"`.
At minimum, log `dwellArmCount > 1` against error type so you can detect this in the data you
already collect.

**D5 — The in-VR prompt is unreachable exactly when it is needed (still open: V1 + V2).**
`VRHudAnchor` latches *height* but never yaw, so the prompt panel stays world-locked at bearing 0,
z ≈ −7.6. When the child turns 32.8° to the outermost exhibit the prompt is out of view. The
audio fallback is `speechSynthesis`, which the code itself documents as **shipping no voices on
standalone VR browsers** (that is why praise was moved to pre-recorded clips). So:

> A Malayalam-language child, in a Quest, on Museum 360 Hard, looking at an edge exhibit, has
> **neither readable text nor audible instruction**.

Item 3 of the 2026-07 review ("pre-recorded prompt audio, blocked on assets") is the real fix and
is still open. The cheap interim mitigation is a lazy-follow HUD: slerp the panel group toward the
camera yaw with a ~20° dead zone and a slow time constant, so it is world-locked while the child
is looking around and catches up when they settle.

**D6 — Park 360's friend never moves (still open).** `FRIEND_BEARING_DEG = 40` is constant, so the
friend-directed head turn is the same every round of every session. You cannot separate "turning
to the friend" from "habitual turn to the right". Alternate the friend's side across rounds or
sessions and log it — this is cheap and materially strengthens the IJA claim.

**D7 — The start screen teaches nothing.** `StartScreen` is icon + title + three level buttons +
Play. The level captions are good ("Point + glowing target to start"), but they are written for
the *adult*. An autistic child entering an unfamiliar VR task benefits from seeing the task
modelled once. `VRPracticeScene` teaches look-around + select, not the joint-attention task
itself, and it runs **once ever** (`vrPracticeDone` is permanent), so a child returning after
three weeks gets no re-orientation. Consider: one unscored demonstration trial at the start of
every session, with the cue at the `pulse` rung and no entry in the analytics.

**D8 — Park 360 starts without warning.** `beginRound` fires `spawnDelayMs()` = 900–2 500 ms after
Play, then a surprise pops in with an overshoot spring and a pulse ring. There is no "ready"
beat and no predictable count-in. Predictability is a core autism-friendly design principle and
the rest of this codebase respects it; a consistent 3-2-1 or a steady "here it comes" chime would
cost nothing and would also give a clean, uniform latency zero-point.

**D9 — The flat/demo build breaks in portrait.** `fov: 60` vertical gives a horizontal FOV of
91.6° at 16:9 but only **35.8° at 9:16**. Museum 360 Hard spans ±32.8° = 65.6°, so on a phone
held upright the outer two exhibits are off-screen at the start of every trial and the child must
drag to find options that should be simultaneously visible. The VR build is the intervention, so
this is a demo-path issue — but it is the build familiarisation sessions run on. Widen the FOV
when `aspect < 1`, or lock the demo build to landscape.

---

## 4. Code optimisation & fixes

### 4.1 — Park 360 timer lifetime (fixes C1) — *patch verified against the repro test*

```tsx
// Park360Game.tsx

  const noShareTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
+ /** the celebration pause that schedules the next round (or the results panel) */
+ const celebrateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearTimers() {
    if (spawnTimer.current) clearTimeout(spawnTimer.current)
    if (nudgeTimer.current) clearTimeout(nudgeTimer.current)
    if (noShareTimer.current) clearTimeout(noShareTimer.current)
+   if (celebrateTimer.current) clearTimeout(celebrateTimer.current)
    spawnTimer.current = null
    nudgeTimer.current = null
    noShareTimer.current = null
+   celebrateTimer.current = null
  }

  // …in completeShare():
    if (nextShared >= cfg.goal) {
      …
      finishGame(nextScore)
-     setTimeout(() => setPhase('over'), 1600)
+     celebrateTimer.current = setTimeout(() => setPhase('over'), 1600)
      return
    }
-   setTimeout(() => beginRound(round.discovery), 2000)
+   celebrateTimer.current = setTimeout(() => beginRound(round.discovery), 2000)
```

**Also add a belt-and-braces guard in `useGameAnalytics.ts`**, so no game can ever post steps for
a screen the child has left:

```tsx
export function useGameAnalytics(gameKey: GameId, xrStore?: XrStoreLike) {
  const sessionId = useRef<string | null>(null)
  const starting = useRef<Promise<string | null> | null>(null)
+ const mounted = useRef(true)
+ useEffect(() => () => { mounted.current = false }, [])

  const recordStep = useCallback((eventType, payload?, opts?) => {
+   if (!mounted.current) return
    const enriched = { ...(payload ?? {}), ...inputContext() }
    …
```

**And keep the repro test.** Add it as `src/games/park360/Park360Game.lifecycle.test.tsx` — it is
cheap and it pins a bug that silently corrupts study data:

```tsx
it('records nothing once the game is unmounted mid-celebration', async () => {
  const view = render(<MemoryRouter><Park360Game /></MemoryRouter>)
  await act(async () => { view.getByText(/play/i).click() })
  await act(async () => { vi.advanceTimersByTime(2600) })       // surprise spawns
  await act(async () => { view.getByTestId('surprise').click() })
  await act(async () => { view.getByTestId('friend').click() }) // share completes
  recordStep.mockClear()
  view.unmount()
  await act(async () => { vi.advanceTimersByTime(60_000) })
  expect(recordStep.mock.calls.map((c) => c[0])).toEqual([])
})
```

### 4.2 — Museum 360 timer cleanup (fixes C5)

```tsx
// Museum360Game.tsx
+ const roundTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
+ useEffect(() => () => { if (roundTimer.current) clearTimeout(roundTimer.current) }, [])

  // …in pick(), both call sites:
-     setTimeout(() => setPhase('over'), 1200)
+     roundTimer.current = setTimeout(() => setPhase('over'), 1200)
…
-     setTimeout(() => { … setRound((r) => makeRound(difficulty, r.target)) }, 1000)
+     roundTimer.current = setTimeout(() => { … }, 1000)
```

### 4.3 — Sequence the reinforcement audio (fixes C2 and C3)

`speak()` already takes an `onEnd` callback that fires synchronously when speech is unavailable
or muted, so chaining is safe on every device including headsets with no TTS.

```tsx
// services/speech.ts — new helper
/** Speak a line, then play a praise clip after it, so the two never overlap.
 *  Falls straight through to the clip when speech is unavailable or muted. */
export function speakThenPraise(text: string, lang: Lang = 'en') {
  speak(text, lang, () => praise())
}
```

```tsx
// Park360Game.tsx — completeShare()
- say('sayWow', { label: discoveryLabel(round.discovery, lang) })
- praise()
  …
  if (nextShared >= cfg.goal) {
    …
-   say('sayWin')
+   // one utterance, so the payoff line is never cancelled mid-word
+   speakThenPraise(
+     `${parkLine('sayWow', lang, { label: discoveryLabel(round.discovery, lang) })} ` +
+     parkLine('sayWin', lang),
+     lang,
+   )
    …
    return
  }
+ speakThenPraise(parkLine('sayWow', lang, { label: discoveryLabel(round.discovery, lang) }), lang)
```

```tsx
// Museum360Game.tsx — pick(), correct branch
  playSuccess()
- praise()
  …
  if (nextFound >= goal) {
-   say('sayWin')
+   speakThenPraise(museum360Line('sayWin', lang), lang)
    …
    return
  }
- say('sayCorrect', { label: exhibitLabel(id, lang) })
+ speakThenPraise(museum360Line('sayCorrect', lang, { label: exhibitLabel(id, lang) }), lang)
```

Also consider delaying `playSuccess()`'s third tone or dropping the chord to two notes, so the
chime has finished before the voice starts.

### 4.4 — Clamp Museum 360's tap targets to the gap they have (fixes the C4 overlap)

> **Shipped 2026-11-15 as described below.** An earlier draft of this section equalised the
> models' *apparent size* instead, which fixed the salience asymmetry too but flattened the
> row's perspective. Reverted in favour of the target-only clamp; see the note under C4.

Each target is sized from its own neighbour gap, so no bearing can ever reach two exhibits,
and the models keep their natural perspective.

```ts
// museum360/logic.ts
export const HIT_RADIUS_MAX = 0.6        // the padding uncrowded positions keep
const HIT_GAP_SHARE = 0.45               // two neighbours leave 10% of the gap as guard band

export function hitRadius(index: number, n: number): number {
  const gap = neighbourGapDeg(index, n)
  if (!Number.isFinite(gap)) return HIT_RADIUS_MAX
  const budgetRad = (gap * HIT_GAP_SHARE * Math.PI) / 180
  return Math.min(HIT_RADIUS_MAX, slotDistance(index, n) * Math.sin(budgetRad))
}
```

In the scene the volume becomes a **sphere** (a box's silhouette widens toward its diagonal as
the child looks along the row, so its real angular width depended on viewing angle) and a
**sibling** of the animated model group rather than a child of it — otherwise the hover swell
and the celebration wobble could grow a target back into its neighbour.

Resulting half-angles on hard: 4.61° / 4.61° / 10.16° / 4.61° / 4.61°, against neighbour gaps of
10.3° and 22.6° — every pair clear with margin. Easy and medium are entirely unclamped.

**The cost, stated plainly:** hard's exhibits 1 and 3 give up ~1.5° per side, so roughly 10 cm
of an ~80 cm model at 3.74 m is no longer tappable. Every other exhibit at every level keeps a
target *larger* than its model. This is the floor the geometry allows — at 10.3° of separation
there is no way to have generous non-overlapping targets, which is itself an argument for
reconsidering 5 exhibits on hard.

### 4.5 — Wire a calm mode into the scene loops (D1)

```ts
// state/settings.ts
+ sensoryLevel: 'full' | 'calm' | 'minimal'
+ volume: number            // 0..1, multiplies every tone and clip
+ setSensoryLevel: (l: SensoryLevel) => void
+ setVolume: (v: number) => void
```

```ts
// services/sounds.ts — respect it in the one place every sound passes through
  function emit(freq: number, startAt: number, duration: number, peak: number) {
    const ac = audio(); if (!ac) return
+   const vol = useSettings.getState().volume
+   if (vol <= 0) return
+   peak *= vol
    …
```

```tsx
// a shared hook the scenes consult instead of animating unconditionally
export function useMotionScale(): number {
  const level = useSettings((s) => s.sensoryLevel)
  const reduced = usePrefersReducedMotion()
  if (level === 'minimal' || reduced) return 0      // idle motion off entirely
  return level === 'calm' ? 0.4 : 1
}

// Museum360Scene.tsx — Exhibit
  const m = useMotionScale()
- g.rotation.y += dt * 0.4
+ g.rotation.y += dt * 0.4 * m
- g.position.y = EXHIBIT_Y + Math.sin(state.clock.elapsedTime * 1.5 + position[0]) * 0.04
+ g.position.y = EXHIBIT_Y + Math.sin(state.clock.elapsedTime * 1.5 + position[0]) * 0.04 * m
```

```tsx
// VRStarBurst.tsx — scale the celebration rather than removing it
- distance = 2.6,
+ distance = 2.6,
+ // 'calm' halves the star and drops the wobble; 'minimal' shrinks it to a quiet marker
+ const m = useMotionScale()
+ const size = m === 0 ? 0.35 : 0.2 + pop * 0.9
```

Keep **something** on every correct answer at `minimal` — removing positive reinforcement
entirely would break the pedagogy. The goal is turning the volume down, not off.

### 4.6 — Park 360 Hard: give a non-initiating child a route out (C6)

```ts
// park360/logic.ts
/** After this many consecutive un-acted rounds, Hard lends one nudge — the
 *  round is still scored as prompted (spontaneous === false), so the measure
 *  is unaffected, but the child is not left in silence. */
export const HARD_RESCUE_AFTER_TIMEOUTS = 2
```

```tsx
// Park360Game.tsx
  const consecutiveNoShare = useRef(0)

  // inside armNoShareTimeout's callback, after recordStep('no_share', …):
+ consecutiveNoShare.current += 1
+ if (consecutiveNoShare.current >= HARD_RESCUE_AFTER_TIMEOUTS) {
+   recordStep('rescue_nudge', { afterTimeouts: consecutiveNoShare.current })
+   fireNudge()                  // counts as a nudge → this share scores as prompted
+ }
  // …and reset it to 0 in completeShare()
```

Record `rescue_nudge` so these rounds are identifiable and excludable in analysis. Also consider a
session-level stop: after N rescued rounds, surface a "take a break?" panel for the trainer.

### 4.7 — Performance: where the remaining budget actually is

**Draw calls are not the problem** (86 / 42 per frame measured; Meta's Quest guidance is well
above that even doubled per eye). Do not spend time instancing more scenery.

The remaining lever is **fragment cost in Museum 360**:

- 1 `pointLight` + **2 `spotLight`s** with `penumbra`, over ~80 `meshStandardMaterial` surfaces.
  Spot lights with penumbra are the most expensive light type in three.js, and every standard
  material compiles against all three.
- The floor sets `metalness: 0.35` / `roughness: 0.18` with **no environment map**, so the PBR
  path buys a slightly darker floor and nothing else. Same for the inlaid band, the medallion and
  the gilt frames.

```tsx
// RotundaRoom — matte scenery does not need the PBR path
- <meshStandardMaterial color="#cfc9c0" metalness={0.35} roughness={0.18} />
+ <meshLambertMaterial color="#cfc9c0" />

// …and collapse the two spots into one hemisphere + one directional
- <pointLight … /> <spotLight … /> <spotLight … />
+ <hemisphereLight args={['#fff1da', '#6b5f4e', 1.1]} />
+ <directionalLight position={[0, 6, -2]} intensity={0.9} color="#ffe6bf" />
```

Keep `meshStandardMaterial` only where `emissive` is actually doing work (the exhibits). Measure
with `renderer.info` on the Quest before and after — the headless numbers above are
rasteriser-bound and will not predict the headset's fill cost.

### 4.8 — Minor correctness

| Where | Issue |
|---|---|
| `HeadSelect.tsx` `ConfirmChip` | The 256×256 `CanvasTexture` is created in `useMemo` and **never disposed** — unlike every other canvas texture in these scenes, which all have a `useEffect(() => () => texture.dispose())`. One leaked texture per game entry. |
| `Museum360Scene.tsx` `Exhibit`, `Park360Scene.tsx` `Surprise`/`FriendKid` | `document.body.style.cursor` is set to `'pointer'` on hover and reset only in `onPointerOut`. Unmounting while hovered (very likely — the child taps and the round advances) leaves the cursor as a pointer app-wide. Reset it in an unmount effect. |
| `Museum360Game.tsx:191,198` | `performance.now()` is called twice in `pick()` — `now` is computed and then discarded for a second call. Cosmetic, but the two values differ, so the latency is measured from a marginally later instant than the dedupe. |
| `Park360Game.tsx` `fireNudge` | Reads `gazeSelect` from the render closure captured when `beginRound` armed the timer. If the child enters VR between the round starting and the nudge firing, the nudge says "Tap your friend" when they must look. Use a ref. |

---

## 5. Priority

> **Status (2026-11-15):** items 1, 2, 3 and 6 below are shipped — commits `af9e1be` and
> `c00bbae`. Items 4, 5 and 7 remain open, and the salience half of C4 is deliberately left to
> the researcher (see C4).

| | Item | Why first |
|---|---|---|
| 1 | ✅ **C1** — Park 360 timer chain (§4.1) | Corrupts study data silently and plays audio at a child who has left. Confirmed, patch verified, regression test added. |
| 2 | ✅ **C4 overlap** — Museum 360 tap-target clamp (§4.4) | Contaminated the primary DV at the hardest level. The salience half is a design call, left open. |
| 3 | ✅ **C2 / C3** — audio sequencing (§4.3) | Sensory risk and it destroyed the IJA payoff line. |
| 4 | **D2** — gaze-cue legibility at 7.5 m | Decide **before** the next data collection: if it is below threshold, Hard gaze trials measure acuity. Needs an on-device pilot, not a code change. |
| 5 | **D1** — sensory profile + volume (§4.5) | The single largest accessibility gap. Also closes U3 from the July review. |
| 6 | ✅ **C5** and **§4.8** · ⬜ **C6** | C5 and the four minor items shipped. C6 (Hard's rescue nudge) changes what the intervention does on the no-nudge tier — left as the researcher's call. |
| 7 | **D5** — lazy-follow HUD / pre-recorded Malayalam prompts | Still the right fix; the Malayalam arm is the exposure. |

## Verify on device (cannot be settled from the code)

- Museum 360's `gaze` rung at 7.47 m — can a child in your sample read a 1.5° head-orientation
  shift on a 4.6° face? (D2)
- Whether 1.02 s of resting gaze on a wrong exhibit is a realistic deliberation pause for
  children on the `high-support` profile. (D4)
- `speechSynthesis` availability for `ml-IN` inside an immersive session on the target headset,
  and `Noto Sans Malayalam` in the canvas HUD panels. (D5)
- Museum 360's fragment cost with and without §4.7's light/material change.
