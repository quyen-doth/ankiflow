import { copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, test, expect } from '@playwright/test'
import { OUT_DIR, mockAnkiConnect, login, settle } from './helpers'

/**
 * Core-loop VIDEO capture — a guided product tour of the "enter a word → AI-enriched
 * card → study-ready preview" flow. Run via `npm run screenshots:video`.
 *
 * The tour shows the ENRICHED RESULT via an existing pre-generated card rather than
 * firing a live (paid, non-deterministic) `/api/generate` call, so the recording stays
 * reproducible and free. The output `.webm` is git-ignored (D6); upload it to a GitHub
 * issue and embed the returned asset URL in the README.
 */

const host = process.env.PLAYWRIGHT_HOST === 'localhost' ? 'localhost' : '127.0.0.1'
const port = process.env.PLAYWRIGHT_PORT ?? '3000'
const baseURL = `http://${host}:${port}`
const SIZE = { width: 1440, height: 900 }

test('record core-loop tour', async () => {
  const browser = await chromium.launch()
  const context = await browser.newContext({
    baseURL,
    viewport: SIZE,
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    recordVideo: { dir: join(process.cwd(), 'test-results', 'capture-video'), size: SIZE },
  })
  const page = await context.newPage()

  try {
    await mockAnkiConnect(page)
    await login(page)

    // 1) Dashboard — the library at a glance.
    await settle(page)
    await page.waitForTimeout(2500)

    // 2) Create — enter a new word.
    await page.getByRole('link', { name: /Create Card/i }).click()
    await page.waitForURL('**/create', { timeout: 20_000 })
    await settle(page)
    const wordField = page.getByPlaceholder('Add word...').first()
    if (await wordField.count()) {
      await wordField.click()
      await wordField.pressSequentially('serendipity', { delay: 90 })
      await page.waitForTimeout(1800)
    }

    // 3) The AI-enriched result — shown via an existing card (definition, IPA, example,
    //    collocations, Unsplash image, TTS audio, Anki card preview).
    await page.goto('/history')
    await settle(page)
    await page.waitForTimeout(1500)
    const row = page.getByText('resilience', { exact: true }).first()
    await expect(row, 'resilience row must exist (run npm run seed:demo first)').toHaveCount(1)
    await row.click()
    await page.waitForURL(/\/history\/[^/]+$/, { timeout: 20_000 })
    await settle(page)
    await page.waitForTimeout(3000)

    // 4) Flip the Anki card preview to reveal the answer.
    const flip = page.getByText(/Click card to reveal answer/i).first()
    if (await flip.count()) {
      await flip.click()
      await page.waitForTimeout(2500)
    }
  } finally {
    const video = page.video()
    await context.close()
    await browser.close()
    if (video) {
      const src = await video.path()
      copyFileSync(src, join(OUT_DIR, 'core-loop.webm'))
      console.log(`🎬 Saved core-loop video → ${join('docs', 'screenshots', 'core-loop.webm')}`)
    }
  }
})
