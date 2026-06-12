import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Stub vitest-only — PHẢI đứng trước alias '@' để thắng khi resolve
      {
        find: 'firebase/firestore',
        replacement: path.resolve(__dirname, 'verify/harness/firestore-stub.ts'),
      },
      {
        find: '@/lib/firebase',
        replacement: path.resolve(__dirname, 'verify/harness/firebase-stub.ts'),
      },
      { find: '@', replacement: path.resolve(__dirname) },
    ],
  },
  test: {
    environment: 'jsdom',
    include: ['verify/**/*.test.ts'],
    setupFiles: ['verify/test-setup.ts'],
    globals: false,
  },
})
