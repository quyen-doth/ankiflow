import { expect, test } from '@playwright/test'

test('click trực tiếp trên card preview lật được mặt sau và quay lại mặt trước', async ({ page }) => {
  await page.goto('/verify/CardPreview/language-entry?chrome=0')

  const preview = page.locator('[data-verify-unit="CardPreview"]')
  const iframe = page.locator('iframe[title="Card preview"]')
  await expect(iframe).toBeVisible()

  await page.getByRole('button', { name: 'Reveal card answer' }).click()
  await expect(preview).toHaveAttribute('data-verify-flipped', 'true')
  await expect(page.getByRole('button', { name: 'Show card front' })).toHaveAttribute('aria-pressed', 'true')
  await expect(iframe).toHaveAttribute('srcdoc', /id="answer"/)

  await page.getByRole('button', { name: 'Show card front' }).click()
  await expect(preview).toHaveAttribute('data-verify-flipped', 'false')
  await expect(page.getByRole('button', { name: 'Reveal card answer' })).toHaveAttribute('aria-pressed', 'false')
})
