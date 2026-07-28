import { expect, test } from '@playwright/test'

test('AI output language の変更を Create の Card Type 表示へ反映する', async ({ page }) => {
  await page.goto('/verify/CardTypeLanguagePairFlow/e2e-settings-to-create?chrome=0')

  await expect(page.getByRole('button', { name: 'Vietnamese → Chinese' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Japanese → Chinese' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Listening' })).toBeVisible()

  await page.getByRole('button', { name: 'Japanese', exact: true }).click()

  await expect(page.getByRole('button', { name: 'Japanese → Chinese' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Vietnamese → Chinese' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Listening' })).toBeVisible()
})
