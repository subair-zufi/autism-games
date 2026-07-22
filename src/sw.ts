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
