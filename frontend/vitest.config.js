import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The existing *.test.jsx files import from 'bun:test'. Vitest exposes the same
// describe/it/expect surface, so one alias runs them without rewriting the tests.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'bun:test': 'vitest',
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx,ts,tsx}'],
    setupFiles: ['./src/test-setup.js'],
  },
})
