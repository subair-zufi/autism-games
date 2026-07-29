import { beforeEach, describe, expect, it } from 'vitest'
import { useOffline } from './offline'

describe('offline store', () => {
  beforeEach(() => {
    localStorage.clear()
    useOffline.setState({ offlineMode: false })
  })

  it('defaults to online', () => {
    expect(useOffline.getState().offlineMode).toBe(false)
  })

  it('setOfflineMode flips the flag', () => {
    useOffline.getState().setOfflineMode(true)
    expect(useOffline.getState().offlineMode).toBe(true)
    useOffline.getState().setOfflineMode(false)
    expect(useOffline.getState().offlineMode).toBe(false)
  })
})
