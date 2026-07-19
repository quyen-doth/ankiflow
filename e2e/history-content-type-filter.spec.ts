import { expect, test } from '@playwright/test'
import { FormType } from '../types'

test.describe('History Content Type filter', () => {
  test('short built-in codes を一度だけ表示し form_* entries を絞り込む', async ({ page }) => {
    await page.goto('/verify/HistoryContentTypeFilter/default?chrome=0')

    const select = page.getByRole('combobox', { name: 'Content type' })
    await expect(select.locator('option')).toHaveCount(4)
    await expect(select.getByRole('option', { name: 'Language' })).toHaveCount(1)
    await expect(select.getByRole('option', { name: 'IT Vocabulary' })).toHaveCount(1)
    await expect(select.getByRole('option', { name: 'General Knowledge' })).toHaveCount(1)

    await select.selectOption(FormType.LANGUAGE)
    await expect(page.getByRole('status', { name: 'Filtered entries' }))
      .toHaveText('language-entry')

    await select.selectOption(FormType.IT)
    await expect(page.getByRole('status', { name: 'Filtered entries' }))
      .toHaveText('it-entry')
  })

  test('duplicate short/form_* definitions でも option は一つだけ', async ({ page }) => {
    await page.goto('/verify/HistoryContentTypeFilter/probe-duplicate-alias?chrome=0')

    const select = page.getByRole('combobox', { name: 'Content type' })
    await expect(select.locator('option')).toHaveCount(4)
    await expect(select.getByRole('option', { name: 'Language' })).toHaveCount(1)
  })
})
