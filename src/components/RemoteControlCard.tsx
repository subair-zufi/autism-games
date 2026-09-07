import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useRemoteLink } from '../state/remote'
import { relayBase, setRelayBase } from '../remote/client'

/**
 * Profile → Trainer remote: the headset end of the pairing, plus the way in to
 * the trainer end.
 *
 * Set up before the headset goes on the child: press Start here, read the code
 * off the screen, type it into the phone. From then on the trainer picks games,
 * sets levels and quits from the phone, and can see what the child is looking
 * at, without lifting the headset off them.
 */
export function RemoteControlCard() {
  const role = useRemoteLink((s) => s.role)
  const code = useRemoteLink((s) => s.code)
  const status = useRemoteLink((s) => s.status)
  const error = useRemoteLink((s) => s.error)
  const peerOnline = useRemoteLink((s) => s.peerOnline)
  const startHeadset = useRemoteLink((s) => s.startHeadset)
  const stop = useRemoteLink((s) => s.stop)

  const [showRelay, setShowRelay] = useState(false)
  const [relay, setRelay] = useState(relayBase())

  return (
    <section className="panel remote-card">
      <h2>Trainer remote</h2>

      {role === 'headset' && code ? (
        <>
          <p className="remote-card-lede">
            Type this code into the trainer's phone (open the app there and go to
            <strong> Trainer Remote</strong>).
          </p>
          <div className="remote-code">{code}</div>
          <p className={peerOnline ? 'remote-state live' : 'remote-state'}>
            {peerOnline ? '● Trainer connected' : '○ Waiting for the trainer…'}
            {status === 'error' && error ? ` — ${error}` : ''}
          </p>
          <button className="btn-ghost" type="button" onClick={() => void stop({ closeRoom: true })}>
            Stop remote control
          </button>
        </>
      ) : (
        <>
          <p className="remote-card-lede">
            Let a phone or laptop drive this device: choose the game and level, start it, and quit
            — without taking the headset off the child. Use this on the <em>headset</em>.
          </p>
          <button
            className="btn-primary"
            type="button"
            disabled={status === 'connecting'}
            onClick={() => void startHeadset()}
          >
            {status === 'connecting' ? 'Starting…' : 'Start remote control'}
          </button>
          {status === 'error' && error && <p className="rc-error">{error}</p>}
        </>
      )}

      <Link to="/remote" className="link-accent remote-console-link">
        This device is the trainer's phone →
      </Link>

      <button className="btn-ghost" type="button" onClick={() => setShowRelay((v) => !v)}>
        {showRelay ? 'Hide server address' : 'Server address'}
      </button>
      {showRelay && (
        <div className="rc-relay">
          <label className="field">
            <span>Relay server</span>
            <input value={relay} onChange={(e) => setRelay(e.target.value)} placeholder="https://…" />
          </label>
          <p className="rc-hint">
            Leave as-is to use the study server. With no internet in the room, run the same server
            on a laptop on the local Wi-Fi and put its address here and on the trainer's phone.
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
    </section>
  )
}
