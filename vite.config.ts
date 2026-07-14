/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  // relative paths so the build works on GitHub Pages' /<repo>/ subpath
  base: './',
  // `npm run dev:vr` serves HTTPS on the LAN so a Quest headset can enter
  // WebXR (immersive-vr needs a secure context); plain `npm run dev` is unchanged
  plugins: [react(), ...(process.env.VR ? [basicSsl()] : [])],
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'] },
})
