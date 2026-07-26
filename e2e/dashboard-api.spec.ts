import { expect, test } from '@playwright/test'

test.describe('Dashboard aggregate API UI', () => {
  test('aggregate stats、language breakdown、recent summary を表示する', async ({ page }) => {
    await page.goto('/verify/DashboardPage/populated?chrome=0')

    const stat = (label: string) => page
      .locator('[data-verify-unit="StatCard"]')
      .filter({ hasText: label })
    await expect(stat('Vocabulary')).toContainText('120')
    await expect(stat('Cards')).toContainText('245')
    await expect(stat('Today')).toContainText('7')
    await expect(stat('Synced')).toContainText('75%')
    await expect(page.getByText('流れ', { exact: true })).toBeVisible()
    await expect(page.getByText('English', { exact: true })).toBeVisible()
    await expect(page.getByText('Japanese', { exact: true })).toBeVisible()
    await expect.poll(() => page.evaluate(() => (
      (window as unknown as {
        __verify?: { current: () => { verdict: string } | null }
      }).__verify?.current()?.verdict
    ))).toBe('PASS')
  })
})
