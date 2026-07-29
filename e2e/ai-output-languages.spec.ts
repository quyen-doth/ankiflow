import { expect, test } from '@playwright/test'

test('Settings の AI output languages は enabled list から明示 default を選ぶ', async ({ page }) => {
  await page.goto('/verify/AiOutputLanguageSettings/configured?chrome=0')

  await expect(page.getByText('AI Output Languages', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Display name for AI output vi')).toHaveValue('Vietnamese')
  await expect(page.getByLabel('Display name for AI output ja')).toHaveValue('Japanese')

  const defaultSelect = page.getByRole('combobox', { name: 'Default AI output language' })
  await expect(defaultSelect).toHaveValue('vi')
  await expect(defaultSelect.locator('option')).toHaveText([
    'Choose a default language…',
    'Vietnamese (vi)',
    'Japanese (ja)',
  ])
})

test('Settings は disabled default を field-level error として表示する', async ({ page }) => {
  await page.goto('/verify/AiOutputLanguageSettings/probe-disabled-default?chrome=0')

  const defaultSelect = page.getByRole('combobox', { name: 'Default AI output language' })
  await expect(defaultSelect).toHaveValue('')
  await expect(defaultSelect).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('Choose an enabled AI output language before saving.')).toBeVisible()
  await expect(defaultSelect.locator('option')).toHaveText([
    'Choose a default language…',
    'Japanese (ja)',
  ])
})
