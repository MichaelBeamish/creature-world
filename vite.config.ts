/// <reference types="vitest/config" />
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/  ·  https://vitest.dev/config/
export default defineConfig({
  plugins: [vue()],
  test: {
    // Node environment on purpose: no DOM in tests keeps simulation code browser-free.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
