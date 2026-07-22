import { describe, expect, it } from 'vitest'
import { isMediaPath } from './mediaPaths'

describe('isMediaPath', () => {
  it('matches media directories', () => {
    expect(isMediaPath('/app/videos/angry_1.mp4')).toBe(true)
    expect(isMediaPath('/emotions/Happy.png')).toBe(true)
    expect(isMediaPath('/sub/path/groups/x.png')).toBe(true)
  })
  it('rejects non-media paths', () => {
    expect(isMediaPath('/assets/index-abc.js')).toBe(false)
    expect(isMediaPath('/offline-manifest.json')).toBe(false)
    expect(isMediaPath('/')).toBe(false)
  })
})
