// Downloads every media asset listed in the build-time manifest into a named
// Cache Storage bucket so the game library plays with no network. The service
// worker (see src/sw.ts) serves these entries cache-first.

export interface AssetEntry {
  url: string
  bytes: number
}
export type AssetManifest = AssetEntry[]

export const MEDIA_CACHE = 'offline-media-v1'

// Resolve a manifest url (e.g. "videos/a.mp4") to the same absolute URL a
// <video src="./videos/a.mp4"> resolves to, so cache keys match what the
// browser requests at play time. Honours the base:'./' subpath.
function assetRequest(url: string): Request {
  return new Request(new URL(url, document.baseURI).toString())
}

export async function loadManifest(): Promise<AssetManifest> {
  const res = await fetch(`${import.meta.env.BASE_URL}offline-manifest.json`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`manifest ${res.status}`)
  const json = (await res.json()) as { assets: AssetManifest }
  return json.assets
}

export async function cachedBytes(manifest: AssetManifest): Promise<number> {
  const cache = await caches.open(MEDIA_CACHE)
  let total = 0
  for (const a of manifest) {
    if (await cache.match(assetRequest(a.url))) total += a.bytes
  }
  return total
}

export async function isFullyCached(manifest: AssetManifest): Promise<boolean> {
  return (await cachedBytes(manifest)) >= totalBytes(manifest)
}

export async function estimateStorage(
  manifest: AssetManifest,
): Promise<{ needed: number; available: number; fits: boolean }> {
  const already = await cachedBytes(manifest)
  const needed = Math.max(0, totalBytes(manifest) - already)
  let available = Number.POSITIVE_INFINITY
  if (navigator.storage?.estimate) {
    const { quota = 0, usage = 0 } = await navigator.storage.estimate()
    available = Math.max(0, quota - usage)
  }
  // 10% headroom so we don't fill storage to the brim.
  return { needed, available, fits: needed * 1.1 <= available }
}

export async function downloadAll(
  manifest: AssetManifest,
  onProgress: (doneBytes: number, totalBytes: number) => void,
): Promise<void> {
  await navigator.storage?.persist?.()
  const cache = await caches.open(MEDIA_CACHE)
  const total = totalBytes(manifest)
  let done = 0
  for (const a of manifest) {
    const req = assetRequest(a.url)
    if (!(await cache.match(req))) {
      const res = await fetchWithRetry(req, 3)
      await cache.put(req, res)
    }
    done += a.bytes
    onProgress(done, total)
  }
}

async function fetchWithRetry(req: Request, attempts: number): Promise<Response> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(req.clone())
      if (!res.ok) throw new Error(`fetch ${res.status}`)
      return res
    } catch (err) {
      lastErr = err
    }
  }
  const reason = lastErr instanceof Error ? lastErr.message : String(lastErr)
  throw new Error(`failed to fetch ${req.url}: ${reason}`)
}

function totalBytes(manifest: AssetManifest): number {
  return manifest.reduce((sum, a) => sum + a.bytes, 0)
}
