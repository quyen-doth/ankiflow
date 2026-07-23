import { expect, test } from '@playwright/test'

test('phon_the を含む Card Type は確認 modal を開ける', async ({ page }) => {
  await page.goto('/verify/PreviewCardValidationBrowser/custom-field-allows-confirmation?chrome=0')

  await expect(page.getByRole('heading', { name: 'Save & Export to Anki' })).toBeVisible()
  await expect(page.locator('[role="alert"]').filter({ hasText: "This card can't be exported yet" })).toHaveCount(0)
})

test('phon_the が空の Card Type は確認前に停止する', async ({ page }) => {
  await page.goto('/verify/PreviewCardValidationBrowser/probe-empty-custom-field-side?chrome=0')

  await expect(page.getByRole('heading', { name: 'Save & Export to Anki' })).toHaveCount(0)
  await expect(page.locator('[role="alert"]').filter({ hasText: 'Vietnamese → Chinese' }))
    .toContainText('Vietnamese → Chinese: Back has no content')
})
