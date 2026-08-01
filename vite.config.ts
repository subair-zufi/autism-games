/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Stamped into the bundle and shown at the bottom of Profile. With an
  // offline service worker in front of the app, "is this headset actually
  // running the build I just deployed?" is otherwise unanswerable on-device.
  define: {
    __BUILD_STAMP__: JSON.stringify(
      new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
    ),
  },
  // relative paths so the build works on GitHub Pages' /<repo>/ subpath
  base: './',
  // `npm run dev:vr` serves HTTPS on the LAN so a Quest headset can enter
  // WebXR (immersive-vr needs a secure context); plain `npm run dev` is unchanged
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
        globPatterns: ['**/*.{js,css,html,woff2,json}'],
        // a hardware diagnostic, not part of the app — keeping it out of the
        // precache means it is always fetched fresh, so it cannot report on a
        // stale copy of itself
        globIgnores: ['xr-exit-test.html'],
        maximumFileSizeToCacheInBytes: 5_000_000,
      },
      devOptions: { enabled: false },
    }),
  ],
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'] },
})
