import { config as loadEnv } from 'dotenv'
import { defineConfig, devices } from '@playwright/test'

loadEnv({ quiet: true })

const host = process.env.PLAYWRIGHT_HOST === 'localhost' ? 'localhost' : '127.0.0.1'
const requestedPort = Number.parseInt(process.env.PLAYWRIGHT_PORT ?? '', 10)
const port = Number.isInteger(requestedPort) && requestedPort >= 1 && requestedPort <= 65_535
  ? String(requestedPort)
  : '3000'
const baseURL = `http://${host}:${port}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `npm run dev -- --hostname ${host} --port ${port}`,
    url: `${baseURL}/verify`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
