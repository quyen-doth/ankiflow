import { expect, test } from '@playwright/test'

test.describe('History search debounce', () => {
  test('rapid input は最後の keyword だけを settled filter に適用する', async ({ page }) => {
    await page.goto('/verify/HistorySearchDebounce/rapid-input?chrome=0')

    await expect(page.getByLabel('Settled search')).toHaveText('alpha')
    await expect.poll(() => page.evaluate(() => (
      (window as unknown as {
        __verify?: { current: () => { verdict: string } | null }
      }).__verify?.current()?.verdict
    ))).toBe('PASS')
  })
})
