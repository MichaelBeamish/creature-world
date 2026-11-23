/// <reference types="vitest/config" />
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/  ·  https://vitest.dev/config/
export default defineConfig(({ command, isPreview }) => ({
  // The production build is served from GitHub Pages under /creature-world/ (ADR 0005) — and so is `pnpm preview`,
  // so it matches the live site. `pnpm dev` stays at /.
  base: command === 'build' || isPreview ? '/creature-world/' : '/',
  plugins: [vue()],
  test: {
    // Node environment on purpose: no DOM in tests keeps simulation code browser-free.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}))
