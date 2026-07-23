import { expect, test } from '@playwright/test'

test('Card preview は custom field source の値を裏面に表示する', async ({ page }) => {
  await page.goto('/verify/CardPreview/custom-field?chrome=0')

  const preview = page.locator('[data-verify-unit="CardPreview"]')
  const iframe = page.locator('iframe[title="Card preview"]')
  await expect(preview).toHaveAttribute('data-verify-flipped', 'true')
  await expect(iframe).toHaveAttribute('srcdoc', /class="custom-field custom-phon_the"/)
  await expect(iframe).toHaveAttribute('srcdoc', /喫飯/)
})

test('Card preview は custom string array の改行を保持する', async ({ page }) => {
  await page.goto('/verify/CardPreview/custom-array-field?chrome=0')

  const field = page.frameLocator('iframe[title="Card preview"]').locator('.custom-field')
  await expect(field).toHaveText('formal\nwritten')
  await expect(field).toHaveCSS('white-space', 'pre-line')
})

test('Card preview は例文 audio を専用 chip として表示する', async ({ page }) => {
  await page.goto('/verify/CardPreview/example-audio?chrome=0')

  const preview = page.locator('[data-verify-unit="CardPreview"]')
  await expect(preview).toHaveAttribute('data-verify-flipped', 'true')
  await expect(page.locator('iframe[title="Card preview"]'))
    .toHaveAttribute('srcdoc', /🔊 Example audio/)
})

test('Review は選択 template が使う例文 audio player を表示する', async ({ page }) => {
  await page.goto('/verify/ReviewAudioPlayers/uses-example?chrome=0')

  const players = page.locator('[data-verify-unit="ReviewAudioPlayers"]')
  await expect(players).toHaveAttribute('data-verify-showexampleaudio', 'true')
  await expect(players.getByText('Example audio', { exact: true })).toBeVisible()
})

test('Card Template editor は custom field option を追加して preview する', async ({ page }) => {
  await page.goto('/verify/CardTemplateEditor/custom-options?chrome=0')

  await page.getByRole('combobox', { name: 'Add field to back' }).selectOption('custom:phon_the')

  await expect(page.getByRole('button', { name: 'Remove Traditional form' })).toBeVisible()
  await expect(page.locator('iframe[title="Card preview"]'))
    .toHaveAttribute('srcdoc', /Sample Traditional form/)
})

test('Card Template editor は Example audio capability を追加して preview する', async ({ page }) => {
  await page.goto('/verify/CardTemplateEditor/custom-options?chrome=0')

  await page.getByRole('combobox', { name: 'Add field to back' }).selectOption('audio_example')

  await expect(page.getByRole('button', { name: 'Remove Example audio' })).toBeVisible()
  await expect(page.locator('iframe[title="Card preview"]'))
    .toHaveAttribute('srcdoc', /🔊 Example audio/)
})

test('Preview additional fields は custom value を編集できる', async ({ page }) => {
  await page.goto('/verify/AdditionalFields/custom-values?chrome=0')

  await expect(page.getByText('Additional fields', { exact: true })).toBeVisible()
  await page.getByText('喫飯', { exact: true }).click()
  await page.getByRole('textbox', { name: 'Edit value' }).fill('吃飯')
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByText('吃飯', { exact: true })).toBeVisible()
  await expect(page.locator('[data-verify-unit="AdditionalFields"]'))
    .toHaveAttribute('data-verify-lastkey', 'phon_the')

  const relatedWords = page.getByText('Related words', { exact: true }).locator('..')
  await relatedWords.getByTitle('Click to edit').click()
  await page.getByRole('textbox', { name: 'Edit value' }).fill('用餐\n美食')
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page.locator('[data-verify-unit="AdditionalFields"]'))
    .toHaveAttribute('data-verify-related', '用餐|美食')
})
