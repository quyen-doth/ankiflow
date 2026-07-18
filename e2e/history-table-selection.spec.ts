import { expect, test } from '@playwright/test'

test.describe('History table selection', () => {
  test('row và select-all checkbox cập nhật selection mà không điều hướng', async ({ page }) => {
    await page.goto('/verify/HistoryTable/populated?chrome=0')

    const firstRow = page.getByRole('checkbox', { name: 'Select serendipity' })
    const secondRow = page.getByRole('checkbox', { name: 'Select Event Loop' })
    const selectAll = page.getByRole('checkbox', { name: 'Select all visible cards' })

    await firstRow.click()
    await expect(firstRow).toBeChecked()
    await expect(selectAll).toHaveJSProperty('indeterminate', true)
    await expect(page).toHaveURL(/\/verify\/HistoryTable\/populated/)

    await selectAll.click()
    await expect(firstRow).toBeChecked()
    await expect(secondRow).toBeChecked()
    await expect(selectAll).toBeChecked()
    await expect(page.getByRole('button', { name: 'View' })).toHaveCount(0)
  })
})
