import { expect, test } from '@playwright/test'

test('Content Type の `_query_` field を schema/runtime の両方で拒否する', async ({ page }) => {
  await page.goto('/verify/EntryQueryPrefixGuard/reserved-prefix?chrome=0')

  await expect(page.getByRole('status', { name: 'Content Type schema result' }))
    .toHaveText('Rejected')
  await expect(page.getByRole('status', { name: 'Runtime blueprint result' }))
    .toHaveText('Rejected')
})
