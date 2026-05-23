/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: '/webcalc/',
  plugins: [vue()],
  build: {
    target: 'esnext',
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
      include: ['src/**'],
      exclude: ['src/main.ts', 'src/env.d.ts', 'src/types/**', 'src/**/*.test.ts'],
    },
  },
})
