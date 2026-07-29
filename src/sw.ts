// src/sw.ts
/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { RangeRequestsPlugin } from 'workbox-range-requests'
import { isMediaPath } from './services/mediaPaths'
import { MEDIA_CACHE } from './services/offlineCache'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: unknown[] }

// App shell (JS/CSS/HTML/fonts) — precached at install so the app boots offline.
precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('activate', () => self.clients.claim())

// Media: cache-first from the bucket offlineCache filled. Never precached here.
// RangeRequestsPlugin lets cached media be served as 206 Partial Content, which
// iOS Safari requires for <video> playback (it refuses a 200 response to a
// Range request; Chromium/Quest tolerate it, but iPad Safari breaks).
registerRoute(
  ({ url, request }) => request.method === 'GET' && isMediaPath(url.pathname),
  new CacheFirst({
    cacheName: MEDIA_CACHE,
    plugins: [new RangeRequestsPlugin()],
  }),
)
