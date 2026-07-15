import { expect, test } from '@playwright/test'

test('Create Batch の modifier+Enter は行を追加せず、Enter 単体だけが追加する', async ({ page }) => {
  await page.goto('/verify/BatchItemList/configured?chrome=0')

  const rows = page.locator('input[aria-label^="Vocabulary item"]')
  await expect(rows).toHaveCount(1)

  await rows.first().press('Meta+Enter')
  await expect(rows).toHaveCount(1)

  await rows.first().press('Control+Enter')
  await expect(rows).toHaveCount(1)

  await rows.first().press('Enter')
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(1)).toBeFocused()
})
