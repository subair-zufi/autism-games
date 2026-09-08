import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { GAME_LIST, SKILLS, type Difficulty, type GameId, type PlayMode } from '../types'
import { useAuth } from '../state/auth'
import { useRemoteLink } from '../state/remote'
import { RemoteError, relayBase, remoteApi, setRelayBase } from '../remote/client'
import { DEFAULT_MIRROR_INTERVAL_MS } from '../remote/mirror'
import type { RemoteSettings, RemoteStatus } from '../remote/protocol'

/**
 * The trainer's screen — a phone or laptop driving the headset.
 *
 * Everything here answers the same problem: an autistic child in a headset
 * often cannot choose a game, change a level or find their way out of one, and
 * the only way to help them used to be lifting the headset off their face,
 * which ends the session and the child's concentration with it.
 *
 * Laid out for one-handed use, biggest first: what the child is looking at,
 * then Quit, then the level, then the games. Mentor-facing, so it stays in
 * English like the rest of the mentor screens.
 */
export function RemoteConsole() {
  const role = useRemoteLink((s) => s.role)
  const code = useRemoteLink((s) => s.code)

  if (role !== 'console' || !code) return <PairPanel />
  return <Console code={code} />
}

/* -------------------------------------------------------------------------- */
/* Pairing                                                                     */
/* -------------------------------------------------------------------------- */

function PairPanel() {
  const joinAsConsole = useRemoteLink((s) => s.joinAsConsole)
  const status = useRemoteLink((s) => s.status)
  const error = useRemoteLink((s) => s.error)
  const [code, setCode] = useState('')
  const [relay, setRelay] = useState(relayBase())
  const [showRelay, setShowRelay] = useState(false)

  return (
    <div className="page rc-pair">
      <header className="page-head">
        <h1>Trainer Remote</h1>
        <Link to="/" className="link-accent">Back</Link>
      </header>

      <p className="rc-lede">
        Drive the headset from here: pick the game and level, start it, and quit — without
        taking the headset off the child.
      </p>

      <form
        className="auth-form"
        onSubmit={(e) => {
          e.preventDefault()
          void joinAsConsole(code)
        }}
      >
        <label className="field">
          <span>Pairing code</span>
          <input
            className="rc-code-input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="XXXXXX"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={8}
          />
        </label>
        <p className="rc-hint">
          On the headset: <strong>Profile → Trainer remote → Start</strong>. The six-character
          code appears there. Both devices must be signed in to the same mentor account.
        </p>
        <button className="btn-primary" type="submit" disabled={status === 'connecting' || code.length < 4}>
          {status === 'connecting' ? 'Connecting…' : 'Connect'}
        </button>
        {error && <p className="rc-error">{error}</p>}
      </form>

      <button className="btn-ghost" type="button" onClick={() => setShowRelay((v) => !v)}>
        {showRelay ? 'Hide' : 'Server address'}
      </button>
      {showRelay && (
        <div className="rc-relay">
          <label className="field">
            <span>Relay server</span>
            <input value={relay} onChange={(e) => setRelay(e.target.value)} placeholder="https://…" />
          </label>
          <p className="rc-hint">
            Leave as-is to use the study server. In a room with no internet, run the same server
            on a laptop and put its address here <em>and</em> on the headset.
          </p>
          <button
            className="btn-ghost"
            type="button"
            onClick={() => {
              setRelayBase(relay)
              setRelay(relayBase())
            }}
          >
            Save address
          </button>
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Live console                                                                */
/* -------------------------------------------------------------------------- */

function Console({ code }: { code: string }) {
  const stop = useRemoteLink((s) => s.stop)
  const students = useAuth((s) => s.students)

  const [status, setStatus] = useState<Partial<RemoteStatus>>({})
  const [frame, setFrame] = useState<string | null>(null)
  const [online, setOnline] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [mirrorOn, setMirrorOn] = useState(true)
  const [mode, setMode] = useState<PlayMode>('vr')

  // Read by the polling loop, which must not restart when the toggle flips.
  const wantMirror = useRef(mirrorOn)
  wantMirror.current = mirrorOn

  useEffect(() => {
    void useAuth.getState().loadStudents()
  }, [])

  const send = useCallback(
    async (type: string, payload: Record<string, unknown> = {}, label?: string) => {
      try {
        await remoteApi.pushCommand(code, type, payload)
        setNote(label ? `${label} sent` : null)
        setTimeout(() => setNote(null), 1500)
      } catch (err) {
        setNote(err instanceof RemoteError && err.isGone ? 'Pairing ended' : 'Could not reach the headset')
      }
    },
    [code],
  )

  useEffect(() => {
    let stopped = false
    const abort = new AbortController()
    let rev = 0
    let frameRev = 0
    let mirrorAskedAt = 0

    async function loop() {
      while (!stopped) {
        try {
          const snap = await remoteApi.pullState(
            code,
            rev,
            10,
            wantMirror.current,
            frameRev,
            abort.signal,
          )
          if (stopped) return
          rev = snap.state_rev
          setStatus(snap.state)
          setOnline(snap.headset_online)
          if (snap.frame) {
            setFrame(snap.frame)
            frameRev = snap.frame_rev
          }
          useRemoteLink.getState().markLive(snap.headset_online)

          // Keep asking for the mirror: a headset that reloaded (a new build,
          // a crash) comes back with it off and nothing else would turn it on.
          //
          // Only when the headset says the mirror is *off*, though.
          // "unavailable" means it is trying and there is simply no 3D scene on
          // screen to mirror — a menu, or the Profile page. Treating that as
          // "not running" had the console re-sending the request every few
          // seconds for the whole time the child sat on a menu.
          const wants = wantMirror.current
          const reported = snap.state?.mirror
          const needsAsking = wants ? reported === 'off' : reported !== 'off'
          if (reported && needsAsking && Date.now() - mirrorAskedAt > 4000) {
            mirrorAskedAt = Date.now()
            void remoteApi
              .pushCommand(code, 'mirror', { on: wants, intervalMs: DEFAULT_MIRROR_INTERVAL_MS })
              .catch(() => {})
          }
          if (!wants) setFrame(null)
        } catch (err) {
          if (stopped || (err as Error)?.name === 'AbortError') return
          if (err instanceof RemoteError && err.isGone) {
            void useRemoteLink.getState().stop()
            return
          }
          setOnline(false)
          await new Promise((r) => setTimeout(r, 2000))
        }
      }
    }

    void loop()
    return () => {
      stopped = true
      abort.abort()
    }
  }, [code])

  const gameId = (status.gameId ?? null) as GameId | null
  const level = (status.level ?? null) as Difficulty | null
  const games = GAME_LIST.filter((g) => !g.hidden && g.mode === mode)

  return (
    <div className="page rc">
      <header className="rc-top">
        <div>
          <h1>Trainer Remote</h1>
          <span className={online ? 'rc-dot live' : 'rc-dot down'}>
            {online ? 'Headset connected' : 'Headset not responding'} · {code}
          </span>
        </div>
        <button className="btn-ghost" type="button" onClick={() => void stop({ closeRoom: true })}>
          Unpair
        </button>
      </header>

      <MirrorPanel frame={frame} status={status} on={mirrorOn} onToggle={() => setMirrorOn((v) => !v)} />

      {status.phase === 'enterVr' && (
        <p className="rc-alert">
          Waiting for <strong>Enter VR</strong> to be pressed on the headset — the child can
          press anywhere on that screen. WebXR does not allow starting a session from here.
        </p>
      )}

      <section className="rc-now">
        <div className="rc-now-main">
          <strong>{status.gameTitle ?? 'Home screen'}</strong>
          <span>
            {level ? `${level} · ` : ''}
            {phaseLabel(status)}
            {status.vrActive ? ' · in VR' : ''}
          </span>
        </div>
        <div className="rc-now-score">
          {status.score !== null && status.score !== undefined && <span>⭐ {status.score}</span>}
          {status.progress && <span>{status.progress}</span>}
        </div>
      </section>

      {status.prompt && <p className="rc-prompt">“{status.prompt}”</p>}

      <div className="rc-actions">
        <button className="rc-btn quit" type="button" onClick={() => void send('quit', {}, 'Quit')}>
          ⏹ Quit to Home
        </button>
        <button className="rc-btn go" type="button" onClick={() => void send('play', {}, 'Play')}>
          ▶ Play
        </button>
        <button className="rc-btn" type="button" onClick={() => void send('restart', {}, 'Play again')}>
          ↻ Play again
        </button>
      </div>
      {note && <p className="rc-note">{note}</p>}

      <section className="rc-section">
        <h2>Level {gameId ? '' : '(pick a game first)'}</h2>
        <div className="rc-row">
          {(['easy', 'medium', 'hard'] as Difficulty[]).map((l) => (
            <button
              key={l}
              type="button"
              disabled={!gameId}
              className={level === l ? 'rc-chip active' : 'rc-chip'}
              onClick={() => void send('setLevel', { level: l }, `Level ${l}`)}
            >
              {l}
            </button>
          ))}
        </div>
      </section>

      <section className="rc-section">
        <h2>Games</h2>
        <div className="rc-row rc-modes">
          {(['vr', 'desktop'] as PlayMode[]).map((m) => (
            <button
              key={m}
              type="button"
              className={mode === m ? 'rc-chip active' : 'rc-chip'}
              onClick={() => setMode(m)}
            >
              {m === 'vr' ? '🥽 VR' : '🖥️ Desktop'}
            </button>
          ))}
        </div>
        {SKILLS.map((skill) => {
          const inSkill = games.filter((g) => g.skill === skill.id)
          if (!inSkill.length) return null
          return (
            <div key={skill.id} className="rc-skill">
              <h3 style={{ color: skill.color }}>{skill.icon} {skill.label}</h3>
              <div className="rc-games">
                {inSkill.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className={gameId === g.id ? 'rc-game active' : 'rc-game'}
                    onClick={() => void send('goto', { gameId: g.id }, g.title)}
                  >
                    <span className="rc-game-icon">{g.icon}</span>
                    <span className="rc-game-title">{g.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </section>

      <SettingsPanel settings={status.settings} send={send} />

      <section className="rc-section">
        <h2>Participant</h2>
        <p className="rc-hint">The session is recorded against whoever is selected here.</p>
        <div className="rc-row rc-wrap">
          <button
            type="button"
            className={!status.studentId ? 'rc-chip active' : 'rc-chip'}
            onClick={() => void send('participant', { studentId: null }, 'Unrecorded')}
          >
            Not recording
          </button>
          {students.map((s) => (
            <button
              key={s.id}
              type="button"
              className={status.studentId === s.id ? 'rc-chip active' : 'rc-chip'}
              onClick={() => void send('participant', { studentId: s.id }, s.full_name)}
            >
              {s.full_name}
            </button>
          ))}
        </div>
      </section>

      <p className="rc-footnote">
        Switching game while the child is in VR ends the headset session on purpose — the app
        then shows the new game's big <strong>Enter VR</strong> button, which has to be pressed
        on the headset itself. That press is a WebXR requirement, not a choice this app makes.
      </p>
    </div>
  )
}

function MirrorPanel({
  frame,
  status,
  on,
  onToggle,
}: {
  frame: string | null
  status: Partial<RemoteStatus>
  on: boolean
  onToggle: () => void
}) {
  return (
    <section className="rc-mirror">
      {on && frame ? (
        <img src={frame} alt="What the child is looking at" />
      ) : (
        <div className="rc-mirror-empty">
          {!on
            ? 'View off'
            : status.mirror === 'unavailable'
              ? 'No view from this screen'
              : 'Waiting for the headset…'}
        </div>
      )}
      <button className="rc-mirror-toggle" type="button" onClick={onToggle}>
        {on ? 'Hide view' : 'Show view'}
      </button>
    </section>
  )
}

function SettingsPanel({
  settings,
  send,
}: {
  settings: RemoteSettings | undefined
  send: (type: string, payload?: Record<string, unknown>, label?: string) => Promise<void>
}) {
  if (!settings) return null
  return (
    <section className="rc-section">
      <h2>Session settings</h2>
      <div className="rc-row rc-wrap">
        <button
          type="button"
          className={settings.voiceOn ? 'rc-chip active' : 'rc-chip'}
          onClick={() => void send('setting', { voiceOn: !settings.voiceOn }, 'Voice')}
        >
          🗣 Voice {settings.voiceOn ? 'on' : 'off'}
        </button>
        <button
          type="button"
          className={settings.soundOn ? 'rc-chip active' : 'rc-chip'}
          onClick={() => void send('setting', { soundOn: !settings.soundOn }, 'Sound')}
        >
          🔊 Sound {settings.soundOn ? 'on' : 'off'}
        </button>
        <button
          type="button"
          className="rc-chip"
          onClick={() =>
            void send('setting', { language: settings.language === 'en' ? 'ml' : 'en' }, 'Language')
          }
        >
          🌐 {settings.language === 'en' ? 'English' : 'മലയാളം'}
        </button>
        <button
          type="button"
          className="rc-chip"
          onClick={() =>
            void send(
              'setting',
              { inputMethod: settings.inputMethod === 'dwell' ? 'controller' : 'dwell' },
              'Selection',
            )
          }
        >
          👁 {settings.inputMethod === 'dwell' ? 'Look to choose' : 'Controller'}
        </button>
      </div>
    </section>
  )
}

function phaseLabel(status: Partial<RemoteStatus>): string {
  switch (status.phase) {
    case 'playing':
      return 'playing'
    case 'over':
      return 'finished — result showing'
    case 'start':
      return 'waiting to start'
    case 'enterVr':
      return 'needs the Enter VR press'
    default:
      return 'menu'
  }
}
