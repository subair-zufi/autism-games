# Offline Mode — Design

**Date:** 2026-07-22
**Status:** Approved (design), pending implementation plan

## Problem

The app is a client-side React/Vite SPA of therapeutic games. In some scenarios
(e.g. a therapist on a tablet or VR headset with no connectivity) the games need
to run with **no internet**. Today every route sits behind `RequireAuth`
([src/App.tsx:55](../../../src/App.tsx)), which forces `/login`, and login,
participant management, and analytics all assume a live server.

We want an explicit **"Play Offline"** entry that: downloads all game assets into
local storage once (with a visible progress bar), then lets the full game library
— including WebXR/VR 360 games — run with no network, skipping login, participant
selection, and data saving.

## Goals

- One-tap **"Play Offline"** on the Login page and an **"Offline mode"** entry on
  the Home page.
- Cache the **full library** (~270MB: `public/videos`, `public/emotions`,
  `public/groups`) plus the app shell, with a **byte-based progress bar**.
- Bypass the auth gate in offline mode; run as an anonymous session so no data is
  saved (existing no-op behaviour when unauthenticated).
- Reuse the existing **Home game grid** in an "offline variant"; hide all online
  chrome.
- **VR/360 games work offline** with no per-game changes.

## Non-Goals (YAGNI)

- No local persistence or later sync of analytics/steps while offline — data is
  simply not recorded.
- No per-game / curated offline subsets — it's the whole library or nothing.
- No offline account creation or login.
- No background/automatic pre-download — caching is always user-triggered.

## Architecture

### Offline flag
A single `offlineMode: boolean` in app state (Zustand, persisted to
`localStorage`). It is the switch that:
1. lets `RequireAuth` pass without a login, and
2. hides online-only UI.

Offline mode is an **anonymous session**: there is no auth token, so
[src/services/analytics.ts](../../../src/services/analytics.ts) `recordStep` /
`startSession` / `me` etc. already no-op. "Skip saving/participant/login" is
therefore mostly achieved by *hiding UI*, not by adding branches to the API layer.

### Two-layer caching

**Layer 1 — app shell (small, automatic).** A service worker (via
`vite-plugin-pwa` / Workbox) precaches the built JS/CSS/HTML so the app boots
with no network. It must respect the `base: './'` GitHub Pages subpath
([vite.config.ts](../../../vite.config.ts)).

**Layer 2 — media (~270MB, explicit).** *Not* auto-precached (Workbox's silent
precache would defeat the progress-bar UX). Instead:

- A **build-time asset manifest**: a small Vite plugin / prebuild script globs
  `public/videos`, `public/emotions`, `public/groups` and emits a JSON array of
  `{ url, bytes }`. Sizes drive an honest byte-based progress bar.
- A **downloader** module: given the manifest, `fetch()` each asset and
  `cache.put()` it into a named Cache Storage bucket (e.g. `offline-media-v1`).
  - **Skip already-cached** entries → resumable if interrupted.
  - **Per-asset retry** on failure; progress persists across retries.
  - Progress reported as `bytesDone / bytesTotal`.
- The service worker serves manifest paths **cache-first** when offline.

### Auth bypass & routing
Change `RequireAuth` to allow through when `isLoggedIn || offlineMode`. No new
routes: the same Home grid and `/game/:id` are reused.

### Home / AppShell offline variant
Gate on `offlineMode` in [src/components/AppShell.tsx](../../../src/components/AppShell.tsx)
and [src/pages/Home.tsx](../../../src/pages/Home.tsx) to **hide**: student
switcher, Participants, Progress, Cohort, Profile, login state. **Show**: the game
grid, a small "offline" badge, and an "Exit offline" link that clears
`offlineMode`.

### VR / 360 games
No per-game code changes. 360 games play the same cached video files; a PWA keeps
its original **HTTPS** origin, so `immersive-vr` stays available offline. Safety
rails added to the download flow:
- `navigator.storage.estimate()` before downloading — verify ~270MB fits; warn if
  not (important on Quest headsets).
- `navigator.storage.persist()` — request persistent storage so the browser does
  not evict the cache.

## User Flow

Entry points:
- **Login page:** small text link **"Play Offline"**.
- **Home page (logged-in mentor):** small **"Offline mode"** button.

On tap:
1. If the full manifest is already cached → go straight to the **Ready screen**.
2. Else if online → show a **download modal** with a byte-based progress bar
   (with the storage-estimate check first).
3. Else (offline and not cached) → message: *"Connect to the internet once to
   download the games."*

On download complete → land on a **"Ready — Start"** confirmation screen (not
auto-enter). Tapping **Start** sets `offlineMode` and navigates to the Home game
grid (offline variant).

## Error Handling

- **Per-asset fetch failure:** retry; on repeated failure, surface which asset and
  offer retry; keep already-cached progress.
- **Quota exceeded / insufficient storage:** clear message before or during
  download; do not leave a half-broken state (partial cache is fine — it's
  resumable).
- **Offline with no cache:** the "connect once" message above.

## Testing

- **Downloader (unit):** progress math (`bytesDone/bytesTotal`), skip-cached,
  retry-on-failure, using mocked `fetch` and `Cache`.
- **Auth gate (unit):** `RequireAuth` passes when `offlineMode` is true and no
  login; redirects otherwise.
- **Chrome gating (unit/component):** online-only widgets are hidden when
  `offlineMode` is true.
- The service worker stays thin (shell precache + cache-first for manifest paths),
  so it needs minimal testing.

## Affected / New Code (indicative)

- `vite.config.ts` — add `vite-plugin-pwa`; wire base path.
- New: asset-manifest build plugin/script.
- New: `src/services/offlineCache.ts` (or similar) — downloader + progress.
- New: `src/state/offline.ts` — `offlineMode` flag (persisted).
- `src/App.tsx` — `RequireAuth` allows `offlineMode`.
- `src/components/AppShell.tsx`, `src/pages/Home.tsx` — chrome gating + game grid.
- `src/pages/Login.tsx` — "Play Offline" link.
- New: download modal + "Ready — Start" screen components.
