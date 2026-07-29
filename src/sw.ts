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

// Take over the moment a new build finishes installing.
//
// Without skipWaiting, a new service worker sits in "waiting" until every tab
// controlled by the old one is closed. A headset browser keeps its tabs open
// across sessions, so a facilitator who pulls a new build and reloads keeps
// getting the OLD precached app shell — indefinitely, with no error and no
// sign anything is stale. That is exactly what makes a shipped fix look like
// it did nothing on the device.
self.addEventListener('install', () => {
  void self.skipWaiting()
})
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
