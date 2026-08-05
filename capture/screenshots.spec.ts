import { join } from 'node:path'
import { test, type Page } from '@playwright/test'
import { OUT_DIR, login, mockAnkiConnect, settle } from './helpers'

/**
 * Portfolio STILL capture. NOT part of `npm run test:e2e` — run via `npm run screenshots`
 * against the real demo account.
 */

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: join(OUT_DIR, `${name}.png`), fullPage: true })
}

test('capture public login screen (SC-001)', async ({ page }) => {
  await page.goto('/login')
  await settle(page)
  await shot(page, 'sc-001-login')
})

test('capture authenticated screens', async ({ page }) => {
  await mockAnkiConnect(page)
  await login(page)

  // SC-003 Dashboard
  await settle(page)
  await shot(page, 'sc-003-dashboard')

  // SC-004 Create
  await page.goto('/create')
  await settle(page)
  await shot(page, 'sc-004-create')

  // SC-007 History
  await page.goto('/history')
  await settle(page)
  await shot(page, 'sc-007-history')

  // SC-008 History detail — rows navigate via onRowClick (not <a>), so click a word cell.
  const row = page.getByText('resilience', { exact: true }).first()
  if (await row.count()) {
    await row.click()
    await page.waitForURL(/\/history\/[^/]+$/, { timeout: 20_000 }).catch(() => {})
    await settle(page)
    await shot(page, 'sc-008-history-detail')
  }

  // SC-012 Settings
  await page.goto('/settings')
  await settle(page)
  await shot(page, 'sc-012-settings')
})
