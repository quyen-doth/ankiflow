import { expect, test } from '@playwright/test'

test('Content Type は AI output language control を data source として追加・削除できる', async ({ page }) => {
  await page.goto('/verify/ContentTypeDataSourceEditor/configure-output-language?chrome=0')

  await expect(page.getByLabel('Data source for field 0')).toHaveValue('output_languages')
  await expect(page.getByLabel('Field key 0')).toHaveValue('output_language')
  await expect(page.getByLabel('Label for field 0')).toHaveValue('AI output language')
  await expect(page.getByLabel('Type for field 0')).toHaveValue('dropdown')
  await expect(page.getByLabel('Options for field 0')).toHaveCount(0)

  await page.getByRole('button', { name: 'Remove field output_language' }).click()
  await expect(page.getByLabel('Data source for field 0')).toHaveCount(0)
})
