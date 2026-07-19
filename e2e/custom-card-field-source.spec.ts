import { expect, test } from '@playwright/test'

test('Card preview は custom field source の値を裏面に表示する', async ({ page }) => {
  await page.goto('/verify/CardPreview/custom-field?chrome=0')

  const preview = page.locator('[data-verify-unit="CardPreview"]')
  const iframe = page.locator('iframe[title="Card preview"]')
  await expect(preview).toHaveAttribute('data-verify-flipped', 'true')
  await expect(iframe).toHaveAttribute('srcdoc', /class="custom-field custom-phon_the"/)
  await expect(iframe).toHaveAttribute('srcdoc', /喫飯/)
})

test('Card Template editor は custom field option を追加して preview する', async ({ page }) => {
  await page.goto('/verify/CardTemplateEditor/custom-options?chrome=0')

  await page.getByRole('combobox', { name: 'Add field to back' }).selectOption('custom:phon_the')

  await expect(page.getByRole('button', { name: 'Remove Traditional form' })).toBeVisible()
  await expect(page.locator('iframe[title="Card preview"]'))
    .toHaveAttribute('srcdoc', /Sample Traditional form/)
})
