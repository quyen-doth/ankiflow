import { config as loadEnv } from 'dotenv'
import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for the PORTFOLIO CAPTURE suite — kept separate from the normal
 * e2e run (`npm run test:e2e`) on purpose: it is an artifact generator, not a test.
 * It logs into the real demo account and writes screenshots/video into docs/screenshots/.
 * Requires DEMO_EMAIL / DEMO_PASSWORD in `.env` (or `.env.local`).
 */
loadEnv({ path: '.env.local', quiet: true })
loadEnv({ quiet: true })

const host = process.env.PLAYWRIGHT_HOST === 'localhost' ? 'localhost' : '127.0.0.1'
const port = process.env.PLAYWRIGHT_PORT ?? '3000'
const baseURL = `http://${host}:${port}`

export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 90_000,
  use: {
    baseURL,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    // Disable entrance animations so framer-motion elements are immediately "stable"
    // (otherwise Playwright's actionability waits on a moving target).
    contextOptions: { reducedMotion: 'reduce' },
    actionTimeout: 20_000,
    trace: 'off',
  },
  // Capture runs against a PRODUCTION server (no HMR, reliable hydration, no dev overlays).
  // Build once + `next start` yourself, or let this build+start on demand.
  webServer: {
    command: `npm run build && npx next start --hostname ${host} --port ${port}`,
    url: `${baseURL}/login`,
    reuseExistingServer: true,
    timeout: 300_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
