# Trainer remote control

Driving a headset session from a phone: choosing the game and the level, starting it,
watching what the child is looking at, and quitting — without lifting the headset off
the child's face.

## Why it exists

The three moments a session asks a participant to make a choice are the three moments
that reliably stall it: which game, which level, and how to stop. A child who is happily
inside a game often cannot leave it, and a child who cannot start one sits in a menu.
The only remedy in the room was taking the headset off, which ends the immersion, the
concentration and often the trial.

The trainer already sits beside the child. This gives them the controls.

## Using it in a session

**Before the headset goes on (on the headset, in the app):**

1. Sign in as the mentor account.
2. **Profile → Trainer remote → Start remote control.**
3. A six-character code appears. Leave the app on any screen; the pairing survives
   navigation, reloads and app updates.

**On the trainer's phone or laptop:**

1. Open the same app and sign in **to the same mentor account**.
2. Go to `#/remote` (Profile → *This device is the trainer's phone*).
3. Type the code and press **Connect**.

From then on the phone shows what the child is looking at, what they were just asked,
their score, and the whole set of controls. Nothing needs to be pressed on the headset
again except one thing — see *The one press* below.

### What the trainer can do

| Control | Effect on the headset |
|---|---|
| **Quit to Home** | Ends the immersive session properly and returns to the app's Home page. |
| **Play / Play again** | Presses the Play button on whatever start, level or result screen is showing. |
| Any game | Opens it. Sets the level first, if one was chosen. |
| Level (easy / medium / hard) | Sets the level for the game currently open; it applies at the next start. |
| Voice, sound, language, selection method | Changes the session settings live. |
| Participant | Switches who the session is recorded against, so analytics land on the right child. |
| Show / hide view | Starts and stops the mirror image. |

### The one press

WebXR does not let a page start an immersive session without a real press **on that
device** — no remote, and no app, can work around it. So switching to a different game
while the child is inside VR ends the session (deliberately and cleanly) and lands them
on the new game's *Enter VR* screen, which has to be pressed on the headset.

To make that press as small as possible, that screen is clickable edge to edge: a
controller trigger aimed anywhere at the panel enters VR. The console says plainly when
this is what it is waiting for ("needs the Enter VR press"), so the trainer knows to
prompt the child rather than wondering whether the remote failed. Everything else —
level, start, settings, participant, quit — needs no in-headset action at all.

If a session ever needs to switch games with no in-headset press whatsoever, the way to
get there is a single app-level WebXR session shared by every game, so a game change
never ends the session. That is a substantial rework of all eight immersive games and is
not what this does.

## What the trainer sees

The mirror is a small JPEG (384×216, ~1.5 frames a second) of the child's viewpoint,
rendered by `src/remote/RemoteMirror.tsx`.

It has to be a second render pass. While a headset session is presenting, three.js draws
into the compositor's framebuffer and the page's own canvas is left untouched — there is
nothing on it to screenshot, which is why "just copy the canvas" does not work in VR. So
the mirror points a plain camera at the headset's pose, draws the same scene into a small
offscreen target, reads it back and encodes a frame.

That work is skipped entirely unless a console is watching: the capture returns
immediately while the mirror is off, the headset turns it off as soon as the console
stops polling, and the renderer's state (render target, viewport, scissor, `xr.enabled`)
is restored exactly, so the headset's own frame is unaffected.

An unchanged view is not re-sent: the console tells the relay which frame it already
holds, so a still scene costs nothing on a phone's mobile data.

Latency is a few hundred milliseconds — fine for "look a little to your left", not
intended for judging reaction times.

## How it is wired

```
headset (this app)                 relay (FastAPI, in memory)              trainer's phone
──────────────────                 ──────────────────────────              ───────────────
RemoteAgent  ──── long-poll ────►  GET  /api/remote/rooms/{code}/commands  ◄── pushCommand
             ◄─── commands ─────
             ──── state + ──────►  POST /api/remote/rooms/{code}/state     ───► RemoteConsole
                  mirror frame     GET  /api/remote/rooms/{code}/state     (long-poll)
```

| Piece | File |
|---|---|
| Command/status vocabulary | `src/remote/protocol.ts` |
| Relay HTTP client (configurable address) | `src/remote/client.ts` |
| Pairing state, persisted | `src/state/remote.ts` |
| Headset agent (pull commands, push state) | `src/remote/RemoteAgent.tsx` |
| Carrying out a command | `src/remote/commands.ts` |
| Remote presses landing on the current screen | `src/remote/intents.ts` |
| What the child's screen reports | `src/remote/status.ts` |
| Mirror capture and frame sink | `src/remote/RemoteMirror.tsx`, `src/remote/mirror.ts` |
| Trainer's screen | `src/pages/RemoteConsole.tsx` |
| Pairing card on the headset | `src/components/RemoteControlCard.tsx` |
| Relay | `server/app/routers/remote.py`, `server/app/remote_rooms.py` |

No game contains any remote-control code. The status the trainer reads comes from the
four shared components every game already renders — `StartScreen`/`LevelSelect` (a picker
is up), `ScoreBar` (a round is running, and the score), `PromptBanner` (what was asked),
the game-over panels (the round ended) — and those same components are where a remote
Play or Play again lands, running the identical handler the child's own press runs.

## Running without internet

The relay is part of the study API, so by default both devices talk to the deployed
server. A room with no internet can run the same server on a laptop on the local Wi-Fi:

```bash
cd server && uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Then set **Server address** to `http://<laptop-ip>:8000` on *both* the headset (Profile →
Trainer remote → Server address) and the phone (Trainer Remote → Server address). The
setting is per-device and survives reloads.

Caveats: the app itself must still be reachable on both devices (the offline PWA cache
covers the headset), and both must be signed in, so the *fully* offline mode — which is
anonymous by design — cannot use the remote.

## Data and privacy

Worth stating plainly for ethics documentation:

- Commands, session state and mirror frames pass **through the relay in memory only**.
  Nothing about a remote session is written to the database, and a server restart drops
  every pairing.
- A room is scoped to the mentor account that created it. A code belonging to another
  account returns `404`, so a guessed code cannot reach someone else's headset.
- The mirror shows the rendered game scene — the app's own 3D view — not a camera feed,
  and never the room the child is in.
- Frames are produced only while a paired console is actively watching.

## Troubleshooting

| Symptom | Cause |
|---|---|
| "Sign in with your mentor account on this device first" | The device has no mentor token. Both ends need the same account. |
| "That code is not paired to anything" | The headset's pairing was stopped, the relay restarted, or the code expired (6h idle). Press Start again on the headset. |
| Console says "Headset not responding" | The headset lost the network, or the app was closed. The pairing itself survives; it recovers on its own. |
| "No view from this screen" | The mirror only exists inside the 3D games. Menus and the mentor screens have no scene to mirror. |
| Controls work but the view is frozen | The headset stopped producing frames (context loss). Toggle *Show view* off and on. |
| Console joins but nothing arrives | The API is running with more than one worker; pairings are per-process. Run a single worker. |

## Both ends stay in charge

Pairing does not take the headset over. Anyone can still navigate on the headset
itself while a trainer is connected, and the console reflects it within a second
— which is the point: the trainer watches where the child has got to and steps
in only when they are stuck.

Three things keep it that way, and each of them was a bug first:

- The headset's listener is never restarted by a navigation. It used to be, and
  a restarted listener began again from the start of the room's history — so the
  trainer's last "open this game" was carried out a second time, and pressing
  Home on the headset threw the child straight back into it. The headset felt
  locked; it was being re-commanded.
- How far a device has got through the commands is remembered with the pairing,
  so a reload (a new build, the headset browser reclaiming the tab) resumes
  instead of replaying the session.
- Anything older than a minute is read but not carried out, so a headset coming
  back from sleep never acts on instructions the trainer gave long ago.
