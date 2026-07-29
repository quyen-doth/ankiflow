import { expect, test } from '@playwright/test'

test('Review layout は AI output language に応じて Hán-Việt field を切り替える', async ({ page }) => {
  const hanVietField = page.locator('[data-testid="han-viet-field"]')

  await page.goto('/verify/ReviewLanguageFields/non-vietnamese-output?chrome=0')
  await expect(hanVietField).toHaveCount(0)

  await page.goto('/verify/ReviewLanguageFields/vietnamese-output?chrome=0')
  await expect(hanVietField).toBeVisible()
  await expect(hanVietField).toContainText('Sino-Vietnamese reading')

  await page.goto('/verify/ReviewLanguageFields/legacy-output?chrome=0')
  await expect(hanVietField).toBeVisible()

  await page.goto('/verify/ReviewLanguageFields/non-sino-study-language?chrome=0')
  await expect(hanVietField).toHaveCount(0)
})
