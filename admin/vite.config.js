import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const here = p => fileURLToPath(new URL(p, import.meta.url))

// The admin lives at /admin on the site. It imports the site's own
// index.html, renderer and defaults (for the live preview), so the dev
// server may read the folder above.
export default defineConfig({
  root: here('.'),
  base: '/admin/',
  plugins: [react()],
  css: { postcss: here('.') },
  server: { fs: { allow: [here('..')] } },
  build: { outDir: here('../dist/admin'), emptyOutDir: true },
})
