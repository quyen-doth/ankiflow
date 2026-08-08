import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page } from '@playwright/test'

/** Shared helpers for the portfolio capture suite (stills + video). */

export const OUT_DIR = join(process.cwd(), 'docs', 'screenshots')
mkdirSync(OUT_DIR, { recursive: true })

export const DEMO_EMAIL = process.env.DEMO_EMAIL?.trim() ?? ''
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? ''

/** Make the AnkiConnect ping report "connected" so Export controls render enabled (D4). */
export async function mockAnkiConnect(page: Page): Promise<void> {
  await page.route(/127\.0\.0\.1:8765|localhost:8765/, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ result: 6, error: null }) }),
  )
}

/** Sign in with the real demo account and land on the dashboard. */
export async function login(page: Page): Promise<void> {
  expect(DEMO_EMAIL, 'DEMO_EMAIL must be set').not.toBe('')
  expect(DEMO_PASSWORD, 'DEMO_PASSWORD must be set').not.toBe('')
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.getByPlaceholder('you@example.com').fill(DEMO_EMAIL)
  await page.getByPlaceholder('Your password').fill(DEMO_PASSWORD)
  const signIn = page.getByRole('button', { name: 'Sign in' })
  await expect(signIn, 'Sign in button did not enable after filling credentials').toBeEnabled({ timeout: 10_000 })
  await signIn.click()
  await page.waitForURL('**/dashboard', { timeout: 45_000 })
}

/**
 * Let client-SDK data settle before capturing. `networkidle` never fires (Firestore
 * realtime listeners + AnkiConnect polling keep connections open), so use a bounded
 * wait plus a fixed pause for client data to render.
 */
export async function settle(page: Page, pause = 3000): Promise<void> {
  await page.waitForLoadState('load').catch(() => {})
  await page.waitForTimeout(pause)
}
