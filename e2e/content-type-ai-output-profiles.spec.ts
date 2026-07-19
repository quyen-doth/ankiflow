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

test('AI output editor は未保存 profile で sample generation を表示する', async ({ page }) => {
  let requestBody: unknown
  await page.route('**/api/generate', async route => {
    requestBody = route.request().postDataJSON()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: { word: 'book', meaning_vi: 'sách', level: 'B2' } }),
    })
  })
  await page.goto('/verify/AiOutputProfilesEditor/default-language-profiles?chrome=0')

  await page.getByRole('textbox', { name: 'AI output instruction 0' }).fill('Unsaved test instruction')
  await page.getByRole('textbox', { name: 'AI test sample' }).fill('book')
  await page.getByRole('combobox', { name: 'AI test study language' }).selectOption('en')
  await page.getByRole('button', { name: 'Run test' }).click()

  const result = page.getByLabel('AI test result')
  await expect(result).toContainText('B2')
  await expect(result.getByText('Custom', { exact: true })).toBeVisible()
  expect(requestBody).toMatchObject({
    form_type: 'form_language',
    word: 'book',
    language: 'en',
    content_type_inline: {
      code: 'language',
      ai_output_profiles: expect.arrayContaining([
        expect.objectContaining({
          profile: 'default',
          fields: expect.arrayContaining([
            expect.objectContaining({ key: 'word', instruction: 'Unsaved test instruction' }),
          ]),
        }),
      ]),
    },
  })
})
