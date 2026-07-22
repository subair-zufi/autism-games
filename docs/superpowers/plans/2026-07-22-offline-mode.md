# Offline Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the full game library — including WebXR/VR 360 games — download once and then run with no internet, entered via a "Play Offline" affordance on the Login and Home pages.

**Architecture:** An `offlineMode` flag (persisted Zustand store) bypasses the auth gate and hides all online chrome. A build-time manifest lists every media asset; a user-triggered downloader fetches them into a named Cache Storage bucket with a byte-based progress bar; a service worker precaches the app shell and serves media cache-first so everything works with no network. Offline runs as an anonymous session, so analytics/login/participant calls are simply not made.

**Tech Stack:** React 19 + TypeScript, Vite 8, Zustand (with `persist`), `vite-plugin-pwa` (Workbox), Vitest + Testing Library, Cache Storage + Service Worker APIs.

## Global Constraints

- **Vite `base` is `'./'`** ([vite.config.ts](../../../vite.config.ts)) for the GitHub Pages subpath — every asset/manifest URL must resolve relative to `document.baseURI`, never absolute from `/`.
- **Mentor-facing chrome stays English** (see [AppShell.tsx](../../../src/components/AppShell.tsx)); the button text is exactly **"Play Offline"**.
- **No data is saved offline** — do not add local analytics persistence; unauthenticated calls already no-op in [analytics.ts](../../../src/services/analytics.ts).
- **Full library only** — cache all of `public/videos`, `public/emotions`, `public/groups`; no curated subset.
- **Zustand persist pattern:** follow [src/state/settings.ts](../../../src/state/settings.ts) (create + `persist` middleware, unique `name`).
- **Tests:** `npm test` runs Vitest (jsdom). Co-locate `*.test.ts` next to source, matching existing files like `src/state/settings.test.ts`.

---

### Task 1: `offlineMode` state store

**Files:**
- Create: `src/state/offline.ts`
- Test: `src/state/offline.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `useOffline` Zustand store with `{ offlineMode: boolean; setOfflineMode: (v: boolean) => void }`, persisted under `name: 'autism-offline'`.

- [ ] **Step 1: Write the failing test**

```ts
// src/state/offline.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/state/offline.test.ts`
Expected: FAIL — cannot resolve `./offline`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/state/offline.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface OfflineState {
  // True while the app runs from local cache with no server. Bypasses the
  // auth gate and hides all online-only chrome. Persisted so a reload on a
  // disconnected device stays in offline mode.
  offlineMode: boolean
  setOfflineMode: (v: boolean) => void
}

export const useOffline = create<OfflineState>()(
  persist(
    (set) => ({
      offlineMode: false,
      setOfflineMode: (offlineMode) => set({ offlineMode }),
    }),
    { name: 'autism-offline' },
  ),
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/state/offline.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/state/offline.ts src/state/offline.test.ts
git commit -m "feat(offline): add persisted offlineMode store"
```

---

### Task 2: Media-path predicate + asset-manifest generator

**Files:**
- Create: `src/services/mediaPaths.ts`
- Test: `src/services/mediaPaths.test.ts`
- Create: `scripts/gen-offline-manifest.mjs`
- Modify: `package.json` (add `predev`, `prebuild`, `manifest` scripts)
- Modify: `.gitignore` (ignore generated manifest)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `isMediaPath(pathname: string): boolean` — true for paths under `/videos/`, `/emotions/`, `/groups/`.
  - Build artifact `public/offline-manifest.json`: `{ "generatedAt": string, "assets": { "url": string, "bytes": number }[] }` with `url` values like `"videos/angry_1.mp4"` (relative, no leading `./`).

- [ ] **Step 1: Write the failing test for the predicate**

```ts
// src/services/mediaPaths.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/services/mediaPaths.test.ts`
Expected: FAIL — cannot resolve `./mediaPaths`.

- [ ] **Step 3: Implement the predicate**

```ts
// src/services/mediaPaths.ts
// The three public/ directories whose contents are cached for offline play.
// Shared by the service worker (cache-first serving) and the manifest checks.
const MEDIA_DIRS = ['/videos/', '/emotions/', '/groups/']

export function isMediaPath(pathname: string): boolean {
  return MEDIA_DIRS.some((dir) => pathname.includes(dir))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/services/mediaPaths.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the manifest generator script**

```js
// scripts/gen-offline-manifest.mjs
// Scans the media directories under public/ and writes public/offline-manifest.json
// (url + byte size for each file) so the offline downloader can show a
// byte-based progress bar. Run automatically before dev and build.
import { readdir, stat, writeFile } from 'node:fs/promises'
import { join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../public', import.meta.url))
const DIRS = ['videos', 'emotions', 'groups']

async function walk(absDir, relDir) {
  const out = []
  let entries
  try {
    entries = await readdir(absDir, { withFileTypes: true })
  } catch {
    return out // directory may not exist yet — skip it
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const abs = join(absDir, e.name)
    const rel = posix.join(relDir, e.name)
    if (e.isDirectory()) {
      out.push(...(await walk(abs, rel)))
    } else {
      const { size } = await stat(abs)
      out.push({ url: rel, bytes: size })
    }
  }
  return out
}

const assets = []
for (const dir of DIRS) assets.push(...(await walk(join(ROOT, dir), dir)))
assets.sort((a, b) => a.url.localeCompare(b.url))

const manifest = { generatedAt: new Date().toISOString(), assets }
await writeFile(join(ROOT, 'offline-manifest.json'), JSON.stringify(manifest, null, 2))
console.log(`offline-manifest.json: ${assets.length} assets, ` +
  `${(assets.reduce((a, x) => a + x.bytes, 0) / 1e6).toFixed(1)} MB`)
```

- [ ] **Step 6: Wire the script into package.json**

In `package.json` `scripts`, add these three entries (keep existing ones):

```json
    "manifest": "node scripts/gen-offline-manifest.mjs",
    "predev": "node scripts/gen-offline-manifest.mjs",
    "prebuild": "node scripts/gen-offline-manifest.mjs",
```

Note: `dev` and `build` already exist; npm runs `predev`/`prebuild` automatically before them.

- [ ] **Step 7: Ignore the generated file**

Append to `.gitignore`:

```
public/offline-manifest.json
```

- [ ] **Step 8: Generate and eyeball the manifest**

Run: `npm run manifest`
Expected: prints a line like `offline-manifest.json: N assets, 2xx.x MB` and creates `public/offline-manifest.json`.

- [ ] **Step 9: Commit**

```bash
git add src/services/mediaPaths.ts src/services/mediaPaths.test.ts scripts/gen-offline-manifest.mjs package.json .gitignore
git commit -m "feat(offline): add media-path predicate and asset-manifest generator"
```

---

### Task 3: Offline cache download service

**Files:**
- Create: `src/services/offlineCache.ts`
- Test: `src/services/offlineCache.test.ts`

**Interfaces:**
- Consumes: `public/offline-manifest.json` at runtime.
- Produces:
  - `interface AssetEntry { url: string; bytes: number }`
  - `type AssetManifest = AssetEntry[]`
  - `MEDIA_CACHE = 'offline-media-v1'`
  - `loadManifest(): Promise<AssetManifest>`
  - `cachedBytes(m: AssetManifest): Promise<number>` — sum of bytes already in the cache.
  - `isFullyCached(m: AssetManifest): Promise<boolean>`
  - `estimateStorage(m: AssetManifest): Promise<{ needed: number; available: number; fits: boolean }>`
  - `downloadAll(m: AssetManifest, onProgress: (doneBytes: number, totalBytes: number) => void): Promise<void>` — skips already-cached entries, retries each fetch up to 3 times, requests persistent storage.

- [ ] **Step 1: Write failing tests**

```ts
// src/services/offlineCache.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/services/offlineCache.test.ts`
Expected: FAIL — cannot resolve `./offlineCache`.

- [ ] **Step 3: Implement the service**

```ts
// src/services/offlineCache.ts
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
  throw lastErr instanceof Error ? lastErr : new Error('fetch failed')
}

function totalBytes(manifest: AssetManifest): number {
  return manifest.reduce((sum, a) => sum + a.bytes, 0)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/services/offlineCache.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/services/offlineCache.ts src/services/offlineCache.test.ts
git commit -m "feat(offline): add media download-to-cache service"
```

---

### Task 4: Service worker + PWA setup

**Files:**
- Modify: `package.json` (add `vite-plugin-pwa` dev dependency)
- Modify: `vite.config.ts`
- Modify: `tsconfig.json` (exclude the service worker from the app typecheck)
- Create: `src/sw.ts`
- Modify: `src/main.tsx` (register the service worker)

**Interfaces:**
- Consumes: `isMediaPath` from Task 2; `MEDIA_CACHE` from Task 3.
- Produces: a built service worker that (a) precaches the app shell and (b) serves media requests cache-first from `offline-media-v1`.

- [ ] **Step 1: Install the plugin**

Run: `npm install -D vite-plugin-pwa workbox-precaching`
Expected: adds `vite-plugin-pwa` and `workbox-precaching` to `devDependencies`.

Note: `src/main.tsx` uses `HashRouter` and Vite `base` is `'./'`, so the SW registers from `./sw.js` — no absolute paths.

- [ ] **Step 2: Configure the plugin in vite.config.ts**

Replace the `plugins` array so it includes the PWA plugin in `injectManifest` mode (keep the existing `react()` and conditional `basicSsl()`):

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    ...(process.env.VR ? [basicSsl()] : []),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: null, // we register manually in main.tsx
      // The ~270MB media is cached on demand by offlineCache, NOT precached
      // here — exclude it from the shell precache manifest.
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,woff2}'],
        maximumFileSizeToCacheInBytes: 5_000_000,
      },
      devOptions: { enabled: false },
    }),
  ],
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'] },
})
```

- [ ] **Step 3: Write the service worker**

```ts
// src/sw.ts
/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'
import { isMediaPath } from './services/mediaPaths'
import { MEDIA_CACHE } from './services/offlineCache'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: unknown[] }

// App shell (JS/CSS/HTML/fonts) — precached at install so the app boots offline.
precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('activate', () => self.clients.claim())

// Media: cache-first from the bucket offlineCache filled. Never precached here.
self.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || !isMediaPath(url.pathname)) return
  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request)
      if (cached) return cached
      return fetch(event.request)
    })(),
  )
})
```

- [ ] **Step 4: Exclude the service worker from the app typecheck**

`tsconfig.json` has `"include": ["src", "vite.config.ts"]`, so `tsc -b` (in the
`build` script) would typecheck `src/sw.ts` under the DOM lib and fail on its
webworker types. vite-plugin-pwa compiles the SW independently, so exclude it.
Add to `tsconfig.json`:

```json
  "exclude": ["src/sw.ts"]
```

(Place it as a top-level key alongside `"include"`.)

- [ ] **Step 5: Register the service worker in main.tsx**

Add near the end of `src/main.tsx`, after the app renders:

```ts
// Register the offline service worker (production build only; disabled in dev
// via VitePWA devOptions so HMR isn't affected).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}
```

- [ ] **Step 6: Verify the build produces a service worker**

Run: `npm run build`
Expected: build succeeds; `dist/sw.js` exists and `dist/` does NOT contain a giant precache of the videos (media excluded).

Run: `ls dist/sw.js`
Expected: file listed.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vite.config.ts tsconfig.json src/sw.ts src/main.tsx
git commit -m "feat(offline): add service worker and PWA shell precache"
```

---

### Task 5: Auth-gate bypass + `/play-offline` route

**Files:**
- Modify: `src/App.tsx` (`RequireAuth`, add public route)
- Test: `src/App.offline.test.tsx`

**Interfaces:**
- Consumes: `useOffline` from Task 1.
- Produces: `RequireAuth` renders children when `offlineMode` is true even without login; a public route `/play-offline` renders `<PlayOffline />` (built in Task 6).

- [ ] **Step 1: Write the failing test**

```tsx
// src/App.offline.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAuth } from './state/auth'
import { useOffline } from './state/offline'

// Re-declare the gate's behaviour via the real component by rendering App's
// route tree is heavy; instead import the exported RequireAuth.
import { RequireAuth } from './App'

function Protected() {
  return <div>secret</div>
}

describe('RequireAuth with offline mode', () => {
  beforeEach(() => {
    useAuth.setState({ isLoggedIn: false })
    useOffline.setState({ offlineMode: false })
  })

  it('redirects to /login when neither logged in nor offline', () => {
    render(
      <MemoryRouter initialEntries={['/secret']}>
        <Routes>
          <Route path="/login" element={<div>login page</div>} />
          <Route path="/secret" element={<RequireAuth><Protected /></RequireAuth>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('login page')).toBeInTheDocument()
  })

  it('renders children when offlineMode is on', () => {
    useOffline.setState({ offlineMode: true })
    render(
      <MemoryRouter initialEntries={['/secret']}>
        <Routes>
          <Route path="/login" element={<div>login page</div>} />
          <Route path="/secret" element={<RequireAuth><Protected /></RequireAuth>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('secret')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/App.offline.test.tsx`
Expected: FAIL — `RequireAuth` is not exported / does not read `offlineMode`.

- [ ] **Step 3: Update RequireAuth and add the route**

In `src/App.tsx`: add the import

```ts
import { useOffline } from './state/offline'
import { PlayOffline } from './pages/PlayOffline'
```

Change `RequireAuth` to be exported and to allow offline:

```tsx
/** Gate a route behind a logged-in mentor OR active offline mode. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const isLoggedIn = useAuth((s) => s.isLoggedIn)
  const offlineMode = useOffline((s) => s.offlineMode)
  const location = useLocation()
  if (!isLoggedIn && !offlineMode)
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <>{children}</>
}
```

Add the public route alongside `/login` (inside `<Routes>`, near [src/App.tsx:70](../../../src/App.tsx)):

```tsx
      <Route path="/play-offline" element={<PlayOffline />} />
```

- [ ] **Step 4: Create a temporary PlayOffline stub so imports resolve**

```tsx
// src/pages/PlayOffline.tsx
export function PlayOffline() {
  return <div>Play offline</div>
}
```

(Task 6 replaces the body.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/App.offline.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.offline.test.tsx src/pages/PlayOffline.tsx
git commit -m "feat(offline): bypass auth gate in offline mode and add /play-offline route"
```

---

### Task 6: PlayOffline flow — download → Ready → Start

**Files:**
- Modify: `src/pages/PlayOffline.tsx` (replace stub with the real flow)
- Test: `src/pages/PlayOffline.test.tsx`

**Interfaces:**
- Consumes: `loadManifest`, `isFullyCached`, `estimateStorage`, `downloadAll` from Task 3; `useOffline` from Task 1.
- Produces: `<PlayOffline />` — a self-contained page component; on "Start" it sets `offlineMode` and navigates to `/`.

State machine: `checking → (ready | needs-download | offline-no-cache | too-big) → downloading → ready`.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/pages/PlayOffline.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PlayOffline } from './PlayOffline'
import { useOffline } from '../state/offline'
import * as cache from '../services/offlineCache'

const manifest = [{ url: 'videos/a.mp4', bytes: 100 }]

beforeEach(() => {
  vi.restoreAllMocks()
  useOffline.setState({ offlineMode: false })
  vi.spyOn(cache, 'loadManifest').mockResolvedValue(manifest as any)
})

function renderPage() {
  return render(<MemoryRouter><PlayOffline /></MemoryRouter>)
}

describe('PlayOffline', () => {
  it('shows the Start button immediately when already fully cached', async () => {
    vi.spyOn(cache, 'isFullyCached').mockResolvedValue(true)
    renderPage()
    expect(await screen.findByRole('button', { name: /start/i })).toBeInTheDocument()
  })

  it('offers download when not cached, then downloads and shows Start', async () => {
    vi.spyOn(cache, 'isFullyCached').mockResolvedValue(false)
    vi.spyOn(cache, 'estimateStorage').mockResolvedValue({ needed: 100, available: 1e9, fits: true })
    vi.spyOn(cache, 'downloadAll').mockImplementation(async (_m, onProgress) => {
      onProgress(100, 100)
    })
    renderPage()
    const dl = await screen.findByRole('button', { name: /download/i })
    await userEvent.click(dl)
    expect(await screen.findByRole('button', { name: /start/i })).toBeInTheDocument()
  })

  it('warns when storage will not fit', async () => {
    vi.spyOn(cache, 'isFullyCached').mockResolvedValue(false)
    vi.spyOn(cache, 'estimateStorage').mockResolvedValue({ needed: 3e8, available: 1e7, fits: false })
    renderPage()
    expect(await screen.findByText(/not enough storage/i)).toBeInTheDocument()
  })

  it('Start enables offline mode', async () => {
    vi.spyOn(cache, 'isFullyCached').mockResolvedValue(true)
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /start/i }))
    await waitFor(() => expect(useOffline.getState().offlineMode).toBe(true))
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/pages/PlayOffline.test.tsx`
Expected: FAIL — stub renders no buttons.

- [ ] **Step 3: Implement the flow**

```tsx
// src/pages/PlayOffline.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOffline } from '../state/offline'
import {
  downloadAll,
  estimateStorage,
  isFullyCached,
  loadManifest,
  type AssetManifest,
} from '../services/offlineCache'

type Phase = 'checking' | 'ready' | 'needs-download' | 'too-big' | 'no-cache' | 'downloading' | 'error'

export function PlayOffline() {
  const navigate = useNavigate()
  const setOfflineMode = useOffline((s) => s.setOfflineMode)
  const [phase, setPhase] = useState<Phase>('checking')
  const [manifest, setManifest] = useState<AssetManifest>([])
  const [pct, setPct] = useState(0)
  const [detail, setDetail] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const m = await loadManifest()
        if (cancelled) return
        setManifest(m)
        if (await isFullyCached(m)) return setPhase('ready')
        if (!navigator.onLine) return setPhase('no-cache')
        const est = await estimateStorage(m)
        if (cancelled) return
        if (!est.fits) {
          setDetail(`${mb(est.needed)} needed, ${mb(est.available)} free`)
          return setPhase('too-big')
        }
        setPhase('needs-download')
      } catch {
        if (!cancelled) setPhase('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function startDownload() {
    setPhase('downloading')
    try {
      await downloadAll(manifest, (done, total) => setPct(Math.round((done / total) * 100)))
      setPhase('ready')
    } catch {
      setPhase('error')
    }
  }

  function start() {
    setOfflineMode(true)
    navigate('/', { replace: true })
  }

  return (
    <div className="auth-page">
      <header className="auth-hero">
        <h1>Play Offline</h1>
        <p>Download the games once, then play with no internet.</p>
      </header>

      <div className="auth-form">
        {phase === 'checking' && <p>Checking your device…</p>}

        {phase === 'needs-download' && (
          <>
            <p>Ready to download the full game library for offline use.</p>
            <button className="btn-primary" onClick={startDownload}>Download games</button>
          </>
        )}

        {phase === 'downloading' && (
          <>
            <p>Downloading games… {pct}%</p>
            <progress value={pct} max={100} style={{ width: '100%' }} />
          </>
        )}

        {phase === 'ready' && (
          <>
            <p>Games are ready to play offline.</p>
            <button className="btn-primary" onClick={start}>Start</button>
          </>
        )}

        {phase === 'too-big' && (
          <p className="auth-error">Not enough storage on this device. {detail}</p>
        )}

        {phase === 'no-cache' && (
          <p className="auth-error">Connect to the internet once to download the games.</p>
        )}

        {phase === 'error' && (
          <>
            <p className="auth-error">Something went wrong preparing offline mode.</p>
            <button className="btn-primary" onClick={() => location.reload()}>Try again</button>
          </>
        )}
      </div>
    </div>
  )
}

function mb(bytes: number): string {
  return `${(bytes / 1e6).toFixed(0)} MB`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/pages/PlayOffline.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/pages/PlayOffline.tsx src/pages/PlayOffline.test.tsx
git commit -m "feat(offline): add Play Offline download-and-ready flow"
```

---

### Task 7: Offline chrome gating in Home & AppShell

**Files:**
- Modify: `src/pages/Home.tsx`
- Modify: `src/components/AppShell.tsx`
- Test: `src/pages/Home.offline.test.tsx`

**Interfaces:**
- Consumes: `useOffline` from Task 1.
- Produces: in offline mode Home hides the participant banner and makes NO `loadStudents`/`analytics.getProgress` calls; AppShell hides the Participants/Progress/Cohort/Profile tabs and shows an "Exit Offline" control.

- [ ] **Step 1: Write the failing test**

```tsx
// src/pages/Home.offline.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Home } from './Home'
import { useOffline } from '../state/offline'
import { useAuth } from '../state/auth'
import * as analytics from '../services/analytics'

beforeEach(() => {
  useOffline.setState({ offlineMode: true })
  useAuth.setState({ students: [], activeStudentId: null, loadStudents: vi.fn() as any })
})

describe('Home in offline mode', () => {
  it('hides the participant banner and does not fetch progress', () => {
    const getProgress = vi.spyOn(analytics.analytics, 'getProgress')
    render(<MemoryRouter><Home /></MemoryRouter>)
    expect(screen.queryByText(/current participant/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/choose a participant/i)).not.toBeInTheDocument()
    expect(getProgress).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/pages/Home.offline.test.tsx`
Expected: FAIL — banner text present and/or `getProgress` called.

- [ ] **Step 3: Gate Home on offlineMode**

In `src/pages/Home.tsx`, add the import:

```ts
import { useOffline } from '../state/offline'
```

Read the flag near the other hooks (after line 18):

```ts
  const offlineMode = useOffline((s) => s.offlineMode)
```

Guard the two effects so offline makes no network calls — change the effect bodies:

```ts
  useEffect(() => {
    if (offlineMode) return
    void loadStudents().catch(() => {})
  }, [loadStudents, offlineMode])
  useEffect(() => {
    if (offlineMode) return
    let cancelled = false
    const levelGames = GAME_LIST.filter((g) => g.hasLevels)
    void Promise.all(
      levelGames.map(async (g) => {
        const rows = await analytics.getProgress(g.id)
        const pct = rows.length
          ? Math.round((rows.reduce((a, r) => a + r.best_accuracy, 0) / rows.length) * 100)
          : 0
        return [g.id, pct] as const
      }),
    ).then((entries) => {
      if (cancelled) return
      setPercents(Object.fromEntries(entries))
    })
    return () => {
      cancelled = true
    }
  }, [activeStudentId, offlineMode])
```

Wrap the participant banner (lines 51–76) so it renders only when online:

```tsx
      {!offlineMode && (
        <header className="participant-banner">
          {/* ...existing banner contents unchanged... */}
        </header>
      )}
```

- [ ] **Step 4: Gate AppShell tabs and add Exit Offline**

In `src/components/AppShell.tsx`, add imports:

```ts
import { useNavigate } from 'react-router-dom'
import { useOffline } from '../state/offline'
```

In `AppShell()`, read the flag and filter the tabs:

```tsx
  const offlineMode = useOffline((s) => s.offlineMode)
  const setOfflineMode = useOffline((s) => s.setOfflineMode)
  const navigate = useNavigate()
  // Offline mode is anonymous — only Home is meaningful; the rest need a server.
  const tabs = offlineMode ? TABS.filter((t) => t.to === '/') : TABS
```

Render `tabs` instead of `TABS` in the `.map(...)`, and after the nav's tab list add an Exit control shown only offline:

```tsx
        {offlineMode && (
          <button
            type="button"
            className="tab"
            onClick={() => {
              setOfflineMode(false)
              navigate('/login', { replace: true })
            }}
          >
            <span className="tab-label">Exit Offline</span>
          </button>
        )}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/pages/Home.offline.test.tsx`
Expected: PASS.

- [ ] **Step 6: Run the full suite to check nothing regressed**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Home.tsx src/components/AppShell.tsx src/pages/Home.offline.test.tsx
git commit -m "feat(offline): hide online chrome and skip network calls in offline mode"
```

---

### Task 8: Entry points — "Play Offline" on Login and Home

**Files:**
- Modify: `src/pages/Login.tsx`
- Modify: `src/pages/Home.tsx`
- Test: `src/pages/Login.test.tsx`

**Interfaces:**
- Consumes: the `/play-offline` route from Task 5; `useOffline` from Task 1.
- Produces: a "Play Offline" link on the Login page and an "Offline mode" button on the Home page (shown only when online), both routing to `/play-offline`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/pages/Login.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { Login } from './Login'

describe('Login offline entry', () => {
  it('shows a Play Offline link pointing at /play-offline', () => {
    render(<MemoryRouter><Login /></MemoryRouter>)
    const link = screen.getByRole('link', { name: /play offline/i })
    expect(link).toHaveAttribute('href', '/play-offline')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/pages/Login.test.tsx`
Expected: FAIL — no such link.

- [ ] **Step 3: Add the Login link**

In `src/pages/Login.tsx`, add a link inside the `<form>` just above the closing `</form>` (after the `auth-trouble` paragraph):

```tsx
        <p className="auth-alt">
          <Link to="/play-offline" className="link-accent">Play Offline</Link>
        </p>
```

(`Link` is already imported in this file.)

- [ ] **Step 4: Add the Home button (online only)**

In `src/pages/Home.tsx`, using the `offlineMode` flag and `Link` already imported, add a small entry at the top of the returned `.page.home` div, before the participant banner block:

```tsx
      {!offlineMode && (
        <Link to="/play-offline" className="link-accent home-offline-link">Play Offline</Link>
      )}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- src/pages/Login.test.tsx`
Expected: PASS.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Login.tsx src/pages/Home.tsx src/pages/Login.test.tsx
git commit -m "feat(offline): add Play Offline entry points on Login and Home"
```

---

### Task 9: End-to-end offline verification (manual, no code)

**Files:** none (verification only).

This task confirms the whole flow works in a real build, since the service worker and Cache Storage do not run under Vitest/jsdom.

- [ ] **Step 1: Build and preview**

Run: `npm run build && npm run preview`
Expected: preview served at a local URL over http (service worker registers because `import.meta.env.PROD` is true in a build).

- [ ] **Step 2: Prepare offline**

In the browser: open the preview, go to Login → click **Play Offline** → **Download games**. Watch the progress bar reach 100%, then land on **Start**.

- [ ] **Step 3: Verify assets cached**

In DevTools → Application → Cache Storage: confirm an `offline-media-v1` bucket holds the video/emotion/group files.

- [ ] **Step 4: Go offline and play**

In DevTools → Network, set **Offline**. Click **Start**, open a video game (e.g. Identify Emotions) and a 360/VR game — confirm both load and the media plays with no network requests hitting the server. Confirm the participant banner and Participants/Progress/Cohort/Profile tabs are hidden and **Exit Offline** is present.

- [ ] **Step 5: Verify reload persists offline mode**

Still offline, reload the page. Expected: the app boots from the service worker and stays in offline mode (no redirect to a network login).

- [ ] **Step 6: Exit offline**

Click **Exit Offline**. Expected: returns to Login; online chrome is restored when back online.

---

## Notes for the implementer

- **VR needs no game changes.** 360 games already play the cached videos; a PWA keeps its HTTPS origin so `immersive-vr` stays available offline. The only offline-specific concern is storage capacity, handled by `estimateStorage` in Task 3/6.
- **`document.baseURI` matters.** Because `base: './'`, always resolve asset URLs relative to `document.baseURI` (done in `offlineCache.assetRequest`). Do not hardcode leading `/`.
- **Dev vs. build.** The service worker is disabled in `npm run dev` (VitePWA `devOptions.enabled: false`), so offline serving is only verifiable via `npm run build && npm run preview` (Task 9). Logic-level behaviour is covered by unit tests.
