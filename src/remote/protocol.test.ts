import { describe, expect, it } from 'vitest'
import { parseCommand } from './protocol'

describe('parseCommand', () => {
  it('passes through a command this build knows', () => {
    expect(parseCommand({ seq: 1, type: 'quit', payload: {} })).toEqual({ type: 'quit', payload: {} })
  })

  it('drops one it does not, rather than crashing the loop', () => {
    // A console on a newer build sending a control this headset has never
    // heard of must not take out the child's only way out of a game.
    expect(parseCommand({ seq: 2, type: 'teleport', payload: { x: 1 } })).toBeNull()
  })

  it('knows the trainer Confirm, so an older headset is not the silent failure', () => {
    expect(parseCommand({ seq: 4, type: 'confirm', payload: {} })).toEqual({
      type: 'confirm',
      payload: {},
    })
  })

  it('tolerates a missing payload', () => {
    expect(parseCommand({ seq: 3, type: 'play' } as never)).toEqual({ type: 'play', payload: {} })
  })

  it('knows the trainer Watch-again, so Emotion Cinema can be replayed from the phone', () => {
    expect(parseCommand({ seq: 5, type: 'replay', payload: {} })).toEqual({
      type: 'replay',
      payload: {},
    })
  })
})
