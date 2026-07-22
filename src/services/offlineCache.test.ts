import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cachedBytes,
  downloadAll,
  isFullyCached,
  loadManifest,
  MEDIA_CACHE,
  type AssetManifest,
} from './offlineCache'

const manifest: AssetManifest = [
  { url: 'videos/a.mp4', bytes: 100 },
  { url: 'videos/b.mp4', bytes: 200 },
]

function fakeCache() {
  const store = new Map<string, boolean>()
  return {
    store,
    match: vi.fn(async (req: Request) => (store.has(new URL(req.url).pathname) ? new Response() : undefined)),
    put: vi.fn(async (req: Request) => {
      store.set(new URL(req.url).pathname, true)
    }),
  }
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('loadManifest', () => {
  it('returns the assets array from the manifest json', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ assets: manifest }))))
    await expect(loadManifest()).resolves.toEqual(manifest)
  })
})

describe('cachedBytes / isFullyCached', () => {
  it('sums only entries present in the cache', async () => {
    const cache = fakeCache()
    cache.store.set('/videos/a.mp4', true) // only the 100-byte asset cached
    vi.stubGlobal('caches', { open: vi.fn(async () => cache) })
    expect(await cachedBytes(manifest)).toBe(100)
    expect(await isFullyCached(manifest)).toBe(false)
  })
})

describe('downloadAll', () => {
  it('fetches only missing assets, caches them, and reports byte progress', async () => {
    const cache = fakeCache()
    cache.store.set('/videos/a.mp4', true) // a already cached
    vi.stubGlobal('caches', { open: vi.fn(async () => cache) })
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 200 })))
    vi.stubGlobal('navigator', { storage: { persist: vi.fn(async () => true) } })

    const progress: Array<[number, number]> = []
    await downloadAll(manifest, (done, total) => progress.push([done, total]))

    // b.mp4 fetched once; a.mp4 skipped.
    expect((globalThis.fetch as any).mock.calls.length).toBe(1)
    expect(cache.put).toHaveBeenCalledTimes(1)
    // Final progress reports all 300 bytes done (100 pre-cached + 200 new).
    expect(progress.at(-1)).toEqual([300, 300])
  })

  it('retries a failing fetch before giving up', async () => {
    const cache = fakeCache()
    vi.stubGlobal('caches', { open: vi.fn(async () => cache) })
    vi.stubGlobal('navigator', { storage: { persist: vi.fn(async () => true) } })
    let calls = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls++
      if (calls < 2) throw new Error('network')
      return new Response('x', { status: 200 })
    }))
    await downloadAll([{ url: 'videos/a.mp4', bytes: 10 }], () => {})
    expect(calls).toBe(2)
  })
})

it('exports the cache name', () => {
  expect(MEDIA_CACHE).toBe('offline-media-v1')
})
