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
  await page.getByRole('combobox', { name: 'Add AI output field' }).selectOption('custom')
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

test('AI output editor は text-only 境界と profile preset を表示して field を追加する', async ({ page }) => {
  await page.goto('/verify/AiOutputProfilesEditor/default-language-profiles?chrome=0')

  await expect(page.getByText(
    'Custom fields are text-only. Audio, images and cloze come from system field types.',
  )).toBeVisible()

  await page.getByRole('combobox', { name: 'AI output profile' }).selectOption({ label: 'Chinese' })
  const picker = page.getByRole('combobox', { name: 'Add AI output field' })
  const suggested = picker.locator('optgroup[label="Suggested fields"] option')
  await expect(suggested).toHaveCount(2)
  await expect(suggested.nth(0)).toContainText('Traditional form')
  await expect(suggested.nth(1)).toContainText('Common sentence patterns')

  await picker.selectOption('preset:phon_the')

  await expect(page.getByRole('textbox', { name: /AI output key/ }).last()).toHaveValue('phon_the')
  await expect(page.getByRole('textbox', { name: /AI output instruction/ }).last()).toHaveValue(
    /Return an empty string if identical to the simplified form\./,
  )
  await expect(picker).toHaveValue('')
  await expect(picker.locator('option[value="preset:phon_the"]')).toHaveCount(0)
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

test('AI output editor は要件から instruction 候補を生成して編集可能な draft に反映する', async ({ page }) => {
  let requestBody: unknown
  await page.route('**/api/content-types/suggest-instruction', async route => {
    requestBody = route.request().postDataJSON()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        instruction: 'Return a concise definition in {output_language}. Return an empty string if the meaning is unknown.',
      }),
    })
  })
  await page.goto('/verify/AiOutputProfilesEditor/default-language-profiles?chrome=0')

  await page.getByRole('button', { name: 'Suggest instruction for word', exact: true }).click()
  await page.getByRole('textbox', { name: 'Instruction suggestion description 0' })
    .fill('A concise definition in the selected output language')
  await page.getByRole('button', { name: 'Generate suggestion' }).click()

  const instruction = page.getByRole('textbox', { name: 'AI output instruction 0' })
  await expect(instruction).toHaveValue(
    'Return a concise definition in {output_language}. Return an empty string if the meaning is unknown.',
  )
  await instruction.fill('Return a short editable definition.')
  await expect(instruction).toHaveValue('Return a short editable definition.')
  expect(requestBody).toEqual({
    field_key: 'word',
    type: 'string',
    description: 'A concise definition in the selected output language',
  })
})

test('AI output editor は Suggest 待機中の手動 instruction 編集を保持する', async ({ page }) => {
  let requestSeen = false
  let releaseSuggestion = () => {}
  const suggestionGate = new Promise<void>(resolve => {
    releaseSuggestion = resolve
  })
  await page.route('**/api/content-types/suggest-instruction', async route => {
    requestSeen = true
    await suggestionGate
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ instruction: 'Stale generated instruction.' }),
    })
  })
  await page.goto('/verify/AiOutputProfilesEditor/default-language-profiles?chrome=0')

  await page.getByRole('button', { name: 'Suggest instruction for word', exact: true }).click()
  await page.getByRole('textbox', { name: 'Instruction suggestion description 0' })
    .fill('A concise definition')
  const responsePromise = page.waitForResponse('**/api/content-types/suggest-instruction')
  await page.getByRole('button', { name: 'Generate suggestion' }).click()
  await expect.poll(() => requestSeen).toBe(true)

  const instruction = page.getByRole('textbox', { name: 'AI output instruction 0' })
  await instruction.fill('Keep my manual edit.')
  releaseSuggestion()
  await responsePromise

  await expect(instruction).toHaveValue('Keep my manual edit.')
})
