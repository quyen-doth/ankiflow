import { expect, test } from '@playwright/test'

test('Content Type editor は profile ごとの AI output instruction を保存して再表示する', async ({ page }) => {
  await page.goto('/verify/AiOutputProfilesEditor/e2e-editor-flow?chrome=0')

  const profileSelect = page.getByRole('combobox', { name: 'AI output profile' })
  await expect(profileSelect.locator('option')).toHaveText(['Default', 'English', 'Chinese', 'Japanese'])
  await profileSelect.selectOption({ label: 'Chinese' })

  const primaryKey = page.getByRole('textbox', { name: 'AI output key 0' })
  await expect(primaryKey).toBeDisabled()
  await expect(page.getByText('Primary', { exact: true })).toBeVisible()
  await page.getByRole('textbox', { name: 'AI output instruction 0' }).fill('Chinese identity from workspace')
  await page.getByRole('button', { name: 'Add Output Field' }).click()
  await page.getByRole('textbox', { name: /AI output key/ }).last().fill('memory_hook')
  await page.getByRole('textbox', { name: /AI output instruction/ }).last().fill('Short memory hook')
  await page.getByRole('button', { name: 'Move AI output memory_hook up' }).click()
  await page.getByRole('button', { name: 'Save Profile Draft' }).click()

  await expect(page.getByText('Profile draft saved.')).toBeVisible()
  await page.getByRole('button', { name: 'Reopen editor' }).click()
  await page.getByRole('combobox', { name: 'AI output profile' }).selectOption({ label: 'Chinese' })
  await expect(page.getByRole('textbox', { name: 'AI output instruction 0' }))
    .toHaveValue('Chinese identity from workspace')
  await expect(page.getByRole('button', { name: 'Remove AI output memory_hook' })).toBeVisible()

  await page.getByRole('button', { name: 'Remove AI output memory_hook' }).click()
  await page.getByRole('button', { name: 'Save Profile Draft' }).click()
  await page.getByRole('button', { name: 'Reopen editor' }).click()
  await page.getByRole('combobox', { name: 'AI output profile' }).selectOption({ label: 'Chinese' })
  await expect(page.getByRole('button', { name: 'Remove AI output memory_hook' })).toHaveCount(0)
})
